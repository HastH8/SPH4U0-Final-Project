import { motion } from "framer-motion";
import { MoonStar, SlidersHorizontal, SunMedium, Waves } from "lucide-react";
import GlassPanel from "./GlassPanel";
import StatusIndicator from "./StatusIndicator";

const Navbar = ({ isConnected, isStreaming, theme, onToggleTheme, onOpenSettings }) => {
  return (
    <div className="sticky top-0 z-30 px-4 pt-4 sm:px-6 sm:pt-6">
      <GlassPanel className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 shadow-glow">
            <Waves className="h-5 w-5 text-neon-cyan" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">Smart Physics Car</p>
            <p className="text-xs text-slate-600 dark:text-white/60">Live IMU Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <StatusIndicator isConnected={isConnected} isStreaming={isStreaming} />
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/10 text-slate-900 shadow-soft dark:border-white/15 dark:text-white"
            onClick={onOpenSettings}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/10 text-slate-900 shadow-soft dark:border-white/15 dark:text-white"
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
          </motion.button>
        </div>

        <div
          id="impact-toast-anchor"
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
        />
      </GlassPanel>
    </div>
  );
};

export default Navbar;
