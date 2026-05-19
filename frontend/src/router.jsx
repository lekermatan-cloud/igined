import { createRouter, createRootRoute, createRoute, Outlet, useParams, useRouter, useSearch, Link } from "@tanstack/react-router";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { STR } from "./i18n.js";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Logo, ToastStack } from "./components/UI.jsx";
import { Sidebar, TopBar } from "./components/Layout.jsx";
import { Landing, Pricing, Auth } from "./pages/Public.jsx";
import {
  UserDashboard, UserDocuments, UserTemplates, UserTeam,
  UserReferrals, UserApiKeys, UserBilling, UserSettings
} from "./pages/User.jsx";
import UploadPage from "./pages/Upload.jsx";
import SignPage from "./pages/Sign.jsx";
import VerifyPage from "./pages/Verify.jsx";
import VerifyEmailPage from "./pages/VerifyEmail.jsx";
import AdminConsole from "./pages/AdminFull.jsx";
import AddFieldsPage from "./pages/AddFields.jsx";
import { MOCK_CUSTOMERS, MOCK_FLOWS } from "./mockData.js";
import { auth as authApi, api, users as usersApi, billing as billingApi } from "./api.js";

const AppCtx = createContext(null);

export function useAppCtx() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppCtx must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem("sigined_lang");
    return saved || "he";
  });
  const [role, setRole] = useState("user");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [customers, setCustomers] = useState(MOCK_CUSTOMERS);
  const [selectedUser, setSelectedUser] = useState(null);
  const [flows, setFlows] = useState(MOCK_FLOWS);
  const [user, setUser] = useState(null);

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
    };
    checkAuth();
  }, []);

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
      style.textContent = "@keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }";
      document.head.appendChild(style);
    }
  }, []);

  const t = STR[lang];
  const isRTL = lang === "he";
  const fontStack = isRTL ? "'Frank Ruhl Libre', 'Fraunces', serif" : "'Fraunces', 'Frank Ruhl Libre', serif";
  const bodyFont = isRTL ? "'Heebo', 'Manrope', system-ui, sans-serif" : "'Manrope', 'Heebo', system-ui, sans-serif";
  const monoFont = "'JetBrains Mono', ui-monospace, monospace";

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async ({ email, password, full_name, phone, terms_accepted, privacy_accepted }) => {
    const data = await authApi.register({ email, password, full_name, phone, terms_accepted, privacy_accepted });
    if (data.token) {
      api.setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch (err) {}
    api.setToken(null);
    setUser(null);
  };

  const googleLogin = async (credential) => {
    const data = await authApi.google(credential);
    api.setToken(data.token);
    setUser(data.user);
    return data;
  };

  const ctx = {
    t, lang, isRTL, fontStack, bodyFont, monoFont, setRole, setLang, showToast, dismissToast,
    customers, setCustomers, flows, setFlows, role, selectedUser, setSelectedUser,
    user, login, register, googleLogin, logout, usersApi, toasts, sidebarOpen, setSidebarOpen
  };

  return (
    <AppCtx.Provider value={ctx}>
      {children}
    </AppCtx.Provider>
  );
}

function RootComponent() {
  return (
    <AppProvider>
      <ThemeProvider>
        <InnerRoot />
      </ThemeProvider>
    </AppProvider>
  );
}

function InnerRoot() {
  const router = useRouter();
  const ctx = useAppCtx();
  
  const setView = (view) => {
    const routes = {
      landing: "/",
      pricing: "/pricing",
      auth: "/auth",
      userDashboard: "/app",
      userDocuments: "/app/documents",
      userUpload: "/app/upload",
      userTemplates: "/app/templates",
      userTeam: "/app/team",
      userReferrals: "/app/referrals",
      userApiKeys: "/app/api-keys",
      userBilling: "/app/billing",
      userSettings: "/app/settings",
      adminOverview: "/app/admin",
    };
    if (view.startsWith("addFields-")) {
      const docId = view.replace("addFields-", "");
      window.location.href = "/app/add-fields?docId=" + docId;
      return;
    }
    const target = routes[view];
    if (target) router.navigate({ to: target });
  };
  
  const ctxWithSetView = { ...ctx, setView };
  
  return (
    <AppCtx.Provider value={ctxWithSetView}>
      <div
        dir={ctx.isRTL ? "rtl" : "ltr"}
        style={{
          fontFamily: ctx.bodyFont,
          background: "radial-gradient(ellipse at top, #0f1422 0%, #070a13 60%, #050810 100%)",
          minHeight: "100vh", color: "#e8e3d6"
        }}
      >
        <Outlet />
        <ToastStack toasts={ctx.toasts} dismiss={ctx.dismissToast} />
      </div>
    </AppCtx.Provider>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen bg-white dark:bg-[#0f1422] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl text-gray-900 dark:text-amber-50 mb-2">Page Not Found</h1>
        <p className="text-gray-600 dark:text-amber-100/60">The requested page could not be found.</p>
      </div>
    </div>
  ),
});

function PublicLayout() {
  const ctx = useAppCtx();
  return (
    <>
      <header className="z-20 border-b border-amber-900/20 backdrop-blur-md bg-black/30 sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={32} />
            <div className={ctx.isRTL ? "text-right" : "text-left"}>
              <div style={{ fontFamily: ctx.fontStack }} className="text-xl font-semibold tracking-wide">
                <span style={{ color: "#c8924a" }}>{ctx.t.brand}</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/40">{ctx.t.tagline}</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className="px-4 py-2 text-sm rounded-md text-amber-100/60 hover:text-amber-100 hover:bg-white/5">Home</Link>
            <Link to="/#pricing" className="px-4 py-2 text-sm rounded-md text-amber-100/60 hover:text-amber-100 hover:bg-white/5">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            {ctx.user ? (
              <>
                <Link to="/app" className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100">
                  {ctx.lang === "he" ? "לוח בקרה" : "Dashboard"}
                </Link>
                <button onClick={ctx.logout} className="px-3 py-1.5 text-sm rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100">
                  {ctx.lang === "he" ? "יציאה" : "Logout"}
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100">
                  {ctx.lang === "he" ? "כניסה" : "Sign in"}
                </Link>
                <Link to="/auth" className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md">
                  {ctx.t.hero.cta}
                </Link>
              </>
            )}
            <button
              onClick={() => { const newLang = ctx.lang === "he" ? "en" : "he"; ctx.setLang(newLang); localStorage.setItem("sigined_lang", newLang); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-amber-900/30 hover:border-amber-600/60 text-sm"
            >
              <span className="font-medium">{ctx.lang === "he" ? "EN" : "עב"}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="relative z-10 border-t border-amber-900/20 mt-16 py-6">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-wrap justify-between items-center gap-3 text-xs text-amber-100/40">
          <div className="flex items-center gap-4">
            <span style={{ fontFamily: ctx.monoFont }}>SHA-256 · UTC · {new Date().getFullYear()} {ctx.t.brand}</span>
            <Link to="/terms" className="hover:text-amber-200">{ctx.lang === "he" ? "תנאי שימוש" : "Terms"}</Link>
            <Link to="/privacy" className="hover:text-amber-200">{ctx.lang === "he" ? "פרטיות" : "Privacy"}</Link>
          </div>
          <span>{ctx.lang === "he" ? "תואם eIDAS · ESIGN Act · חוק חתימה אלקטרונית" : "Compliant with eIDAS · ESIGN Act · Israeli E-Signature Law"}</span>
        </div>
      </footer>
    </>
  );
}

const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public",
  component: PublicLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/",
  component: function Index() {
    const ctx = useAppCtx();
    return <Landing ctx={ctx} />;
  },
});

const authRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/auth",
  component: function AuthRoute() {
    const ctx = useAppCtx();
    const router = useRouter();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    useEffect(() => {
      if (ctx.user) {
        router.navigate({ to: "/app" });
      }
    }, [ctx.user, router]);
    
    if (ctx.user) return null;
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        <Auth ctx={ctx} />
      </GoogleOAuthProvider>
    );
  },
});

const termsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/terms",
  component: Terms,
});

function Terms() {
  const ctx = useAppCtx();
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <h1 style={{ fontFamily: ctx.fontStack }} className="text-3xl text-amber-50 mb-6">Terms of Use</h1>
      <div className="prose prose-invert prose-amber">
        <p className="text-amber-100/70">Last updated: May 2026</p>
        <h2 className="text-amber-200 mt-6">1. Acceptance of Terms</h2>
        <p className="text-amber-100/60">By accessing and using Sigined, you accept and agree to be bound by the terms and provision of this agreement.</p>
        <h2 className="text-amber-200 mt-6">2. Use License</h2>
        <p className="text-amber-100/60">Permission is granted to temporarily use Sigined for personal, non-commercial use only.</p>
        <h2 className="text-amber-200 mt-6">3. Disclaimer</h2>
        <p className="text-amber-100/60">The materials on Sigined are provided &quot;as is&quot;. Sigined makes no warranties, expressed or implied.</p>
        <h2 className="text-amber-200 mt-6">4. Limitation of Liability</h2>
        <p className="text-amber-100/60">Sigined shall not be liable for any damages arising out of the use or inability to use the materials.</p>
        <h2 className="text-amber-200 mt-6">5. Governing Law</h2>
        <p className="text-amber-100/60">These terms and conditions are governed by and construed in accordance with Israeli law.</p>
      </div>
    </div>
  );
}

function Privacy() {
  const ctx = useAppCtx();
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <h1 style={{ fontFamily: ctx.fontStack }} className="text-3xl text-amber-50 mb-6">Privacy Policy</h1>
      <div className="prose prose-invert prose-amber">
        <p className="text-amber-100/70">Last updated: May 2026</p>
        <h2 className="text-amber-200 mt-6">1. Information We Collect</h2>
        <p className="text-amber-100/60">We collect information you provide directly to us, including name, email, and payment information.</p>
        <h2 className="text-amber-200 mt-6">2. How We Use Information</h2>
        <p className="text-amber-100/60">We use the information to provide, maintain, and improve our services.</p>
        <h2 className="text-amber-200 mt-6">3. Information Sharing</h2>
        <p className="text-amber-100/60">We do not sell or share your personal information with third parties except as required by law.</p>
        <h2 className="text-amber-200 mt-6">4. Data Security</h2>
        <p className="text-amber-100/60">We implement appropriate security measures to protect your personal information.</p>
        <h2 className="text-amber-200 mt-6">5. Your Rights</h2>
        <p className="text-amber-100/60">You have the right to access, update, or delete your personal information at any time.</p>
      </div>
    </div>
  );
}

const privacyRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/privacy",
  component: Privacy,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  component: VerifyEmailPage,
});

const signRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign/$token",
  component: function Sign() {
    const params = useParams({ from: "/sign/$token" });
    const ctx = useAppCtx();
    
    useEffect(() => {
      ctx.setLang("en");
    }, []);
    
    return <SignPage token={params.token} forceLang="en" />;
  },
});

const refRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ref/$code",
  component: function Ref() {
    const params = useParams({ from: "/ref/$code" });
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    useEffect(() => {
      sessionStorage.setItem("referral_code", params.code);
    }, [params.code]);
    const ctx = useAppCtx();
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        <Auth ctx={ctx} />
      </GoogleOAuthProvider>
    );
  },
});

const verifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify",
  validateSearch: (search) => ({
    public_id: search.public_id || "",
  }),
  component: function Verify() {
    const search = useSearch({ from: "/verify" });
    return <VerifyPage publicId={search.public_id} />;
  },
});

const verifyPublicIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify/$publicId",
  component: function VerifyPublicId() {
    const params = useParams({ from: "/verify/$publicId" });
    return <VerifyPage publicId={params.publicId} />;
  },
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: function AppLayout() {
    const ctx = useAppCtx();
    return (
      <div className="flex min-h-screen relative">
        {ctx.sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => ctx.setSidebarOpen(false)}
          />
        )}
        <Sidebar ctx={ctx} sidebarOpen={ctx.sidebarOpen} setSidebarOpen={ctx.setSidebarOpen} switchRole={ctx.setRole} setLang={ctx.setLang} />
        <main className={`flex-1 min-w-0 transition-all duration-200 ${ctx.sidebarOpen ? "lg:ms-64" : "lg:ms-16"}`}>
          <TopBar ctx={ctx} sidebarOpen={ctx.sidebarOpen} setSidebarOpen={ctx.setSidebarOpen} />
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    );
  },
});

const appIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: function AppIndex() {
    const ctx = useAppCtx();
    return <UserDashboard ctx={ctx} />;
  },
});

const documentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "documents",
  component: function Documents() {
    const ctx = useAppCtx();
    return <UserDocuments ctx={ctx} />;
  },
});

function AddFieldsComponent() {
  const search = useSearch({ from: "/app/add-fields" });
  const ctx = useAppCtx();
  const router = useRouter();
  const handleBack = () => router.navigate({ to: "/app/documents" });
  console.log("AddFields search:", search);
  if (!search.docId) {
    return <div className="p-8 text-amber-100">No docId provided</div>;
  }
  return <AddFieldsPage docId={search.docId} onBack={handleBack} ctx={ctx} />;
}

const addFieldsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "add-fields",
  validateSearch: (search) => ({
    docId: search.docId || "",
  }),
  component: AddFieldsComponent,
});

const uploadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "upload",
  component: function Upload() {
    const ctx = useAppCtx();
    return <UploadPage ctx={ctx} />;
  },
});

const templatesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "templates",
  component: function Templates() {
    const ctx = useAppCtx();
    return <UserTemplates ctx={ctx} />;
  },
});

const teamRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "team",
  component: function Team() {
    const ctx = useAppCtx();
    return <UserTeam ctx={ctx} />;
  },
});

const referralsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "referrals",
  component: function Referrals() {
    const ctx = useAppCtx();
    return <UserReferrals ctx={ctx} />;
  },
});

const apiKeysRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "api-keys",
  component: function ApiKeys() {
    const ctx = useAppCtx();
    return <UserApiKeys ctx={ctx} />;
  },
});

const billingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "billing",
  component: function Billing() {
    const ctx = useAppCtx();
    return <UserBilling ctx={ctx} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "settings",
  component: function Settings() {
    const ctx = useAppCtx();
    return <UserSettings ctx={ctx} />;
  },
});

const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "admin",
  component: function Admin() {
    const ctx = useAppCtx();
    return <AdminConsole ctx={ctx} />;
  },
});

const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    indexRoute,
    authRoute,
    termsRoute,
    privacyRoute,
  ]),
  signRoute,
  refRoute,
  verifyEmailRoute,
  verifyRoute,
  verifyPublicIdRoute,
  appRoute.addChildren([
    appIndexRoute,
    documentsRoute,
    addFieldsRoute,
    uploadRoute,
    templatesRoute,
    teamRoute,
    referralsRoute,
    apiKeysRoute,
    billingRoute,
    settingsRoute,
    adminRoute,
  ]),
]);

const router = createRouter({ routeTree });

export { router };