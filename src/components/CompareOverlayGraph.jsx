import { useMemo, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { curveMonotoneX } from "@visx/curve";

const GRAPH_CONFIG = {
	acceleration: {
		title: "Acceleration Comparison",
		series: [
			{ key: "ax", label: "X", colorA: "#00f7ff", colorB: "#0051ff" },
			{ key: "ay", label: "Y", colorA: "#ff4fd8", colorB: "#b100ff" },
			{ key: "az", label: "Z", colorA: "#5bffb0", colorB: "#0bd1b7" },
		],
	},
	rotation: {
		title: "Rotation Comparison",
		series: [
			{ key: "gx", label: "X", colorA: "#ffd166", colorB: "#f77f00" },
			{ key: "gy", label: "Y", colorA: "#7bdff2", colorB: "#5390d9" },
			{ key: "gz", label: "Z", colorA: "#80ed99", colorB: "#38b000" },
		],
	},
	velocity: {
		title: "Velocity Comparison",
		series: [
			{
				key: "velocity",
				label: "Velocity",
				colorA: "#5bffb0",
				colorB: "#00f7ff",
			},
		],
	},
	impact: {
		title: "Impact Comparison",
		series: [
			{ key: "impact", label: "Impact", colorA: "#ff4fd8", colorB: "#ff6b6b" },
		],
	},
};

const CHART_MARGIN = { top: 12, right: 18, bottom: 30, left: 44 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getYDomain = (dataA, dataB, series) => {
	const values = [];
	[dataA, dataB].forEach((dataset) => {
		dataset.forEach((point) => {
			series.forEach((entry) => {
				const value = point?.[entry.key];
				if (Number.isFinite(value)) {
					values.push(value);
				}
			});
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

const CompareOverlayGraph = ({ view, dataA = [], dataB = [], stretch = false }) => {
	const config = GRAPH_CONFIG[view];
	const [tooltip, setTooltip] = useState(null);
	const [zoomDomain, setZoomDomain] = useState(null);

	const indexedDataA = useMemo(
		() => dataA.map((point, index) => ({ ...point, index })),
		[dataA]
	);
	const indexedDataB = useMemo(
		() => dataB.map((point, index) => ({ ...point, index })),
		[dataB]
	);

	if (!config) {
		return null;
	}

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
					{config.title}
				</p>
				<div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-white/60">
					{config.series.map((series) => (
						<div key={series.key} className="flex items-center gap-2">
							<span
								className="h-1.5 w-5 rounded-full"
								style={{ backgroundColor: series.colorA }}
							/>
							<span
								className="h-1.5 w-5 rounded-full"
								style={{
									backgroundImage: `repeating-linear-gradient(90deg, ${series.colorB} 0 6px, transparent 6px 10px)`,
								}}
							/>
							{series.label}
						</div>
					))}
					<span className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-white/40 md:inline">
						Scroll to zoom • Double-click to reset
					</span>
				</div>
			</div>
			<div className={chartClass}>
				<ParentSize>
					{({ width, height }) => {
						if (width < 10 || height < 10) {
							return null;
						}

						const innerWidth = width - CHART_MARGIN.left - CHART_MARGIN.right;
						const innerHeight = height - CHART_MARGIN.top - CHART_MARGIN.bottom;
						const maxLength = Math.max(
							indexedDataA.length,
							indexedDataB.length
						);
						const safeMax = maxLength > 1 ? maxLength - 1 : 1;
						const { min: minY, max: maxY } = getYDomain(
							indexedDataA,
							indexedDataB,
							config.series
						);

						const fullDomain = { start: 0, end: safeMax };
						const zoomStart = zoomDomain
							? Math.max(fullDomain.start, zoomDomain.start)
							: fullDomain.start;
						const zoomEnd = zoomDomain
							? Math.min(fullDomain.end, zoomDomain.end)
							: fullDomain.end;
						const activeDomain =
							zoomEnd > zoomStart ? { start: zoomStart, end: zoomEnd } : fullDomain;

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
							const bounds = event.currentTarget.getBoundingClientRect();
							const x = event.clientX - bounds.left - CHART_MARGIN.left;
							if (x < 0 || x > innerWidth) {
								setTooltip(null);
								return;
							}
							const index = Math.round(xScale.invert(x));
							const pointA = indexedDataA[index];
							const pointB = indexedDataB[index];
							if (!pointA && !pointB) {
								setTooltip(null);
								return;
							}
							setTooltip({ index, x: xScale(index), pointA, pointB });
						};

						const handleWheel = (event) => {
							event.preventDefault();
							const bounds = event.currentTarget.getBoundingClientRect();
							const x = event.clientX - bounds.left - CHART_MARGIN.left;
							if (x < 0 || x > innerWidth) return;
							const focusValue = xScale.invert(x);
							const currentRange = activeDomain.end - activeDomain.start;
							const fullRange = fullDomain.end - fullDomain.start;
							const minRange = Math.max(4, fullRange * 0.1);
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
							setZoomDomain(
								nextRange >= fullRange ? null : { start: nextStart, end: nextEnd }
							);
						};

						return (
							<div className="relative h-full w-full">
								<svg width={width} height={height} className="overflow-visible">
									<defs>
										<clipPath id={`${view}-compare-clip`}>
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
											tickLabelProps={() => ({
												fill: "var(--axis-text)",
												fontSize: 10,
												textAnchor: "middle",
												dy: 8,
											})}
										/>

										<Group clipPath={`url(#${view}-compare-clip)`}>
											{config.series.map((series) => (
												<LinePath
													key={`a-${series.key}`}
													data={indexedDataA}
													x={(point) => xScale(point.index)}
													y={(point) => yScale(point[series.key])}
													curve={curveMonotoneX}
													stroke={series.colorA}
													strokeWidth={2.4}
													strokeLinecap="round"
													strokeLinejoin="round"
													style={{
														filter: `drop-shadow(0 0 10px ${series.colorA}55)`,
													}}
												/>
											))}
											{config.series.map((series) => (
												<LinePath
													key={`b-${series.key}`}
													data={indexedDataB}
													x={(point) => xScale(point.index)}
													y={(point) => yScale(point[series.key])}
													curve={curveMonotoneX}
													stroke={series.colorB}
													strokeWidth={2}
													strokeDasharray="6 5"
													strokeLinecap="round"
													strokeLinejoin="round"
													style={{
														filter: `drop-shadow(0 0 8px ${series.colorB}55)`,
													}}
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
													const aValue = tooltip.pointA?.[series.key];
													const bValue = tooltip.pointB?.[series.key];
													return (
														<g key={`hover-${series.key}`}>
															{Number.isFinite(aValue) && (
																<circle
																	cx={tooltip.x}
																	cy={yScale(aValue)}
																	r={4}
																	fill={series.colorA}
																	stroke="rgba(255,255,255,0.9)"
																	strokeWidth={1.5}
																/>
															)}
															{Number.isFinite(bValue) && (
																<circle
																	cx={tooltip.x}
																	cy={yScale(bValue)}
																	r={4}
																	fill={series.colorB}
																	stroke="rgba(255,255,255,0.9)"
																	strokeWidth={1.5}
																/>
															)}
														</g>
													);
												})}

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
												Math.min(CHART_MARGIN.left + tooltip.x + 12, width - 200)
											),
											top: CHART_MARGIN.top + 12,
										}}
									>
										<div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
											Sample #{tooltip.index + 1}
										</div>
										{config.series.map((series) => (
											<div
												key={`tooltip-${series.key}`}
												className="flex items-center gap-2"
											>
												<span
													className="h-2 w-2 rounded-full"
													style={{ backgroundColor: series.colorA }}
												/>
												<span className="text-white/70">{series.label}</span>
												<span className="ml-auto font-semibold text-white">
													{Number.isFinite(tooltip.pointA?.[series.key])
														? tooltip.pointA[series.key].toFixed(2)
														: "--"}
												</span>
												<span className="text-white/40">|</span>
												<span className="font-semibold text-white/80">
													{Number.isFinite(tooltip.pointB?.[series.key])
														? tooltip.pointB[series.key].toFixed(2)
														: "--"}
												</span>
											</div>
										))}
									</div>
								)}
							</div>
						);
					}}
				</ParentSize>
			</div>
		</div>
	);
};

export default CompareOverlayGraph;
