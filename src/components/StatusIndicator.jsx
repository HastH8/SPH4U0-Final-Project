const StatusIndicator = ({ isConnected, isStreaming }) => {
  const statusLabel = isConnected ? "WS Connected" : "WS Disconnected";
  const detailLabel = isConnected ? (isStreaming ? "Streaming" : "No Data") : "Offline";
  const dotClass = isConnected
    ? isStreaming
      ? "bg-neon-green shadow-[0_0_10px_rgba(91,255,176,0.9)] animate-pulse"
      : "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]"
    : "bg-rose-400";

  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-600 dark:text-white/80">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <div className="flex flex-col">
        <span>{statusLabel}</span>
        <span className="text-[10px] text-slate-500 dark:text-white/50">{detailLabel}</span>
      </div>
    </div>
  );
};

export default StatusIndicator;
