import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import GlassPanel from "./GlassPanel";

const SettingsModal = ({
  isOpen,
  onClose,
  sampleRateHz,
  smoothingFactor,
  onSampleRateChange,
  onSmoothingFactorChange,
  onReset,
}) => {
  const smoothingPercent = Math.round((smoothingFactor ?? 0) * 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <GlassPanel className="w-full max-w-xl p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 shadow-glow">
                  <SlidersHorizontal className="h-5 w-5 text-neon-cyan" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-white/60">
                    Live Settings
                  </p>
                  <p className="text-xs text-slate-500 dark:text-white/50">
                    Tune update rate + smoothing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-black/10 bg-white/10 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-white/70"
                  onClick={onReset}
                >
                  Reset
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/10 text-slate-700 dark:border-white/10 dark:text-white/80"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-black/10 bg-white/5 p-4 dark:border-white/10">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                  <span>Render Rate</span>
                  <span className="font-semibold text-slate-700 dark:text-white/80">
                    {sampleRateHz} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={5}
                  value={sampleRateHz}
                  onChange={(event) => onSampleRateChange(Number(event.target.value))}
                  className="w-full accent-neon-cyan"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-white/50">
                  Lower rates are smoother on low-power devices.
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/5 p-4 dark:border-white/10">
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                  <span>Smoothing</span>
                  <span className="font-semibold text-slate-700 dark:text-white/80">
                    {smoothingPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={smoothingFactor}
                  onChange={(event) => onSmoothingFactorChange(Number(event.target.value))}
                  className="w-full accent-neon-pink"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-white/50">
                  Higher smoothing reduces jitter but can hide quick spikes.
                </p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
