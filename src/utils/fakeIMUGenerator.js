const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const noise = (scale) => (Math.random() - 0.5) * scale;
const lerp = (start, end, factor) => start + (end - start) * factor;

const randomUnitVector = () => {
  const theta = Math.random() * Math.PI * 2;
  const z = rand(-0.4, 0.7);
  const r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(theta), y: r * Math.sin(theta), z };
};

export const createFakeIMUGenerator = (sampleRate = 30) => {
  let t = 0;
  const dt = 1 / sampleRate;
  let phase = "idle";
  let phaseTime = 0;
  let phaseDuration = 0;
  let nextThrowAt = rand(2.5, 5.5);
  let throwAxis = randomUnitVector();
  let roll = 0;
  let pitch = 0;
  let yaw = 0;
  let gyro = { x: 0, y: 0, z: 0 };
  let velocity = 0;
  let impact = 0;

  const setPhase = (name, duration) => {
    phase = name;
    phaseTime = 0;
    phaseDuration = duration;
  };

  const scheduleThrow = () => {
    nextThrowAt = t + rand(2.5, 6);
  };

  const startThrow = () => {
    throwAxis = randomUnitVector();
    setPhase("windup", rand(0.35, 0.6));
  };

  scheduleThrow();

  return () => {
    t += dt;
    phaseTime += dt;

    if (phase === "idle" && t >= nextThrowAt) {
      startThrow();
    }

    if (phase !== "idle" && phaseTime >= phaseDuration) {
      if (phase === "windup") setPhase("throw", rand(0.18, 0.28));
      else if (phase === "throw") setPhase("flight", rand(0.7, 1.1));
      else if (phase === "flight") setPhase("impact", rand(0.08, 0.14));
      else if (phase === "impact") setPhase("recover", rand(0.3, 0.5));
      else if (phase === "recover") {
        setPhase("idle", rand(0.6, 1.2));
        scheduleThrow();
      }
    }

    let linearAccel = { x: 0, y: 0, z: 0 };
    let gyroTarget = { x: 0, y: 0, z: 0 };
    let gravityScale = 1;

    switch (phase) {
      case "idle":
        linearAccel = { x: noise(0.25), y: noise(0.25), z: noise(0.25) };
        gyroTarget = { x: noise(0.08), y: noise(0.08), z: noise(0.08) };
        break;
      case "windup":
        linearAccel = {
          x: throwAxis.x * rand(0.8, 2.2),
          y: throwAxis.y * rand(0.8, 2.2),
          z: throwAxis.z * rand(0.4, 1.4),
        };
        gyroTarget = {
          x: throwAxis.x * rand(0.8, 1.6) + noise(0.2),
          y: throwAxis.y * rand(0.8, 1.6) + noise(0.2),
          z: throwAxis.z * rand(0.5, 1.2) + noise(0.2),
        };
        break;
      case "throw":
        linearAccel = {
          x: throwAxis.x * rand(6, 12),
          y: throwAxis.y * rand(4, 9),
          z: throwAxis.z * rand(3, 7),
        };
        gyroTarget = {
          x: throwAxis.x * rand(2.5, 4.5),
          y: throwAxis.y * rand(2, 4),
          z: throwAxis.z * rand(2, 4),
        };
        break;
      case "flight":
        linearAccel = { x: noise(0.35), y: noise(0.35), z: noise(0.35) };
        gyroTarget = {
          x: gyro.x * 0.92 + noise(0.25),
          y: gyro.y * 0.92 + noise(0.25),
          z: gyro.z * 0.92 + noise(0.25),
        };
        gravityScale = 0.2;
        break;
      case "impact":
        linearAccel = {
          x: throwAxis.x * rand(-18, -10),
          y: throwAxis.y * rand(-16, -8),
          z: throwAxis.z * rand(-12, -6),
        };
        gyroTarget = {
          x: throwAxis.x * rand(1.2, 2.6),
          y: throwAxis.y * rand(1.2, 2.6),
          z: throwAxis.z * rand(1.2, 2.6),
        };
        impact = rand(16, 28);
        break;
      case "recover":
        linearAccel = {
          x: throwAxis.x * rand(-1.2, 1.2),
          y: throwAxis.y * rand(-1.2, 1.2),
          z: throwAxis.z * rand(-0.8, 0.8),
        };
        gyroTarget = { x: noise(0.2), y: noise(0.2), z: noise(0.2) };
        break;
      default:
        break;
    }

    gyro = {
      x: lerp(gyro.x, gyroTarget.x, 0.18),
      y: lerp(gyro.y, gyroTarget.y, 0.18),
      z: lerp(gyro.z, gyroTarget.z, 0.18),
    };

    roll += gyro.x * dt;
    pitch += gyro.y * dt;
    yaw += gyro.z * dt;

    const gravity = {
      x: Math.sin(pitch) * 9.81,
      y: -Math.cos(pitch) * Math.cos(roll) * 9.81,
      z: Math.sin(roll) * 9.81,
    };

    const accel = {
      x: gravity.x * gravityScale + linearAccel.x + noise(0.12),
      y: gravity.y * gravityScale + linearAccel.y + noise(0.12),
      z: gravity.z * gravityScale + linearAccel.z + noise(0.12),
    };

    const linearMag = Math.sqrt(
      linearAccel.x * linearAccel.x + linearAccel.y * linearAccel.y + linearAccel.z * linearAccel.z
    );
    const speedTarget = phase === "flight" ? Math.max(velocity * 0.98, linearMag * 0.8) : linearMag * 0.9;
    velocity = clamp(lerp(velocity, speedTarget, 0.15), 0, 14);

    impact = Math.max(impact * 0.86, 0);

    return {
      accel,
      gyro,
      velocity,
      impact,
      timestamp: Date.now(),
    };
  };
};
