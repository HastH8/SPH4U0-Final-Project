export const createPeakDetector = (threshold, cooldownMs = 900) => {
  let lastTrigger = 0;
  let lastValue = 0;

  return (impact) => {
    const now = Date.now();
    const isPeak = impact >= threshold && lastValue < threshold && now - lastTrigger > cooldownMs;
    lastValue = impact;
    if (isPeak) {
      lastTrigger = now;
    }
    return isPeak;
  };
};
