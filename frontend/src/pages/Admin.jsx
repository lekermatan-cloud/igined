// ════════════════════════════════════════════════════════════════════════
// Admin pages  ·  Administrator-only console.
//   · AdminOverview      — MRR, ARR, active customers, churn, charts
//   · AdminCustomers     — full customer table with filters and actions
//   · AdminAtRisk        — churn-risk customers + retention triggers
//   · AdminAutomation    — email automation flows (welcome, abandonment, etc.)
//   · AdminCampaigns     — broadcast email campaigns
//   · AdminCohorts       — retention cohort heatmap
//   · AdminSupport       — support ticket inbox
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Users, UserCheck, UserX, Activity,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Search, Filter,
  MoreHorizontal, Pause, Play, Mail, Inbox, Headphones, Workflow,
  Megaphone, BarChart3, PieChart, Repeat, MailCheck, MailWarning,
  PlayCircle, PauseCircle, ChevronRight, Calendar, Bell, Plus,
  Flame, Target, Sparkle, Send
} from "lucide-react";
import { Avatar, StatusPill, PlanPill, RiskPill, Sparkline } from "../components/UI.jsx";
import { fmtMoney, fmtPct } from "../lib.js";
import { MOCK_CAMPAIGNS, MOCK_TICKETS, REVENUE_TREND, COHORT_DATA } from "../mockData.js";

function AdminOverview({ ctx }) {
  const { t, lang, fontStack, monoFont, customers } = ctx;

  const metrics = useMemo(() => {
    const active = customers.filter(c => c.status === "active");
    const trial = customers.filter(c => c.status === "trial");
    const totalUSD = active.reduce((s, c) => s + (c.currency === "USD" ? c.mrr : c.mrr * 0.27), 0);
    const totalILS = active.reduce((s, c) => s + (c.currency === "ILS" ? c.mrr : c.mrr * 3.7), 0);
    const byPlan = {
      basic: active.filter(c => c.plan === "basic").length,
      pro: active.filter(c => c.plan === "pro").length,
      enterprise: active.filter(c => c.plan === "enterprise").length
    };
    return { active: active.length, trial: trial.length, totalUSD, totalILS, byPlan };
  }, [customers]);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Admin Console
        </div>
        <h1 style={{ fontFamily: fontStack }} className="text-4xl font-light text-amber-50">{t.admin.welcome}</h1>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={t.admin.mrr} value={`$${Math.round(metrics.totalUSD).toLocaleString()}`} sub={`₪${Math.round(metrics.totalILS).toLocaleString()}`} delta="+18.2%" deltaPositive icon={DollarSign} color="#c8924a" {...{ fontStack, monoFont }} />
        <MetricCard label={t.admin.arr} value={`$${Math.round(metrics.totalUSD * 12).toLocaleString()}`} sub={t.admin.thisMonth} delta="+24.1%" deltaPositive icon={TrendingUp} color="#7fa089" {...{ fontStack, monoFont }} />
        <MetricCard label={t.admin.activeCustomers} value={metrics.active} sub={`${metrics.trial} ${t.common.trial.toLowerCase()}`} delta="+5" deltaPositive icon={Users} color="#7a9eb0" {...{ fontStack, monoFont }} />
        <MetricCard label={t.admin.churnRate} value="2.1%" sub={t.admin.vsLast} delta="-0.4%" deltaPositive icon={Activity} color="#9b7da3" {...{ fontStack, monoFont }} />
      </div>

      {/* LTV / CAC row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={t.admin.ltv} value="$2,847" sub={lang === "he" ? "ממוצע" : "average"} delta="+11%" deltaPositive icon={Target} color="#c8924a" {...{ fontStack, monoFont }} />
        <MetricCard label={t.admin.cac} value="$72" sub={lang === "he" ? "פחות = יותר טוב" : "lower is better"} delta="-8%" deltaPositive icon={Banknote} color="#7fa089" {...{ fontStack, monoFont }} />
        <MetricCard label="LTV / CAC" value="39.5x" sub={lang === "he" ? "יחס בריא: ≥ 3x" : "healthy: ≥ 3x"} delta="+18%" deltaPositive icon={Repeat} color="#c8924a" {...{ fontStack, monoFont }} />
        <MetricCard label={lang === "he" ? "פעיל יומי" : "DAU"} value="284" sub={lang === "he" ? "מתוך פעילים" : "of actives"} delta="+12" deltaPositive icon={Flame} color="#a6926e" {...{ fontStack, monoFont }} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-amber-900/30 rounded-lg p-5 bg-black/20">
          <div className="flex items-center justify-between mb-5">
            <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50">{lang === "he" ? "צמיחת הכנסות" : "Revenue growth"}</h3>
            <span className="text-xs text-amber-100/40" style={{ fontFamily: monoFont }}>USD · 12 mo</span>
          </div>
          <RevenueChart data={REVENUE_TREND} monoFont={monoFont} />
        </div>
        <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20">
          <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50 mb-5">{t.admin.revByPlan}</h3>
          <div className="space-y-4">
            {[
              { name: lang === "he" ? "בסיסי" : "Basic", count: metrics.byPlan.basic, color: "#a6926e" },
              { name: lang === "he" ? "מקצועי" : "Pro", count: metrics.byPlan.pro, color: "#c8924a" },
              { name: lang === "he" ? "ארגוני" : "Enterprise", count: metrics.byPlan.enterprise, color: "#9b7da3" }
            ].map((p, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-sm text-amber-100">{p.name}</span>
                  <span className="text-xs text-amber-100/50" style={{ fontFamily: monoFont }}>{p.count}</span>
                </div>
                <div className="h-1.5 bg-amber-900/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.count / metrics.active) * 100}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <section>
        <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50 mb-4">{t.admin.recentActivity}</h3>
        <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
          {customers.slice(0, 6).map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10 last:border-0">
              <Avatar name={c.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-amber-50 truncate">{c.name}</div>
                <div className="text-xs text-amber-100/40 truncate" style={{ fontFamily: monoFont }} dir="ltr">{c.email}</div>
              </div>
              <PlanPill plan={c.plan} lang={lang} />
              <StatusPill status={c.status} t={t} />
              <span className="text-sm text-amber-50 shrink-0 hidden md:block" style={{ fontFamily: monoFont }}>
                {fmtMoney(c.mrr, c.currency)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const MetricCard = ({ label, value, sub, delta, deltaPositive, icon: Icon, color, fontStack, monoFont }) => (
  <div className="border border-amber-900/30 rounded-lg p-5 bg-gradient-to-br from-white/[0.02] to-transparent">
    <div className="flex items-center justify-between mb-3">
      <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      {delta && (
        <span className={`text-xs flex items-center gap-0.5 ${deltaPositive ? "text-emerald-400" : "text-red-400"}`} style={{ fontFamily: monoFont }}>
          {deltaPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {delta}
        </span>
      )}
    </div>
    <div className="text-[11px] uppercase tracking-wider text-amber-300/50 mb-1">{label}</div>
    <div style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 leading-tight">{value}</div>
    {sub && <div className="text-xs text-amber-100/40 mt-1" style={{ fontFamily: monoFont }}>{sub}</div>}
  </div>
);

const RevenueChart = ({ data, monoFont }) => {
  const max = Math.max(...data);
  const w = 600, h = 200;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.85 - 10}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44">
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8924a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#c8924a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,1,2,3].map(i => <line key={i} x1="0" x2={w} y1={(i*h)/3} y2={(i*h)/3} stroke="#c8924a" strokeOpacity="0.08" strokeDasharray="2 4" />)}
        <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#rev-grad)" />
        <polyline points={points} fill="none" stroke="#c8924a" strokeWidth="2" strokeLinejoin="round" />
        {data.map((v, i) => <circle key={i} cx={(i / (data.length-1))*w} cy={h - (v/max)*h*0.85 - 10} r="3" fill="#c8924a" />)}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-amber-100/40" style={{ fontFamily: monoFont }}>
        {["Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May"].map(m => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   ADMIN : Customers
   ════════════════════════════════════════════════════════════════════════ */
function AdminCustomers({ ctx }) {
  const { t, lang, fontStack, monoFont, customers, setCustomers, showToast } = ctx;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = customers.filter(c => {
    const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.plan.includes(search.toLowerCase());
    const mf = filter === "all" || c.status === filter || c.plan === filter;
    return ms && mf;
  });

  const toggleStatus = id => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newStatus = c.status === "active" ? "suspended" : "active";
      showToast(newStatus === "suspended" ? t.toasts.customerSuspended : t.toasts.customerActivated);
      return { ...c, status: newStatus };
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> Admin Console
          </div>
          <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">{t.admin.customers.title}</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-md text-sm font-medium">
          <Plus className="w-4 h-4" /> {t.admin.customers.addCustomer}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-amber-100/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.admin.customers.search}
            className="w-full bg-black/40 border border-amber-900/30 rounded-md ps-10 pe-3 py-2.5 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
          />
        </div>
        <div className="flex border border-amber-900/30 rounded-md overflow-hidden bg-black/30">
          {[
            { v: "all", l: t.common.all },
            { v: "active", l: t.common.active },
            { v: "trial", l: t.common.trial },
            { v: "suspended", l: t.common.suspended }
          ].map(o => (
            <button key={o.v} onClick={() => setFilter(o.v)} className={`px-3 py-2 text-xs ${filter === o.v ? "bg-amber-600/20 text-amber-200" : "text-amber-100/50 hover:text-amber-100"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 border-b border-amber-900/30">
              <tr className="text-[11px] uppercase tracking-wider text-amber-300/60">
                <th className="px-4 py-3 text-start font-medium">{lang === "he" ? "לקוח" : "Customer"}</th>
                <th className="px-4 py-3 text-start font-medium hidden md:table-cell">{lang === "he" ? "תוכנית" : "Plan"}</th>
                <th className="px-4 py-3 text-start font-medium hidden lg:table-cell">MRR</th>
                <th className="px-4 py-3 text-start font-medium">{lang === "he" ? "סטטוס" : "Status"}</th>
                <th className="px-4 py-3 text-start font-medium hidden lg:table-cell">{lang === "he" ? "הצטרף" : "Joined"}</th>
                <th className="px-4 py-3 text-start font-medium hidden md:table-cell">{lang === "he" ? "מסמכים" : "Docs"}</th>
                <th className="px-4 py-3 text-end font-medium">{lang === "he" ? "פעולות" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-amber-900/10 last:border-0 hover:bg-amber-950/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size={32} />
                      <div className="min-w-0">
                        <div className="text-amber-50 truncate">{c.name}</div>
                        <div className="text-xs text-amber-100/40 truncate" style={{ fontFamily: monoFont }} dir="ltr">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell"><PlanPill plan={c.plan} lang={lang} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-amber-100" style={{ fontFamily: monoFont }}>{fmtMoney(c.mrr, c.currency)}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} t={t} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-amber-100/60 text-xs" style={{ fontFamily: monoFont }}>{c.joined}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-amber-100" style={{ fontFamily: monoFont }}>{c.docs}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleStatus(c.id)} title={c.status === "active" ? t.admin.customers.suspend : t.admin.customers.activate} className="p-1.5 rounded hover:bg-amber-600/15 text-amber-100/60 hover:text-amber-200">
                        {c.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button title={lang === "he" ? "מייל" : "Email"} className="p-1.5 rounded hover:bg-amber-600/15 text-amber-100/60 hover:text-amber-200"><Mail className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded hover:bg-amber-600/15 text-amber-100/60 hover:text-amber-200"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-12 text-center text-amber-100/40">{t.common.noResults}</div>}
        </div>
        <div className="px-4 py-3 border-t border-amber-900/20 flex items-center justify-between text-xs text-amber-100/50">
          <span>{filtered.length} / {customers.length}</span>
          <span style={{ fontFamily: monoFont }}>USD · ILS auto-converted</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ADMIN : At-Risk (Churn Prevention)
   ════════════════════════════════════════════════════════════════════════ */
function AdminAtRisk({ ctx }) {
  const { t, lang, fontStack, monoFont, customers, showToast } = ctx;
  const atRisk = customers
    .filter(c => c.status === "active" && c.health < 65)
    .sort((a, b) => a.health - b.health);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Admin Console
        </div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.admin.atRisk.title}</h1>
        <p className="text-amber-100/60 text-sm">{t.admin.atRisk.subtitle}</p>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t.admin.atRisk.riskHigh, count: atRisk.filter(c => c.health < 35).length, color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/30" },
          { label: t.admin.atRisk.riskMed, count: atRisk.filter(c => c.health >= 35 && c.health < 65).length, color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30" },
          { label: lang === "he" ? "מוצלח" : "Healthy", count: customers.filter(c => c.status === "active" && c.health >= 65).length, color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/30" }
        ].map((s, i) => (
          <div key={i} className={`${s.bg} ${s.border} border rounded-lg p-4`}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: s.color }}>{s.label}</div>
            <div className="text-3xl font-light" style={{ color: s.color, fontFamily: fontStack }}>{s.count}</div>
          </div>
        ))}
      </div>

      <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 border-b border-amber-900/30">
              <tr className="text-[11px] uppercase tracking-wider text-amber-300/60">
                <th className="px-4 py-3 text-start font-medium">{lang === "he" ? "לקוח" : "Customer"}</th>
                <th className="px-4 py-3 text-start font-medium">{t.admin.atRisk.score}</th>
                <th className="px-4 py-3 text-start font-medium hidden md:table-cell">{t.admin.atRisk.lastActive}</th>
                <th className="px-4 py-3 text-start font-medium hidden lg:table-cell">MRR</th>
                <th className="px-4 py-3 text-start font-medium">{lang === "he" ? "סיכון" : "Risk"}</th>
                <th className="px-4 py-3 text-end font-medium">{t.admin.atRisk.action}</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map(c => (
                <tr key={c.id} className="border-b border-amber-900/10 last:border-0 hover:bg-amber-950/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size={32} />
                      <div className="min-w-0">
                        <div className="text-amber-50 truncate">{c.name}</div>
                        <div className="text-xs text-amber-100/40 truncate" style={{ fontFamily: monoFont }} dir="ltr">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-amber-900/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.health}%`, background: c.health < 35 ? "#ef4444" : c.health < 65 ? "#f59e0b" : "#10b981" }} />
                      </div>
                      <span className="text-xs" style={{ fontFamily: monoFont, color: c.health < 35 ? "#ef4444" : c.health < 65 ? "#f59e0b" : "#10b981" }}>{c.health}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-amber-100/70 text-xs" style={{ fontFamily: monoFont }}>
                    {c.lastActive === 0 ? t.common.today : `${c.lastActive}d`}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-amber-100" style={{ fontFamily: monoFont }}>{fmtMoney(c.mrr, c.currency)}</td>
                  <td className="px-4 py-3"><RiskPill score={c.health} t={t} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => showToast(t.toasts.reengagementSent)}
                        className="px-2 py-1 text-[11px] bg-amber-600/15 hover:bg-amber-600/25 text-amber-200 rounded border border-amber-600/30"
                      >
                        <MailCheck className="w-3 h-3 inline me-1" />
                        {lang === "he" ? "שלח" : "Re-engage"}
                      </button>
                      <button className="p-1 text-amber-100/50 hover:text-amber-100"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {atRisk.length > 0 && (
        <div className="border border-amber-600/30 rounded-lg p-5 bg-gradient-to-br from-amber-950/20 to-transparent">
          <div className="flex items-start gap-3">
            <Sparkle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm text-amber-50 mb-1">{lang === "he" ? "פעולה אוטומטית מומלצת" : "Recommended automated action"}</h3>
              <p className="text-xs text-amber-100/60 mb-3">
                {lang === "he"
                  ? `שלח קמפיין החזרה ל-${atRisk.length} לקוחות בסיכון. הוכח שמחזיר כ-23% מהם.`
                  : `Send re-engagement campaign to ${atRisk.length} at-risk customers. Proven to recover ~23% of them.`}
              </p>
              <button
                onClick={() => showToast(t.toasts.reengagementSent)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> {lang === "he" ? "הפעל קמפיין אוטומטי" : "Trigger automated campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ADMIN : Email Automation Builder
   ════════════════════════════════════════════════════════════════════════ */
function AdminAutomation({ ctx }) {
  const { t, lang, fontStack, monoFont, flows, setFlows, showToast } = ctx;

  const toggle = id => {
    setFlows(prev => prev.map(f => {
      if (f.id !== id) return f;
      const next = { ...f, active: !f.active };
      showToast(next.active ? t.toasts.flowEnabled : t.toasts.flowDisabled);
      return next;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" /> Admin Console
          </div>
          <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.admin.automation.title}</h1>
          <p className="text-amber-100/60 text-sm flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-amber-400" />
            {t.admin.automation.subtitle}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-md text-sm font-medium">
          <Plus className="w-4 h-4" /> {t.admin.automation.newFlow}
        </button>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t.admin.automation.stats.sent, value: flows.reduce((s, f) => s + f.sent, 0).toLocaleString(), icon: Send },
          { label: t.admin.automation.stats.opens, value: "54.2%", icon: MailCheck },
          { label: t.admin.automation.stats.clicks, value: "18.4%", icon: MoveRight },
          { label: t.admin.automation.stats.conversions, value: "9.7%", icon: Target }
        ].map((s, i) => (
          <div key={i} className="border border-amber-900/30 rounded-lg p-4 bg-black/20">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-300/60 uppercase tracking-wider">{s.label}</span>
            </div>
            <div style={{ fontFamily: fontStack }} className="text-2xl font-light text-amber-50">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Flows */}
      <div className="space-y-3">
        {flows.map(f => {
          const flow = t.admin.automation.flows[f.id];
          return (
            <div key={f.id} className={`border rounded-lg p-5 transition-all ${f.active ? "border-amber-600/40 bg-gradient-to-br from-amber-950/15 to-transparent" : "border-amber-900/20 bg-black/20"}`}>
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${f.active ? "bg-amber-600/15 border border-amber-600/40" : "bg-stone-700/20 border border-stone-700/40"}`}>
                  <Workflow className={`w-5 h-5 ${f.active ? "text-amber-400" : "text-stone-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50">{flow.name}</h3>
                    <StatusPill status={f.active ? "active" : "paused"} t={t} />
                    <span className="text-[11px] text-amber-100/50 flex items-center gap-1" style={{ fontFamily: monoFont }}>
                      <Layers className="w-3 h-3" /> {f.steps} {t.admin.automation.flowSteps}
                    </span>
                  </div>
                  <p className="text-sm text-amber-100/60 mb-3">{flow.desc}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-amber-300/50">{t.admin.automation.trigger}:</span>
                    <code className="text-[11px] bg-amber-900/20 text-amber-300 px-2 py-0.5 rounded" style={{ fontFamily: monoFont }}>{flow.trigger}</code>
                  </div>
                </div>
                <div className="hidden md:grid grid-cols-3 gap-4 text-xs shrink-0">
                  <Stat3 label={t.admin.automation.stats.sent} value={f.sent.toLocaleString()} {...{ monoFont }} />
                  <Stat3 label={t.admin.automation.stats.opens} value={fmtPct(f.opens)} color="#10b981" {...{ monoFont }} />
                  <Stat3 label={t.admin.automation.stats.conversions} value={fmtPct(f.conversions)} color="#c8924a" {...{ monoFont }} />
                </div>
                <button onClick={() => toggle(f.id)} className="shrink-0 p-2 hover:bg-amber-600/15 rounded">
                  {f.active ? <PauseCircle className="w-5 h-5 text-amber-400" /> : <PlayCircle className="w-5 h-5 text-stone-400" />}
                </button>
              </div>

              {/* Flow steps preview */}
              {f.active && (
                <div className="mt-4 pt-4 border-t border-amber-900/20 flex items-center gap-1.5 overflow-x-auto">
                  {Array.from({ length: f.steps }).map((_, i) => (
                    <React.Fragment key={i}>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-amber-900/30 rounded text-xs whitespace-nowrap">
                        <Mail className="w-3 h-3 text-amber-400" />
                        <span className="text-amber-100/80">
                          {i === 0 ? (lang === "he" ? "מיידי" : "Instant") : `+${i * (f.id === "welcome" ? 2 : f.id === "trial" ? 1 : 7)}d`}
                        </span>
                      </div>
                      {i < f.steps - 1 && <ChevronRight className="w-3 h-3 text-amber-100/30 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Stat3 = ({ label, value, color, monoFont }) => (
  <div>
    <div className="text-[10px] text-amber-100/40 uppercase tracking-wider">{label}</div>
    <div className="text-sm" style={{ fontFamily: monoFont, color: color || "#fef3c7" }}>{value}</div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   ADMIN : Campaigns
   ════════════════════════════════════════════════════════════════════════ */
function AdminCampaigns({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast } = ctx;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.admin.campaigns.title}</h1>
          <p className="text-amber-100/60 text-sm">{t.admin.campaigns.subtitle}</p>
        </div>
        <button onClick={() => showToast(t.toasts.campaignSent)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-md text-sm font-medium">
          <Plus className="w-4 h-4" /> {t.admin.campaigns.new}
        </button>
      </div>

      <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 border-b border-amber-900/30">
              <tr className="text-[11px] uppercase tracking-wider text-amber-300/60">
                <th className="px-4 py-3 text-start font-medium">{lang === "he" ? "קמפיין" : "Campaign"}</th>
                <th className="px-4 py-3 text-start font-medium hidden md:table-cell">{t.admin.campaigns.recipient}</th>
                <th className="px-4 py-3 text-start font-medium hidden md:table-cell">{t.admin.campaigns.sentAt}</th>
                <th className="px-4 py-3 text-start font-medium">{t.admin.campaigns.openRate}</th>
                <th className="px-4 py-3 text-start font-medium">{lang === "he" ? "סטטוס" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CAMPAIGNS.map(c => (
                <tr key={c.id} className="border-b border-amber-900/10 last:border-0 hover:bg-amber-950/10">
                  <td className="px-4 py-3 text-amber-50">{c.name[lang]}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-amber-100" style={{ fontFamily: monoFont }}>{c.recipients.toLocaleString()}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-amber-100/60" style={{ fontFamily: monoFont }}>{c.sentAt || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-amber-900/20 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${c.openRate * 100}%` }} />
                      </div>
                      <span className="text-xs" style={{ fontFamily: monoFont }}>{fmtPct(c.openRate)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={c.status} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ADMIN : Cohort Retention
   ════════════════════════════════════════════════════════════════════════ */
function AdminCohorts({ ctx }) {
  const { t, lang, fontStack, monoFont } = ctx;
  const cellColor = (v) => {
    if (v == null) return "transparent";
    const intensity = v / 100;
    return `rgba(200, 146, 74, ${0.1 + intensity * 0.7})`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.admin.cohorts.title}</h1>
        <p className="text-amber-100/60 text-sm">{t.admin.cohorts.subtitle}</p>
      </div>

      <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20 overflow-x-auto">
        <table className="w-full text-sm" dir="ltr">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-amber-300/60">
              <th className="px-3 py-2 text-start">Cohort</th>
              <th className="px-3 py-2 text-start">Users</th>
              {[0,1,2,3,4,5].map(i => (
                <th key={i} className="px-3 py-2 text-center">M{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COHORT_DATA.map((c, i) => (
              <tr key={i} className="border-t border-amber-900/10">
                <td className="px-3 py-2 text-amber-50" style={{ fontFamily: monoFont }}>{c.month}</td>
                <td className="px-3 py-2 text-amber-100/70" style={{ fontFamily: monoFont }}>{c.size}</td>
                {[0,1,2,3,4,5].map(m => {
                  const v = c.retention[m];
                  return (
                    <td key={m} className="px-1 py-1 text-center" style={{ minWidth: 56 }}>
                      {v != null ? (
                        <div className="rounded px-2 py-1.5 text-xs" style={{ background: cellColor(v), fontFamily: monoFont, color: v > 50 ? "#fef3c7" : "#fde68a" }}>
                          {v}%
                        </div>
                      ) : <div className="text-amber-100/20">—</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          { label: lang === "he" ? "M1 שימור" : "M1 retention", value: "85%", desc: lang === "he" ? "ממוצע" : "average", color: "#10b981" },
          { label: lang === "he" ? "M3 שימור" : "M3 retention", value: "68%", desc: lang === "he" ? "ממוצע" : "average", color: "#c8924a" },
          { label: lang === "he" ? "M6 שימור" : "M6 retention", value: "48%", desc: lang === "he" ? "ממוצע" : "average", color: "#9b7da3" }
        ].map((s, i) => (
          <div key={i} className="border border-amber-900/30 rounded-lg p-4 bg-black/20">
            <div className="text-xs uppercase tracking-wider text-amber-300/50 mb-2">{s.label}</div>
            <div style={{ fontFamily: fontStack, color: s.color }} className="text-3xl font-light">{s.value}</div>
            <div className="text-xs text-amber-100/40 mt-1">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ADMIN : Support Inbox
   ════════════════════════════════════════════════════════════════════════ */
function AdminSupport({ ctx }) {
  const { t, lang, fontStack, monoFont } = ctx;
  const [tab, setTab] = useState("new");
  const filtered = MOCK_TICKETS.filter(tk => tk.status === tab);

  const priorityStyle = (p) => ({
    high: "bg-red-500/15 text-red-300 border-red-500/30",
    med: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-stone-500/15 text-stone-300 border-stone-500/30"
  })[p];

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.admin.support.title}</h1>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("new")} className={`px-4 py-2 text-sm rounded-md ${tab === "new" ? "bg-amber-600/20 text-amber-200 border border-amber-600/40" : "border border-amber-900/30 text-amber-100/60"}`}>
          {t.admin.support.new} ({MOCK_TICKETS.filter(t => t.status === "new").length})
        </button>
        <button onClick={() => setTab("closed")} className={`px-4 py-2 text-sm rounded-md ${tab === "closed" ? "bg-amber-600/20 text-amber-200 border border-amber-600/40" : "border border-amber-900/30 text-amber-100/60"}`}>
          {t.admin.support.closed}
        </button>
      </div>

      <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
        {filtered.map(tk => (
          <div key={tk.id} className="flex items-center gap-4 px-5 py-4 border-b border-amber-900/10 last:border-0 hover:bg-amber-950/10 cursor-pointer">
            <Avatar name={tk.customer} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-amber-50">{tk.customer}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${priorityStyle(tk.priority)}`}>
                  {t.admin.support.priority[tk.priority]}
                </span>
              </div>
              <div className="text-sm text-amber-100/80 truncate">{tk.subject[lang]}</div>
            </div>
            <span className="text-xs text-amber-100/40 shrink-0" style={{ fontFamily: monoFont }}>{tk.at}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-12 text-center text-amber-100/40">{t.common.noResults}</div>}
      </div>
    </div>
  );
}

export {
  AdminOverview, AdminCustomers, AdminAtRisk, AdminAutomation,
  AdminCampaigns, AdminCohorts, AdminSupport
};
