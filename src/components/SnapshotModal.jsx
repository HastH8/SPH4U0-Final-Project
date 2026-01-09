import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { toPng } from "html-to-image";
import GlassPanel from "./GlassPanel";
import LiveGraph from "./LiveGraph";

const SnapshotModal = ({ isOpen, onClose, snapshotData, view, windowSeconds }) => {
  const containerRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!containerRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(containerRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = `snapshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 py-10 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <GlassPanel className="w-full max-w-4xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-white/60">
                Snapshot View
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-2 rounded-full border border-black/10 bg-white/10 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:text-white/80"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Download className="h-4 w-4" />
                  {saving ? "Saving" : "Save PNG"}
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/10 text-slate-700 dark:border-white/10 dark:text-white/80"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              ref={containerRef}
              className="snapshot-surface rounded-[20px] border border-white/10 p-4"
            >
              <div className="absolute inset-0 bg-white/5" />
              <div className="relative z-10">
              {snapshotData?.length ? (
                <LiveGraph
                  history={snapshotData}
                  data={snapshotData?.[snapshotData.length - 1]}
                  view={view}
                  windowSeconds={windowSeconds}
                  paused={false}
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-slate-500 dark:text-white/60 sm:h-[360px]">
                  No snapshot data captured yet.
                </div>
              )}
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SnapshotModal;
