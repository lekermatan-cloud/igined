// ════════════════════════════════════════════════════════════════════════
// UI atoms  ·  Small reusable presentational components.
// ════════════════════════════════════════════════════════════════════════
import React from "react";
import { Crown, Briefcase, X } from "lucide-react";

export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" stroke="#c8924a" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="10" fill="#c8924a" fillOpacity="0.15" stroke="#c8924a" strokeWidth="1" />
    <path d="M11 16 L14 19 L21 12" stroke="#c8924a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const StatusPill = ({ status, t }) => {
  const styles = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    trial: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    suspended: "bg-red-500/15 text-red-300 border-red-500/30",
    inactive: "bg-stone-500/15 text-stone-300 border-stone-500/30",
    paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    running: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    draft: "bg-stone-500/15 text-stone-300 border-stone-500/30",
    sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    declined: "bg-red-500/15 text-red-300 border-red-500/30",
    cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
    expired: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  const labels = t?.common || {};
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${styles[status] || styles.inactive}`}>
      {labels[status] || status}
    </span>
  );
};

export const PlanPill = ({ plan, lang }) => {
  const labels = {
    free: lang === "he" ? "חינם" : "Free",
    basic: lang === "he" ? "בסיסי" : "Basic",
    pro: lang === "he" ? "מקצועי" : "Pro",
    enterprise: lang === "he" ? "ארגוני" : "Enterprise",
    comp: lang === "he" ? "חינם מלא ✨" : "Comp ✨"
  };
  const styles = {
    free: "bg-stone-500/15 text-stone-300",
    basic: "bg-stone-500/15 text-stone-300",
    pro: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    enterprise: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    comp: "bg-purple-500/25 text-purple-200 border border-purple-400/50"
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${styles[plan]}`}>
      {plan === "pro" && <Crown className="w-3 h-3" />}
      {plan === "enterprise" && <Briefcase className="w-3 h-3" />}
      {labels[plan]}
    </span>
  );
};

export const RiskPill = ({ score, t }) => {
  const level = score < 35 ? "high" : score < 65 ? "medium" : "low";
  const styles = {
    high: "bg-red-500/15 text-red-300 border-red-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  };
  const labels = { high: t.common.high || "High", medium: t.common.medium || "Med", low: t.common.low || "Low" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
};

export const Avatar = ({ name, size = 36 }) => (
  <div
    className="rounded-full bg-amber-600/15 border border-amber-600/30 flex items-center justify-center text-amber-300 font-medium shrink-0"
    style={{ width: size, height: size, fontSize: size * 0.36 }}
  >
    {name.split(" ").map(p => p[0]).slice(0, 2).join("")}
  </div>
);

export const Sparkline = ({ data, color = "#c8924a", w = 80, h = 24 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h * 0.85 - 2}`
  ).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export const ToastStack = ({ toasts, dismiss }) => (
  <div className="fixed bottom-6 end-6 z-50 space-y-2">
    {toasts.map(toast => {
      const isError = toast.type === "error";
      return (
        <div
          key={toast.id}
          className={`overflow-hidden backdrop-blur border rounded-lg shadow-2xl text-sm min-w-[260px] ${
            isError
              ? "bg-red-950/90 border-red-700/40 text-red-200"
              : "bg-emerald-950/90 border-emerald-700/40 text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1">{toast.msg}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className={isError ? "text-red-200/60 hover:text-red-200" : "text-emerald-200/60 hover:text-emerald-200"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className={`h-0.5 ${isError ? "bg-red-700/40" : "bg-emerald-700/40"}`}
            style={{ animation: "toast-shrink 3s linear" }}
          />
        </div>
      );
    })}
  </div>
);
