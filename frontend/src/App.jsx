// ════════════════════════════════════════════════════════════════════════
// App  ·  Root component, routing, global state.
// ════════════════════════════════════════════════════════════════════════
// Routing is driven by a single `view` state variable (no react-router yet —
// add it when we move to multi-page navigation with browser history).
//
// Global app state lives here and is passed to children via a `ctx` object:
//   ctx = { lang, t, isRTL, role, view, setView, fontStack, monoFont,
//           toasts, addToast, ... }
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useCallback, useEffect } from "react";
import { Globe } from "lucide-react";
import { STR } from "./i18n.js";
import { fontFor } from "./lib.js";
import { Logo, ToastStack } from "./components/UI.jsx";
import { Sidebar, TopBar, NavItem } from "./components/Layout.jsx";
import { Landing, Pricing, Auth } from "./pages/Public.jsx";
import {
  UserDashboard, UserDocuments, UserTemplates, UserTeam,
  UserReferrals, UserApiKeys, UserBilling, UserSettings
} from "./pages/User.jsx";
import UploadPage from "./pages/Upload.jsx";
import SignPage from "./pages/Sign.jsx";
import {
  AdminOverview, AdminCustomers, AdminAtRisk, AdminAutomation,
  AdminCampaigns, AdminCohorts, AdminSupport
} from "./pages/Admin.jsx";
import AdminConsole from "./pages/AdminFull.jsx";
import { MOCK_CUSTOMERS, MOCK_FLOWS } from "./mockData.js";
import { auth as authApi, api, users as usersApi, billing as billingApi } from "./api.js";

export default function SiginedApp() {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem("sigined_lang");
    return saved || "he";
  });
  const [role, setRole] = useState("user"); // user | admin
  const [view, setView] = useState("landing");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [customers, setCustomers] = useState(MOCK_CUSTOMERS);
  const [selectedUser, setSelectedUser] = useState(null);
  const [flows, setFlows] = useState(MOCK_FLOWS);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signToken, setSignToken] = useState(null);

  const t = STR[lang];
  const isRTL = lang === "he";
  const dir = isRTL ? "rtl" : "ltr";

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("sigined_token");
      if (token) {
        api.setToken(token);
        try {
          const data = await authApi.me();
          setUser(data.user);
        } catch (err) {
          localStorage.removeItem("sigined_token");
          api.setToken(null);
        }
      }
      setLoading(false);
    };
    checkAuth();

    const url = new URL(window.location.href);
    const pathParts = url.pathname.split("/").filter(Boolean);
    console.log("URL path:", url.pathname, "pathParts:", pathParts);
    
    if (pathParts[0] === "sign" && pathParts[1]) {
      console.log("Setting signToken:", pathParts[1]);
      setSignToken(pathParts[1]);
      setView("sign");
    } else if (pathParts[0] === "ref" && pathParts[1]) {
      sessionStorage.setItem("referral_code", pathParts[1]);
      setView("auth");
    }

    const params = url.searchParams;
    if (params.get("payment") === "success") {
      showToast(lang === "he" ? "תשלום הושלם בהצלחה!" : "Payment completed successfully!");
      window.history.replaceState({}, "", url.pathname);
    } else if (params.get("payment") === "canceled") {
      showToast(lang === "he" ? "התשלום בוטל" : "Payment canceled");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async ({ email, password, full_name, phone, terms_accepted, privacy_accepted }) => {
    const data = await authApi.register({ 
      email, 
      password, 
      full_name, 
      phone,
      terms_accepted,
      privacy_accepted
    });
    if (data.token) {
      api.setToken(data.token);
      setUser(data.user);
      const pendingPlan = sessionStorage.getItem("pending_plan");
      if (pendingPlan) {
        sessionStorage.removeItem("pending_plan");
        try {
          const { url } = await billingApi.checkout(pendingPlan, "USD");
          if (url) {
            window.location.href = url;
            return;
          }
        } catch (err) {
          showToast(err.message || (lang === "he" ? "שגיאה ביצירת תשלום" : "Error creating checkout"), "error");
        }
      }
    }
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {}
    api.setToken(null);
    setUser(null);
    setView("landing");
  };

  const handleSelectPlan = async (plan) => {
    if (!user) {
      sessionStorage.setItem("pending_plan", plan);
      setView("auth");
      return;
    }
    try {
      const { url } = await billingApi.checkout(plan, "USD");
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה ביצירת תשלום" : "Error creating checkout"), "error");
    }
  };

  useEffect(() => {
    if (document.getElementById("sigined-fonts")) return;
    const link = document.createElement("link");
    link.id = "sigined-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Manrope:wght@300;400;500;600;700&family=Heebo:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);

    if (!document.getElementById("sigined-keyframes")) {
      const style = document.createElement("style");
      style.id = "sigined-keyframes";
      style.textContent = `@keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`;
      document.head.appendChild(style);
    }
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const switchRole = (r) => {
    setRole(r);
    setView(r === "admin" ? "adminOverview" : "userDashboard");
  };

  const fontStack = isRTL ? `'Frank Ruhl Libre', 'Fraunces', serif` : `'Fraunces', 'Frank Ruhl Libre', serif`;
  const bodyFont = isRTL ? `'Heebo', 'Manrope', system-ui, sans-serif` : `'Manrope', 'Heebo', system-ui, sans-serif`;
  const monoFont = `'JetBrains Mono', ui-monospace, monospace`;

  const isPublic = ["landing", "pricing", "auth", "sign"].includes(view) || !!signToken;
  const ctx = { t, lang, isRTL, fontStack, bodyFont, monoFont, setView, setRole, showToast, customers, setCustomers, flows, setFlows, role, selectedUser, setSelectedUser, user, login, register, logout, usersApi };

  return (
    <div
      dir={dir}
      style={{
        fontFamily: bodyFont,
        background: "radial-gradient(ellipse at top, #0f1422 0%, #070a13 60%, #050810 100%)",
        minHeight: "100vh", color: "#e8e3d6"
      }}
      className="relative"
    >
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")` }}
      />

      {/* Public top bar */}
      {isPublic && (
        <header className="z-20 border-b border-amber-900/20 backdrop-blur-md bg-black/30 sticky top-0">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <button onClick={() => setView("landing")} className="flex items-center gap-3">
              <Logo size={32} />
              <div className={isRTL ? "text-right" : "text-left"}>
                <div style={{ fontFamily: fontStack }} className="text-xl font-semibold tracking-wide">
                  <span style={{ color: "#c8924a" }}>{t.brand}</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/40">{t.tagline}</div>
              </div>
            </button>
            <nav className="hidden md:flex items-center gap-1">
              <NavItem onClick={() => setView("landing")} active={view === "landing"}>{t.nav.home}</NavItem>
              <NavItem onClick={() => setView("pricing")} active={view === "pricing"}>{t.nav.pricing}</NavItem>
            </nav>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <button
                    onClick={() => { setRole("user"); setView("userDashboard"); }}
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100"
                  >
                    {lang === "he" ? "לוח בקרה" : "Dashboard"}
                  </button>
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 text-sm rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100"
                  >
                    {lang === "he" ? "יציאה" : "Logout"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setView("auth")}
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100"
                  >
                    {lang === "he" ? "כניסה" : "Sign in"}
                  </button>
                  <button
                    onClick={() => setView("auth")}
                    className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md"
                  >
                    {t.hero.cta}
                  </button>
                </>
              )}
              <button
                onClick={() => { const newLang = lang === "he" ? "en" : "he"; setLang(newLang); localStorage.setItem("sigined_lang", newLang); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-amber-900/30 hover:border-amber-600/60 text-sm"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="font-medium">{lang === "he" ? "EN" : "עב"}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* App layout (sidebar + content) */}
      {!isPublic ? (
        <div className="relative z-10 flex min-h-screen">
          <Sidebar ctx={ctx} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} view={view} switchRole={switchRole} setLang={setLang} />
          <main className={`flex-1 min-w-0 transition-[margin] ${sidebarOpen ? "lg:ms-64" : "lg:ms-16"}`}>
            <TopBar ctx={ctx} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            <div className="max-w-7xl mx-auto px-6 py-8">
              {/* User views */}
              {view === "userDashboard" && <UserDashboard ctx={ctx} />}
              {view === "userDocuments" && <UserDocuments ctx={ctx} />}
              {view === "userUpload" && <UploadPage ctx={ctx} />}
              {view === "userTemplates" && <UserTemplates ctx={ctx} />}
              {view === "userTeam" && <UserTeam ctx={ctx} />}
              {view === "userReferrals" && <UserReferrals ctx={ctx} />}
              {view === "userApiKeys" && <UserApiKeys ctx={ctx} />}
              {view === "userBilling" && <UserBilling ctx={ctx} />}
              {view === "userSettings" && <UserSettings ctx={ctx} />}
              {/* Admin views — using new AdminFull with complete user management */}
              {view.startsWith("admin") && <AdminConsole ctx={ctx} />}
            </div>
          </main>
        </div>
      ) : (
        <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">
          {view === "sign" && signToken && <SignPage token={signToken} />}
          {view === "landing" && <Landing ctx={ctx} />}
          {view === "pricing" && <Pricing ctx={ctx} onSelectPlan={handleSelectPlan} />}
          {view === "auth" && <Auth ctx={ctx} />}
        </main>
      )}

      {/* Toasts */}
      <ToastStack toasts={toasts} dismiss={dismissToast} />

      {/* Footer */}
      {isPublic && (
        <footer className="relative z-10 border-t border-amber-900/20 mt-16 py-6">
          <div className="max-w-[1400px] mx-auto px-6 flex flex-wrap justify-between items-center gap-3 text-xs text-amber-100/40">
            <span style={{ fontFamily: monoFont }}>SHA-256 · UTC · {new Date().getFullYear()} {t.brand}</span>
            <span>{lang === "he" ? "תואם eIDAS · ESIGN Act · חוק חתימה אלקטרונית" : "Compliant with eIDAS · ESIGN Act · Israeli E-Signature Law"}</span>
          </div>
        </footer>
      )}
    </div>
  );
}

