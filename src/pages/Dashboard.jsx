import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
	Camera,
	Download,
	Pause,
	Play,
	RefreshCcw,
	Table,
	Timer,
	Trash2,
} from "lucide-react";
import Navbar from "../components/Navbar";
import TabSwitcher from "../components/TabSwitcher";
import GlassPanel from "../components/GlassPanel";
import LiveGraph from "../components/LiveGraph";
import SnapshotModal from "../components/SnapshotModal";
import DataTableModal from "../components/DataTableModal";
import SettingsModal from "../components/SettingsModal";
import ImpactDetector from "../components/ImpactDetector";
import { useLiveIMUData } from "../hooks/useLiveIMUData";
import { exportHistoryToCSV } from "../utils/csvExporter";
import { CONFIG } from "../config";

const TIME_WINDOWS = [10, 30, 60];

const Dashboard = ({ view }) => {
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
	const { data, history, isConnected, error, clearHistory, snapshot } =
		useLiveIMUData({ sampleRateHz: renderRateHz, smoothingFactor });

	const [windowSeconds, setWindowSeconds] = useState(30);
	const [paused, setPaused] = useState(false);
	const [snapshotData, setSnapshotData] = useState([]);
	const [snapshotOpen, setSnapshotOpen] = useState(false);
	const [tableOpen, setTableOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [theme, setTheme] = useState(() => {
		if (typeof window === "undefined") return "dark";
		const stored = window.localStorage.getItem("theme");
		if (stored) return stored;
		return "dark";
	});

	const frozenRef = useRef([]);

	const windowedHistory = useMemo(() => {
		if (!history?.length) return [];
		const latest = history[history.length - 1].timestamp;
		const cutoff = latest - windowSeconds * 1000;
		return history.filter((point) => point.timestamp >= cutoff);
	}, [history, windowSeconds]);

	useEffect(() => {
		if (!paused || windowedHistory.length === 0) {
			frozenRef.current = windowedHistory;
		}
	}, [windowedHistory, paused]);

	const displayHistory = paused ? frozenRef.current : windowedHistory;
	const latestPoint = displayHistory[displayHistory.length - 1] || data || {};

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

	const handleToggleTheme = () => {
		setTheme((prev) => (prev === "dark" ? "light" : "dark"));
	};

	const handleResetSettings = () => {
		setRenderRateHz(CONFIG.SAMPLE_RATE_HZ);
		setSmoothingFactor(CONFIG.SMOOTHING_FACTOR);
	};

	const handleSnapshot = () => {
		const snap = paused ? displayHistory : snapshot();
		const latest = snap[snap.length - 1];
		if (!latest) return;
		const cutoff = latest.timestamp - windowSeconds * 1000;
		const windowSnap = snap.filter((point) => point.timestamp >= cutoff);

		setSnapshotData(windowSnap);
		setSnapshotOpen(true);
	};

	const stats = [
		{ label: "ax", value: latestPoint.ax },
		{ label: "ay", value: latestPoint.ay },
		{ label: "az", value: latestPoint.az },
		{ label: "gx", value: latestPoint.gx },
		{ label: "gy", value: latestPoint.gy },
		{ label: "gz", value: latestPoint.gz },
		{ label: "velocity", value: latestPoint.velocity },
		{ label: "impact", value: latestPoint.impact },
	];

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

				<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
						className="h-full"
					>
						<GlassPanel className="flex h-full flex-col p-4 sm:p-6">
							<div className="flex-1">
								<LiveGraph
									history={history}
									data={data}
									view={view}
									windowSeconds={windowSeconds}
									paused={paused}
									stretch
								/>
							</div>
						</GlassPanel>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="h-fit lg:sticky lg:top-28"
					>
						<GlassPanel className="flex flex-col gap-4 p-4">
							<ImpactDetector
								impact={data?.impact ?? 0}
								threshold={CONFIG.IMPACT_THRESHOLD}
							/>

							<button
								className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/10 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-white/80"
								onClick={() => setPaused((prev) => !prev)}
							>
								<span className="flex items-center gap-2">
									{paused ? (
										<Play className="h-4 w-4" />
									) : (
										<Pause className="h-4 w-4" />
									)}
									{paused ? "Resume" : "Pause"}
								</span>
								<span className="text-xs text-slate-500 dark:text-white/50">
									Live
								</span>
							</button>

							<button
								className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/10 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-white/80"
								onClick={clearHistory}
							>
								<span className="flex items-center gap-2">
									<Trash2 className="h-4 w-4" />
									Clear Graph
								</span>
							</button>

							<button
								className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/10 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-white/80"
								onClick={handleSnapshot}
							>
								<span className="flex items-center gap-2">
									<Camera className="h-4 w-4" />
									Snapshot
								</span>
							</button>

							<button
								className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/10 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-white/80"
								onClick={() => setTableOpen(true)}
							>
								<span className="flex items-center gap-2">
									<Table className="h-4 w-4" />
									Data Tables
								</span>
							</button>

							<button
								className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/10 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-white/80"
								onClick={() => exportHistoryToCSV(history)}
							>
								<span className="flex items-center gap-2">
									<Download className="h-4 w-4" />
									Export CSV
								</span>
							</button>

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

							<button
								className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/5 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:text-white/60"
								onClick={() => setWindowSeconds(30)}
							>
								<span className="flex items-center gap-2">
									<RefreshCcw className="h-4 w-4" />
									Reset View
								</span>
							</button>

							{error && <p className="text-xs text-rose-300">{error}</p>}
						</GlassPanel>
					</motion.div>
				</div>

				<GlassPanel className="mt-6 px-4 py-4 sm:px-6">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
							Live Readouts
						</div>
						<div className="text-xs text-slate-500 dark:text-white/50">
							{isConnected ? "Streaming" : "Awaiting Connection"}
						</div>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
						{stats.map((stat) => (
							<div
								key={stat.label}
								className="rounded-2xl border border-black/10 bg-white/5 px-4 py-3 dark:border-white/10"
							>
								<p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
									{stat.label}
								</p>
								<p className="mt-1 text-lg font-semibold">
									{Number.isFinite(stat.value) ? stat.value.toFixed(2) : "--"}
								</p>
							</div>
						))}
					</div>
				</GlassPanel>

				<footer className="mt-8 flex justify-center text-center text-xs text-slate-500 dark:text-white/50">
					Made by: Hast K. Qais, Abdelrahman Physics Final Summative Project
				</footer>
			</div>

			<SnapshotModal
				isOpen={snapshotOpen}
				onClose={() => setSnapshotOpen(false)}
				snapshotData={snapshotData}
				view={view}
				windowSeconds={windowSeconds}
			/>
			<DataTableModal
				isOpen={tableOpen}
				onClose={() => setTableOpen(false)}
				history={history}
				windowedHistory={windowedHistory}
				windowSeconds={windowSeconds}
			/>
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

export default Dashboard;
