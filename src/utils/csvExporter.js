const escapeCSVValue = (value) => {
  const text = value == null ? "" : String(value);
  if (/["\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatNumber = (value, decimals) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  return Number(value).toFixed(decimals);
};

export const exportHistoryToCSV = (history, filenameOrOptions = "imu-history.csv") => {
  if (!history?.length) {
    return;
  }

  const options =
    typeof filenameOrOptions === "string" ? { filename: filenameOrOptions } : filenameOrOptions ?? {};

  const {
    filename = "imu-history.csv",
    decimals = 4,
    includeISO = true,
    includeSeconds = true,
    includeOrientation = true,
  } = options;

  const baseTimestamp = history[0]?.timestamp ?? Date.now();

  const columns = [
    {
      label: "Timestamp (ms)",
      value: (entry) => entry.timestamp ?? "",
    },
    includeISO && {
      label: "Time (ISO)",
      value: (entry) => new Date(entry.timestamp ?? Date.now()).toISOString(),
    },
    includeSeconds && {
      label: "t (s)",
      value: (entry) => formatNumber(((entry.timestamp ?? baseTimestamp) - baseTimestamp) / 1000, decimals),
    },
    { label: "ax (m/s^2)", value: (entry) => formatNumber(entry.ax, decimals) },
    { label: "ay (m/s^2)", value: (entry) => formatNumber(entry.ay, decimals) },
    { label: "az (m/s^2)", value: (entry) => formatNumber(entry.az, decimals) },
    { label: "gx (rad/s)", value: (entry) => formatNumber(entry.gx, decimals) },
    { label: "gy (rad/s)", value: (entry) => formatNumber(entry.gy, decimals) },
    { label: "gz (rad/s)", value: (entry) => formatNumber(entry.gz, decimals) },
    { label: "Velocity (m/s)", value: (entry) => formatNumber(entry.velocity, decimals) },
    { label: "Impact (m/s^2)", value: (entry) => formatNumber(entry.impact, decimals) },
    includeOrientation && { label: "Roll (deg)", value: (entry) => formatNumber(entry.roll, decimals) },
    includeOrientation && { label: "Pitch (deg)", value: (entry) => formatNumber(entry.pitch, decimals) },
    includeOrientation && { label: "Yaw (deg)", value: (entry) => formatNumber(entry.yaw, decimals) },
  ].filter(Boolean);

  const header = columns.map((col) => escapeCSVValue(col.label)).join(",");
  const rows = history.map((entry) => columns.map((col) => escapeCSVValue(col.value(entry))).join(","));

  const csvContent = [header, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
