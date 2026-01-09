import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, X } from "lucide-react";
import GlassPanel from "./GlassPanel";

const formatCsvValue = (value, column) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (column === "timestamp") return String(value);
  if (!Number.isFinite(value)) return "";
  return value.toFixed(4);
};

const formatCell = (value, column) => {
  if (column === "timestamp") return value ? String(value) : "--";
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(3);
};

const buildCsv = (columns, rows) => {
  const lines = [columns.join(",")];
  rows.forEach((row) => {
    const line = row
      .map((value, index) => formatCsvValue(value, columns[index]))
      .join(",");
    lines.push(line);
  });
  return lines.join("\n");
};

const DataTableModal = ({ isOpen, onClose, history = [], windowedHistory = [], windowSeconds = 30 }) => {
  const [range, setRange] = useState("window");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setRange("window");
      setCopiedId(null);
    }
  }, [isOpen]);

  const activeData = range === "all" ? history : windowedHistory;

  const tables = useMemo(
    () => [
      {
        id: "accel",
        title: "Acceleration (m/s^2)",
        columns: ["timestamp", "ax", "ay", "az"],
        rows: activeData.map((point) => [point.timestamp, point.ax, point.ay, point.az]),
      },
      {
        id: "rotation",
        title: "Rotation (rad/s)",
        columns: ["timestamp", "gx", "gy", "gz"],
        rows: activeData.map((point) => [point.timestamp, point.gx, point.gy, point.gz]),
      },
      {
        id: "velocity",
        title: "Velocity (m/s)",
        columns: ["timestamp", "velocity"],
        rows: activeData.map((point) => [point.timestamp, point.velocity]),
      },
      {
        id: "impact",
        title: "Impact (N)",
        columns: ["timestamp", "impact"],
        rows: activeData.map((point) => [point.timestamp, point.impact]),
      },
    ],
    [activeData]
  );

  const handleCopy = async (table) => {
    const csv = buildCsv(table.columns, table.rows);
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedId(table.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = csv;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(table.id);
      setTimeout(() => setCopiedId(null), 1200);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <GlassPanel className="w-full max-w-5xl p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-white/60">
                  Data Tables
                </p>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  Rows: {activeData.length}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`rounded-full px-3 py-1 text-xs ${
                    range === "window"
                      ? "bg-white/30 text-slate-900 dark:text-white"
                      : "bg-white/10 text-slate-600 hover:bg-white/20 dark:text-white/60"
                  }`}
                  onClick={() => setRange("window")}
                >
                  Window ({windowSeconds}s)
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs ${
                    range === "all"
                      ? "bg-white/30 text-slate-900 dark:text-white"
                      : "bg-white/10 text-slate-600 hover:bg-white/20 dark:text-white/60"
                  }`}
                  onClick={() => setRange("all")}
                >
                  All time
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/10 text-slate-700 dark:border-white/10 dark:text-white/80"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className="rounded-2xl border border-black/10 bg-white/5 dark:border-white/10"
                >
                  <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:text-white/50">
                    <span>{table.title}</span>
                    <button
                      className="flex items-center gap-2 rounded-full border border-black/10 bg-white/10 px-2.5 py-1 text-[10px] text-slate-600 dark:border-white/10 dark:text-white/70"
                      onClick={() => handleCopy(table)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === table.id ? "Copied" : "Copy CSV"}
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {table.rows.length ? (
                      <table className="min-w-full text-xs">
                        <thead className="sticky top-0 bg-white/80 text-[10px] uppercase tracking-[0.2em] text-slate-500 backdrop-blur dark:bg-slate-950/80 dark:text-white/50">
                          <tr>
                            {table.columns.map((column) => (
                              <th key={column} className="px-3 py-2 text-left">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-slate-600 dark:text-white/70">
                          {table.rows.map((row, rowIndex) => (
                            <tr
                              key={`${table.id}-${rowIndex}`}
                              className={rowIndex % 2 === 0 ? "bg-white/5" : "bg-transparent"}
                            >
                              {row.map((value, columnIndex) => (
                                <td key={`${table.id}-${rowIndex}-${columnIndex}`} className="px-3 py-2">
                                  {formatCell(value, table.columns[columnIndex])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-4 py-6 text-sm text-slate-500 dark:text-white/60">
                        No data in this range.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DataTableModal;
