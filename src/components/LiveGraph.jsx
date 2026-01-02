import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
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

const OrientationCube = ({ rotation }) => {
	return (
		<Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
			<ambientLight intensity={0.6} />
			<directionalLight position={[2, 4, 3]} intensity={1.1} />
			<mesh rotation={rotation}>
				<boxGeometry args={[1.8, 1.8, 1.8]} />
				<meshStandardMaterial
					color="#c7f9ff"
					emissive="#00f7ff"
					emissiveIntensity={0.35}
					metalness={0.4}
					roughness={0.2}
				/>
			</mesh>
		</Canvas>
	);
};

const VisxLineChart = ({ data, config, view }) => {
  const [tooltip, setTooltip] = useState(null);
  const [zoomDomain, setZoomDomain] = useState(null);

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
				const { min: minY, max: maxY } = getYDomain(data, config.series);

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
								{config.series.map((series) => (
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
									{config.series.map((series) => (
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
										config.series.map((series) => {
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

									{config.series
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
									{config.series.map((series) => (
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
		const rotation = [
			(data?.gx ?? 0) * 0.9,
			(data?.gy ?? 0) * 0.9,
			(data?.gz ?? 0) * 0.9,
		];

		return (
			<div
				className={`flex w-full items-center justify-center ${
					stretch ? "h-full min-h-[320px]" : "h-[320px] sm:h-[360px]"
				}`}
			>
				<div className="h-full w-full overflow-hidden rounded-[24px] border border-white/10 bg-white/5">
					<OrientationCube rotation={rotation} />
				</div>
			</div>
		);
	}

	const config = GRAPH_CONFIG[view];
	const frozenRef = useRef([]);

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
          {config?.series.map((series) => (
            <div key={series.key} className="flex items-center gap-2">
              <span
                className="h-1.5 w-6 rounded-full"
								style={{
									backgroundImage: `linear-gradient(90deg, ${series.gradient[0]}, ${series.gradient[1]})`,
								}}
							/>
							{series.label}
						</div>
					))}
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
				<VisxLineChart data={displayData} config={config} view={view} />
			</div>
		</div>
	);
};

export default LiveGraph;
