import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Orbit, Timer } from "lucide-react";
import Navbar from "../components/Navbar";
import TabSwitcher from "../components/TabSwitcher";
import GlassPanel from "../components/GlassPanel";
import SettingsModal from "../components/SettingsModal";
import { useLiveIMUData } from "../hooks/useLiveIMUData";
import { CONFIG } from "../config";

const TIME_WINDOWS = [10, 30, 60];

const formatValue = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(decimals);
};

const magnitude = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

const integrateTrapezoid = (points, accessor) => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const dt = (curr.timestamp - prev.timestamp) / 1000;
    if (dt <= 0) continue;
    total += ((accessor(prev) + accessor(curr)) / 2) * dt;
  }
  return total;
};

const findImpactWindow = (points, threshold, massKg) => {
  if (!points.length) return null;
  let endIndex = -1;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].impact >= threshold) {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return null;

  let startIndex = endIndex;
  while (startIndex > 0 && points[startIndex - 1].impact >= threshold) {
    startIndex -= 1;
  }

  const windowPoints = points.slice(startIndex, endIndex + 1);
  const durationMs = windowPoints.at(-1).timestamp - windowPoints[0].timestamp;
  const impulse = integrateTrapezoid(windowPoints, (p) => p.impact * massKg);
  const peakImpact = Math.max(...windowPoints.map((p) => p.impact));
  const peakForce = peakImpact * massKg;
  const deltaV = windowPoints.at(-1).velocity - windowPoints[0].velocity;

  return {
    startTime: windowPoints[0].timestamp,
    endTime: windowPoints.at(-1).timestamp,
    durationMs,
    impulse,
    peakImpact,
    peakForce,
    deltaV,
  };
};

const MetricCard = ({ label, value, unit, formula }) => (
  <div className="rounded-2xl border border-black/10 bg-white/5 p-4 dark:border-white/10">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
      {label}
    </p>
    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
      {value} <span className="text-xs text-slate-500 dark:text-white/50">{unit}</span>
    </p>
    {formula && (
      <p className="mt-2 text-[11px] text-slate-500 dark:text-white/40">{formula}</p>
    )}
  </div>
);

const Physics = () => {
  const [renderRateHz, setRenderRateHz] = useState(() => {
    if (typeof window === "undefined") return CONFIG.SAMPLE_RATE_HZ;
    const stored = Number(window.localStorage.getItem("renderRateHz"));
    return Number.isFinite(stored) ? stored : CONFIG.SAMPLE_RATE_HZ;
  });
  const [smoothingFactor, setSmoothingFactor] = useState(() => {
    if (typeof window === "undefined") return CONFIG.SMOOTHING_FACTOR;
    const stored = Number(window.localStorage.getItem("smoothingFactor"));
    return Number.isFinite(stored) ? stored : CONFIG.SMOOTHING_FACTOR;
  });
  const { data, history, isConnected, error } = useLiveIMUData({
    sampleRateHz: renderRateHz,
    smoothingFactor,
  });

  const [windowSeconds, setWindowSeconds] = useState(30);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("theme");
    if (stored) return stored;
    return "dark";
  });

  const massKg = CONFIG.MASS_KG;
  const wheelRadiusM = CONFIG.WHEEL_RADIUS_M;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("renderRateHz", String(renderRateHz));
  }, [renderRateHz]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("smoothingFactor", String(smoothingFactor));
  }, [smoothingFactor]);

  const windowedHistory = useMemo(() => {
    if (!history?.length) return [];
    const latest = history[history.length - 1].timestamp;
    const cutoff = latest - windowSeconds * 1000;
    return history.filter((point) => point.timestamp >= cutoff);
  }, [history, windowSeconds]);

  const metrics = useMemo(() => {
    if (!windowedHistory.length) {
      return null;
    }

    const first = windowedHistory[0];
    const last = windowedHistory.at(-1);
    const totalTime = Math.max((last.timestamp - first.timestamp) / 1000, 0);

    const distance = integrateTrapezoid(windowedHistory, (p) => p.velocity);
    const avgSpeed = totalTime > 0 ? distance / totalTime : 0;
    const maxSpeed = Math.max(...windowedHistory.map((p) => p.velocity));
    const minSpeed = Math.min(...windowedHistory.map((p) => p.velocity));

    const accelValues = windowedHistory.map((p) => magnitude(p.ax, p.ay, p.az));
    const avgAccel = accelValues.reduce((sum, value) => sum + value, 0) / accelValues.length;
    const maxAccel = Math.max(...accelValues);

    const currentSpeed = last.velocity;
    const currentAccel = accelValues.at(-1);
    const forceNow = massKg * currentAccel;

    const momentum = massKg * currentSpeed;
    const kineticEnergy = 0.5 * massKg * currentSpeed * currentSpeed;

    const work = 0.5 * massKg * (last.velocity * last.velocity - first.velocity * first.velocity);
    const avgPower = totalTime > 0 ? work / totalTime : 0;

    const yawRate = Number.isFinite(last.gz) ? last.gz : 0;
    const turnRadius = Math.abs(yawRate) > 0.02 ? currentSpeed / Math.abs(yawRate) : null;
    const centripetalAccel = Math.abs(yawRate) > 0.02 ? currentSpeed * Math.abs(yawRate) : null;

    const wheelRpm =
      wheelRadiusM > 0
        ? (currentSpeed / (2 * Math.PI * wheelRadiusM)) * 60
        : null;

    const impact = findImpactWindow(windowedHistory, CONFIG.IMPACT_THRESHOLD, massKg);

    return {
      totalTime,
      distance,
      avgSpeed,
      maxSpeed,
      minSpeed,
      avgAccel,
      maxAccel,
      currentSpeed,
      currentAccel,
      forceNow,
      momentum,
      kineticEnergy,
      work,
      avgPower,
      yawRate,
      turnRadius,
      centripetalAccel,
      wheelRpm,
      impact,
    };
  }, [windowedHistory, massKg, wheelRadiusM]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleResetSettings = () => {
    setRenderRateHz(CONFIG.SAMPLE_RATE_HZ);
    setSmoothingFactor(CONFIG.SMOOTHING_FACTOR);
  };

  const impactSummary = metrics?.impact;

  return (
    <div className="min-h-screen text-slate-900 dark:text-white">
      <Navbar
        isConnected={isConnected}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
        <TabSwitcher />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6"
        >
          <GlassPanel className="p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-white/60">
                  Physics Calculations
                </p>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Mass: {massKg} kg · Wheel radius: {wheelRadiusM} m
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/10 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-white/80">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                  <Timer className="h-4 w-4" />
                  Time Window
                </div>
                <div className="flex items-center gap-2">
                  {TIME_WINDOWS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setWindowSeconds(value)}
                      className={`rounded-full px-3 py-1 text-xs ${
                        windowSeconds === value
                          ? "bg-white/40 text-slate-900 dark:text-white"
                          : "bg-white/5 text-slate-600 hover:bg-white/10 dark:text-white/60"
                      }`}
                    >
                      {value}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!metrics && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-500 dark:text-white/60">
                Waiting for live sensor data...
              </div>
            )}

            {metrics && (
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                    Kinematics
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Distance"
                      value={formatValue(metrics.distance, 2)}
                      unit="m"
                      formula="s = ∫ v dt"
                    />
                    <MetricCard
                      label="Average Speed"
                      value={formatValue(metrics.avgSpeed, 2)}
                      unit="m/s"
                      formula="v̄ = Δs / Δt"
                    />
                    <MetricCard
                      label="Max Speed"
                      value={formatValue(metrics.maxSpeed, 2)}
                      unit="m/s"
                      formula="vmax"
                    />
                    <MetricCard
                      label="Average Accel"
                      value={formatValue(metrics.avgAccel, 2)}
                      unit="m/s²"
                      formula="ā = Σ|a|/n"
                    />
                    <MetricCard
                      label="Max Accel"
                      value={formatValue(metrics.maxAccel, 2)}
                      unit="m/s²"
                      formula="amax"
                    />
                    <MetricCard
                      label="Current Speed"
                      value={formatValue(metrics.currentSpeed, 2)}
                      unit="m/s"
                      formula="v(t)"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                    Dynamics & Energy
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Net Force"
                      value={formatValue(metrics.forceNow, 2)}
                      unit="N"
                      formula="F = m a"
                    />
                    <MetricCard
                      label="Momentum"
                      value={formatValue(metrics.momentum, 2)}
                      unit="kg·m/s"
                      formula="p = m v"
                    />
                    <MetricCard
                      label="Kinetic Energy"
                      value={formatValue(metrics.kineticEnergy, 2)}
                      unit="J"
                      formula="Ek = 1/2 m v²"
                    />
                    <MetricCard
                      label="Work (ΔEk)"
                      value={formatValue(metrics.work, 2)}
                      unit="J"
                      formula="W = ΔEk"
                    />
                    <MetricCard
                      label="Average Power"
                      value={formatValue(metrics.avgPower, 2)}
                      unit="W"
                      formula="P = W/Δt"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                    Turning & Rotation
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Yaw Rate"
                      value={formatValue(metrics.yawRate, 3)}
                      unit="rad/s"
                      formula="ωz"
                    />
                    <MetricCard
                      label="Turn Radius"
                      value={metrics.turnRadius ? formatValue(metrics.turnRadius, 2) : "--"}
                      unit="m"
                      formula="r = v / ω"
                    />
                    <MetricCard
                      label="Centripetal Accel"
                      value={metrics.centripetalAccel ? formatValue(metrics.centripetalAccel, 2) : "--"}
                      unit="m/s²"
                      formula="ac = vω"
                    />
                    <MetricCard
                      label="Wheel RPM"
                      value={metrics.wheelRpm ? formatValue(metrics.wheelRpm, 1) : "--"}
                      unit="rpm"
                      formula="rpm = v / (2πr)"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                    Impact Analysis
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Impact Peak Accel"
                      value={impactSummary ? formatValue(impactSummary.peakImpact, 2) : "--"}
                      unit="m/s²"
                      formula="amax during impact"
                    />
                    <MetricCard
                      label="Peak Force"
                      value={impactSummary ? formatValue(impactSummary.peakForce, 2) : "--"}
                      unit="N"
                      formula="Fmax = m amax"
                    />
                    <MetricCard
                      label="Impulse"
                      value={impactSummary ? formatValue(impactSummary.impulse, 3) : "--"}
                      unit="N·s"
                      formula="J = ∫ F dt"
                    />
                    <MetricCard
                      label="Δv (impact)"
                      value={impactSummary ? formatValue(impactSummary.deltaV, 3) : "--"}
                      unit="m/s"
                      formula="Δv = v2 - v1"
                    />
                    <MetricCard
                      label="Impact Duration"
                      value={impactSummary ? formatValue(impactSummary.durationMs, 0) : "--"}
                      unit="ms"
                      formula="Δt"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs text-rose-400">
                {error}
              </p>
            )}
          </GlassPanel>
        </motion.div>

        <GlassPanel className="mt-6 px-5 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
            <Orbit className="h-4 w-4" />
            Notes
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-white/50">
            Calculations use your IMU stream and assume the cart moves mostly forward in a straight line.
            Values are approximate and can drift during long runs.
          </p>
        </GlassPanel>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sampleRateHz={renderRateHz}
        smoothingFactor={smoothingFactor}
        onSampleRateChange={setRenderRateHz}
        onSmoothingFactorChange={setSmoothingFactor}
        onReset={handleResetSettings}
      />
    </div>
  );
};

export default Physics;
