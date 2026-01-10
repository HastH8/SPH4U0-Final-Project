import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { curveMonotoneX } from "@visx/curve";
import { CONFIG } from "../config";

const GRAPH_CONFIG = {
	acceleration: {
		title: "Acceleration (m/s^2)",
		series: [
			{
				key: "ax",
				label: "X",
				gradient: ["#00f7ff", "#0051ff"],
				glow: "rgba(0,247,255,0.6)",
			},
			{
				key: "ay",
				label: "Y",
				gradient: ["#ff4fd8", "#b100ff"],
				glow: "rgba(255,79,216,0.5)",
			},
			{
				key: "az",
				label: "Z",
				gradient: ["#5bffb0", "#0bd1b7"],
				glow: "rgba(91,255,176,0.5)",
			},
		],
	},
	rotation: {
		title: "Rotation (rad/s)",
		series: [
			{
				key: "gx",
				label: "X",
				gradient: ["#ffd166", "#f77f00"],
				glow: "rgba(255,209,102,0.5)",
			},
			{
				key: "gy",
				label: "Y",
				gradient: ["#7bdff2", "#5390d9"],
				glow: "rgba(123,223,242,0.5)",
			},
			{
				key: "gz",
				label: "Z",
				gradient: ["#80ed99", "#38b000"],
				glow: "rgba(128,237,153,0.5)",
			},
		],
	},
	velocity: {
		title: "Velocity (m/s)",
		series: [
			{
				key: "velocity",
				label: "Velocity",
				gradient: ["#5bffb0", "#2adf9e"],
				glow: "rgba(91,255,176,0.6)",
			},
		],
	},
	impact: {
		title: "Impact Force (N)",
		series: [
			{
				key: "impact",
				label: "Impact",
				gradient: ["#ff4fd8", "#ff6b6b"],
				glow: "rgba(255,79,216,0.6)",
				highlightPeaks: true,
			},
		],
	},
};

const CHART_MARGIN = { top: 12, right: 18, bottom: 30, left: 44 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatTime = (timestamp) => {
	if (!timestamp) return "";
	return new Date(timestamp).toLocaleTimeString([], {
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
};

const getYDomain = (data, series) => {
	const values = [];
	data.forEach((point) => {
		series.forEach((entry) => {
			const value = point?.[entry.key];
			if (Number.isFinite(value)) {
				values.push(value);
			}
		});
	});

	if (!values.length) {
		return { min: 0, max: 1 };
	}

	const min = Math.min(...values);
	const max = Math.max(...values);
	const padding = Math.max((max - min) * 0.15, 0.5);
	return { min: min - padding, max: max + padding };
};

const ChassisModel = ({ rotation }) => {
	const chassisRef = useRef(null);

	useFrame(() => {
		if (!chassisRef.current) return;
		const damping = 0.08;
		chassisRef.current.rotation.x +=
			(rotation[0] - chassisRef.current.rotation.x) * damping;
		chassisRef.current.rotation.y +=
			(rotation[1] - chassisRef.current.rotation.y) * damping;
		chassisRef.current.rotation.z +=
			(rotation[2] - chassisRef.current.rotation.z) * damping;
	});

	return (
		<group ref={chassisRef}>
			<mesh position={[0, 0, 0]}>
				<boxGeometry args={[3.4, 0.4, 1.7]} />
				<meshStandardMaterial
					color="#c7f9ff"
					emissive="#00f7ff"
					emissiveIntensity={0.18}
					metalness={0.55}
					roughness={0.22}
				/>
			</mesh>
			<mesh position={[0.3, 0.45, 0.05]}>
				<boxGeometry args={[1.6, 0.3, 1.1]} />
				<meshStandardMaterial
					color="#1e293b"
					emissive="#38bdf8"
					emissiveIntensity={0.12}
					metalness={0.25}
					roughness={0.5}
				/>
			</mesh>
			<mesh position={[-1.2, 0.1, 0]}>
				<boxGeometry args={[0.7, 0.25, 1.4]} />
				<meshStandardMaterial color="#93c5fd" metalness={0.2} roughness={0.4} />
			</mesh>
			<mesh position={[1.65, 0.02, 0]}>
				<boxGeometry args={[0.3, 0.2, 1.3]} />
				<meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.6} />
			</mesh>
			{[
				[1.25, -0.3, 0.82],
				[-1.25, -0.3, 0.82],
				[1.25, -0.3, -0.82],
				[-1.25, -0.3, -0.82],
			].map(([x, y, z]) => (
				<mesh key={`${x}-${z}`} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
					<cylinderGeometry args={[0.28, 0.28, 0.24, 24]} />
					<meshStandardMaterial color="#0b0f1a" metalness={0.2} roughness={0.85} />
				</mesh>
			))}
			<mesh position={[0, 0.52, -0.25]}>
				<boxGeometry args={[0.25, 0.2, 0.25]} />
				<meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.3} />
			</mesh>
		</group>
	);
};

const OrientationChassis = ({ rotation }) => {
	return (
		<Canvas camera={{ position: [0, 2.6, 5.2], fov: 42 }}>
			<ambientLight intensity={0.65} />
			<directionalLight position={[3, 4, 2]} intensity={1.1} />
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
				<circleGeometry args={[3.2, 64]} />
				<meshStandardMaterial color="#0b1120" roughness={0.95} metalness={0.1} />
			</mesh>
			<ChassisModel rotation={rotation} />
		</Canvas>
	);
};

const VisxLineChart = ({ data, config, view, series }) => {
  const [tooltip, setTooltip] = useState(null);
  const [zoomDomain, setZoomDomain] = useState(null);
  const seriesList = series && series.length ? series : config.series;

	return (
		<ParentSize>
			{({ width, height }) => {
				if (width < 10 || height < 10) {
					return null;
				}

				const innerWidth = width - CHART_MARGIN.left - CHART_MARGIN.right;
				const innerHeight = height - CHART_MARGIN.top - CHART_MARGIN.bottom;
				const timestamps = data.map((point) => point.timestamp);
				const minX = timestamps.length
					? Math.min(...timestamps)
					: Date.now() - 1000;
				const maxX = timestamps.length ? Math.max(...timestamps) : Date.now();
				const safeMinX = minX === maxX ? minX - 500 : minX;
				const safeMaxX = minX === maxX ? maxX + 500 : maxX;
				const { min: minY, max: maxY } = getYDomain(data, seriesList);

        const fullDomain = { start: safeMinX, end: safeMaxX };
        const zoomStart = zoomDomain ? Math.max(fullDomain.start, zoomDomain.start) : fullDomain.start;
        const zoomEnd = zoomDomain ? Math.min(fullDomain.end, zoomDomain.end) : fullDomain.end;
        const activeDomain = zoomEnd > zoomStart ? { start: zoomStart, end: zoomEnd } : fullDomain;

        const xScale = scaleLinear({
          domain: [activeDomain.start, activeDomain.end],
          range: [0, innerWidth],
        });

				const yScale = scaleLinear({
					domain: [minY, maxY],
					range: [innerHeight, 0],
					nice: true,
				});

        const handlePointerMove = (event) => {
          if (!data.length) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left - CHART_MARGIN.left;
          if (x < 0 || x > innerWidth) {
            setTooltip(null);
            return;
          }
          const xValue = xScale.invert(x);
					let nearestIndex = 0;
					let minDistance = Infinity;
					data.forEach((point, index) => {
						const distance = Math.abs(point.timestamp - xValue);
						if (distance < minDistance) {
							minDistance = distance;
							nearestIndex = index;
						}
					});
					const nearest = data[nearestIndex];
					if (!nearest) {
						setTooltip(null);
						return;
					}
					setTooltip({
						point: nearest,
						x: xScale(nearest.timestamp),
					});
				};

        const handleWheel = (event) => {
          event.preventDefault();
          if (!data.length) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left - CHART_MARGIN.left;
          if (x < 0 || x > innerWidth) return;
          const focusValue = xScale.invert(x);
          const currentRange = activeDomain.end - activeDomain.start;
          const fullRange = fullDomain.end - fullDomain.start;
          const minRange = Math.max(1500, fullRange * 0.08);
          const zoomFactor = event.deltaY < 0 ? 0.85 : 1.15;
          const nextRange = clamp(currentRange * zoomFactor, minRange, fullRange);
          const ratio = (focusValue - activeDomain.start) / currentRange;
          let nextStart = focusValue - ratio * nextRange;
          let nextEnd = nextStart + nextRange;
          if (nextStart < fullDomain.start) {
            nextStart = fullDomain.start;
            nextEnd = nextStart + nextRange;
          }
          if (nextEnd > fullDomain.end) {
            nextEnd = fullDomain.end;
            nextStart = nextEnd - nextRange;
          }
          setZoomDomain(nextRange >= fullRange ? null : { start: nextStart, end: nextEnd });
        };

        return (
          <div className="relative h-full w-full">
            <svg width={width} height={height} className="overflow-visible">
							<defs>
								{seriesList.map((series) => (
									<linearGradient
										key={`${view}-${series.key}-gradient`}
										id={`${view}-${series.key}-gradient`}
										x1="0"
										y1="0"
										x2="0"
										y2="1"
									>
										<stop offset="0%" stopColor={series.gradient[0]} />
										<stop offset="100%" stopColor={series.gradient[1]} />
									</linearGradient>
								))}
								<clipPath id={`${view}-clip`}>
									<rect width={innerWidth} height={innerHeight} />
								</clipPath>
							</defs>

							<Group left={CHART_MARGIN.left} top={CHART_MARGIN.top}>
								<GridRows
									scale={yScale}
									width={innerWidth}
									stroke="var(--grid-line)"
									numTicks={4}
								/>
								<AxisLeft
									scale={yScale}
									stroke="var(--axis-line)"
									tickStroke="var(--axis-line)"
									numTicks={4}
									tickLabelProps={() => ({
										fill: "var(--axis-text)",
										fontSize: 10,
										textAnchor: "end",
										dx: -6,
										dy: 3,
									})}
								/>
								<AxisBottom
									top={innerHeight}
									scale={xScale}
									stroke="var(--axis-line)"
									tickStroke="var(--axis-line)"
									numTicks={5}
									tickFormat={(value) => formatTime(value)}
									tickLabelProps={() => ({
										fill: "var(--axis-text)",
										fontSize: 10,
										textAnchor: "middle",
										dy: 8,
									})}
								/>

								<Group clipPath={`url(#${view}-clip)`}>
									{seriesList.map((series) => (
										<LinePath
											key={series.key}
											data={data}
											x={(point) => xScale(point.timestamp)}
											y={(point) => yScale(point[series.key])}
											curve={curveMonotoneX}
											stroke={`url(#${view}-${series.key}-gradient)`}
											strokeWidth={2.6}
											strokeLinecap="round"
											strokeLinejoin="round"
											style={{ filter: `drop-shadow(0 0 10px ${series.glow})` }}
										/>
									))}

									{tooltip && (
										<line
											x1={tooltip.x}
											x2={tooltip.x}
											y1={0}
											y2={innerHeight}
											stroke="rgba(255,255,255,0.2)"
											strokeDasharray="4 6"
										/>
									)}

									{tooltip &&
										seriesList.map((series) => {
											const value = tooltip.point?.[series.key];
											if (!Number.isFinite(value)) return null;
											return (
												<circle
													key={`hover-${series.key}`}
													cx={tooltip.x}
													cy={yScale(value)}
													r={4}
													fill={series.gradient[0]}
													stroke="rgba(255,255,255,0.9)"
													strokeWidth={1.5}
												/>
											);
										})}

									{seriesList
										.filter((series) => series.highlightPeaks)
										.flatMap((series) =>
											data.map((point, index) => {
												const value = point?.[series.key];
												if (
													!Number.isFinite(value) ||
													value < CONFIG.IMPACT_THRESHOLD
												) {
													return null;
												}
												return (
													<circle
														key={`peak-${series.key}-${index}`}
														cx={xScale(point.timestamp)}
														cy={yScale(value)}
														r={4}
														fill="#ff4fd8"
														stroke="rgba(255,255,255,0.9)"
														strokeWidth={1.5}
													/>
												);
											})
										)}

                  <rect
                    x={0}
                    y={0}
                    width={innerWidth}
                    height={innerHeight}
                    fill="transparent"
                    pointerEvents="all"
                    onMouseMove={handlePointerMove}
                    onMouseLeave={() => setTooltip(null)}
                    onWheel={handleWheel}
                    onDoubleClick={() => setZoomDomain(null)}
                  />
								</Group>
							</Group>
						</svg>

						{tooltip && (
							<div
								className="pointer-events-none absolute rounded-2xl border border-white/20 bg-slate-900/90 px-3 py-2 text-xs text-white shadow-soft backdrop-blur-2xl"
								style={{
									left: Math.max(
										12,
										Math.min(CHART_MARGIN.left + tooltip.x + 12, width - 180)
									),
									top: CHART_MARGIN.top + 12,
								}}
							>
								<div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
									{formatTime(tooltip.point.timestamp)}
								</div>
								<div className="space-y-1">
									{seriesList.map((series) => (
										<div
											key={`tooltip-${series.key}`}
											className="flex items-center gap-2"
										>
											<span
												className="h-2 w-2 rounded-full"
												style={{ backgroundColor: series.gradient[0] }}
											/>
											<span className="text-white/70">{series.label}</span>
											<span className="ml-auto font-semibold text-white">
												{Number.isFinite(tooltip.point[series.key])
													? tooltip.point[series.key].toFixed(2)
													: "--"}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				);
			}}
		</ParentSize>
	);
};

const LiveGraph = ({ history, data, view, windowSeconds, paused, stretch = false }) => {
	if (view === "orientation") {
		const applyDeadzone = (value, zone = 0.03) =>
			Math.abs(value) < zone ? 0 : value;
		const toRadians = (value) => (value * Math.PI) / 180;
		const hasOrientation =
			Number.isFinite(data?.roll) &&
			Number.isFinite(data?.pitch) &&
			Number.isFinite(data?.yaw);

		const rotation = hasOrientation
			? [
					clamp(applyDeadzone(toRadians(data.roll), 0.01), -Math.PI, Math.PI),
					clamp(applyDeadzone(toRadians(data.yaw), 0.01), -Math.PI, Math.PI),
					-clamp(applyDeadzone(toRadians(data.pitch), 0.01), -Math.PI, Math.PI),
			  ]
			: [
					clamp(applyDeadzone((data?.gy ?? 0) * 0.24), -0.7, 0.7),
					clamp(applyDeadzone((data?.gz ?? 0) * 0.18), -0.9, 0.9),
					-clamp(applyDeadzone((data?.gx ?? 0) * 0.24), -0.7, 0.7),
			  ];

		return (
			<div
				className={`flex w-full items-center justify-center ${
					stretch ? "h-full min-h-[320px]" : "h-[320px] sm:h-[360px]"
				}`}
			>
				<div className="h-full w-full overflow-hidden rounded-[24px] border border-white/10 bg-white/5">
					<OrientationChassis rotation={rotation} />
				</div>
			</div>
		);
	}

	const config = GRAPH_CONFIG[view];
	const [visibleKeys, setVisibleKeys] = useState(
		() => new Set(config?.series.map((series) => series.key) ?? [])
	);
	const frozenRef = useRef([]);

	useEffect(() => {
		if (!config) return;
		setVisibleKeys(new Set(config.series.map((series) => series.key)));
	}, [view]);

	const windowedData = useMemo(() => {
		if (!history?.length) return [];
		const latest = history[history.length - 1].timestamp;
		const cutoff = latest - windowSeconds * 1000;
		return history.filter((point) => point.timestamp >= cutoff);
	}, [history, windowSeconds]);

	useEffect(() => {
		if (!paused || frozenRef.current.length === 0) {
			frozenRef.current = windowedData;
		}
	}, [windowedData, paused]);

	const displayData = paused ? frozenRef.current : windowedData;
	const activeSeries = useMemo(() => {
		if (!config) return [];
		return config.series.filter((series) => visibleKeys.has(series.key));
	}, [config, visibleKeys]);
	const seriesToRender = activeSeries.length ? activeSeries : config.series;
	const canFilter = config.series.length > 1;

	const containerClass = stretch
		? "h-full w-full"
		: "h-[320px] w-full sm:h-[360px]";
	const chartClass = stretch
		? "flex-1 min-h-[240px] w-full"
		: "h-[280px] w-full sm:h-[320px]";

	return (
		<div className={`${containerClass} flex flex-col`}>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-white/60">
					{config?.title}
				</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-white/60">
          {canFilter && (
            <button
              type="button"
              onClick={() =>
                setVisibleKeys(new Set(config.series.map((series) => series.key)))
              }
              className="rounded-full border border-black/10 bg-white/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-600 transition hover:border-black/20 dark:border-white/15 dark:bg-white/10 dark:text-white/70 dark:hover:border-white/30"
            >
              All
            </button>
          )}
          {config?.series.map((series) => {
            const isActive = visibleKeys.has(series.key);
            return (
              <button
                type="button"
                key={series.key}
                onClick={() =>
                  setVisibleKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(series.key)) {
                      if (next.size === 1) return prev;
                      next.delete(series.key);
                    } else {
                      next.add(series.key);
                    }
                    return next;
                  })
                }
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  isActive
                    ? "border-black/10 bg-white/20 text-slate-700 shadow-soft dark:border-white/25 dark:bg-white/10 dark:text-white"
                    : "border-black/5 text-slate-400 hover:border-black/15 hover:text-slate-600 dark:border-white/10 dark:text-white/40 dark:hover:border-white/25 dark:hover:text-white/70"
                }`}
              >
                <span
                  className="h-1.5 w-6 rounded-full"
									style={{
										backgroundImage: `linear-gradient(90deg, ${series.gradient[0]}, ${series.gradient[1]})`,
										opacity: isActive ? 1 : 0.35,
									}}
								/>
								{series.label}
							</button>
						);
					})}
          {paused && (
            <span className="rounded-full bg-amber-200/20 px-2 py-1 text-amber-200">
              Paused
            </span>
          )}
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-white/40 md:inline">
            Scroll to zoom • Double-click to reset
          </span>
        </div>
      </div>
			<div className={chartClass}>
				<VisxLineChart
          data={displayData}
          config={config}
          view={view}
          series={seriesToRender}
        />
			</div>
		</div>
	);
};

export default LiveGraph;
