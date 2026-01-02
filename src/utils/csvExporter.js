export const exportHistoryToCSV = (history, filename = "imu-history.csv") => {
  if (!history?.length) {
    return;
  }

  const header = "timestamp,ax,ay,az,gx,gy,gz,velocity,impact";
  const rows = history.map((entry) => {
    const values = [
      entry.timestamp,
      entry.ax,
      entry.ay,
      entry.az,
      entry.gx,
      entry.gy,
      entry.gz,
      entry.velocity,
      entry.impact,
    ];
    return values.join(",");
  });

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
