import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { createPeakDetector } from "../utils/peakDetector";

const ImpactDetector = ({ impact, threshold }) => {
	const [alert, setAlert] = useState(null);
	const [anchorEl, setAnchorEl] = useState(null);
	const detector = useMemo(() => createPeakDetector(threshold), [threshold]);

	useEffect(() => {
		if (impact == null) return;
		if (detector(impact)) {
			setAlert({ force: impact, id: Date.now() });
			const timeout = setTimeout(() => setAlert(null), 2400);
			return () => clearTimeout(timeout);
		}
		return undefined;
	}, [impact, detector]);

	useEffect(() => {
		if (typeof document === "undefined") return;
		setAnchorEl(document.getElementById("impact-toast-anchor"));
	}, []);

	const toastClassName = `flex max-w-[90vw] flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/30 bg-white/30 px-4 py-3 text-center text-sm text-slate-900 shadow-soft backdrop-blur-2xl dark:text-white sm:flex-nowrap ${
		anchorEl ? "" : "fixed left-1/2 top-20 z-50 -translate-x-1/2"
	}`;
	const toastNode = alert ? (
		<motion.div
			key={alert.id}
			initial={{ opacity: 0, y: -12, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -12, scale: 0.98 }}
			className={`${toastClassName} pointer-events-none`}
		>
			<div className="flex h-9 w-9 items-center justify-center rounded-full bg-neon-pink/15">
				<AlertTriangle className="h-5 w-5 text-neon-pink" />
			</div>
			<div className="flex items-center gap-2">
				<span className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/60">
					Impact Detected
				</span>
				<span className="rounded-full bg-black/10 px-3 py-1 text-sm font-semibold text-slate-900 dark:bg-white/10 dark:text-white">
					{alert.force.toFixed(2)} N
				</span>
			</div>
		</motion.div>
	) : null;

	return (
		<>
			<div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/10 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:text-white/70">
				<span
					className={`h-2 w-2 rounded-full ${
						impact >= threshold
							? "bg-neon-pink shadow-[0_0_10px_rgba(255,79,216,0.7)]"
							: "bg-white/30"
					} ${impact >= threshold ? "animate-pulse" : ""}`}
				/>
				Peak Detection
			</div>

			<AnimatePresence>
				{toastNode &&
					(anchorEl ? createPortal(toastNode, anchorEl) : toastNode)}
			</AnimatePresence>
		</>
	);
};

export default ImpactDetector;
