const StatusIndicator = ({ isConnected }) => {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-600 dark:text-white/80">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isConnected ? "bg-neon-green shadow-[0_0_10px_rgba(91,255,176,0.9)]" : "bg-rose-400"
        } ${isConnected ? "animate-pulse" : ""}`}
      />
      {isConnected ? "Connected" : "Disconnected"}
    </div>
  );
};

export default StatusIndicator;
