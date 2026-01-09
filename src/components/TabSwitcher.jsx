import { NavLink, useLocation } from "react-router-dom";
import { Activity, Car, Gauge, Rotate3d, Zap } from "lucide-react";
import GlassPanel from "./GlassPanel";

const tabs = [
  { label: "Acceleration", path: "/acceleration", paths: ["/", "/acceleration"], icon: Activity },
  { label: "Rotation", path: "/rotation", icon: Rotate3d },
  { label: "Velocity", path: "/velocity", icon: Gauge },
  { label: "Impact", path: "/impact", icon: Zap },
  { label: "Chassis", path: "/orientation", icon: Car },
];

const TabSwitcher = () => {
  const location = useLocation();

  return (
    <GlassPanel className="px-4 py-3 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.paths?.includes(location.pathname) ?? location.pathname === tab.path;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={() =>
                `group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-white/20 text-slate-900 shadow-[0_0_16px_rgba(0,247,255,0.35)] dark:text-white"
                    : "text-slate-600 hover:bg-white/10 hover:text-slate-900 dark:text-white/70 dark:hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </GlassPanel>
  );
};

export default TabSwitcher;
