const GlassPanel = ({ children, className = "" }) => {
  return (
    <div
      className={`rounded-[24px] border border-black/10 bg-glass-light text-slate-900 shadow-soft backdrop-blur-glass dark:border-white/15 dark:bg-glass-dark dark:text-white ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
