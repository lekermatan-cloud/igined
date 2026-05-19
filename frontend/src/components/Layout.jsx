// ════════════════════════════════════════════════════════════════════════
// Layout components  ·  Sidebar, TopBar, NavItem.
// These wrap every authenticated view (user dashboard + admin console).
// Public pages (Landing, Pricing) use their own simpler header.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Globe, ChevronDown, Search, Bell, Plus, ShieldCheck, Menu, ChevronLeft, ChevronRight,
  Home, LayoutDashboard, FolderOpen, Library, UsersRound, Gift, Key,
  CreditCard, Settings, BarChart3, Users, AlertTriangle, Workflow,
  Megaphone, Layers, Headphones, BadgeCheck, LogOut, CircleUser, Crown,
  FileSignature, Inbox
} from "lucide-react";
import { Logo, Avatar } from "./UI.jsx";

const NavItem = ({ to, active, children }) => {
  const match = useMatch({ from: to });
  const isActive = active !== undefined ? active : !!match;
  return (
    <Link
      to={to}
      className={`px-4 py-2 text-sm rounded-md transition-all ${isActive ? "bg-amber-600/15 text-amber-200" : "text-amber-100/60 hover:text-amber-100 hover:bg-white/5"}`}
    >
      {children}
    </Link>
  );
};

function NavLink({ item }) {
  const match = useMatch({ from: item.to, fuzzy: item.isIndex ? false : true, exact: item.isIndex });
  const isActive = !!match;
  
  return (
    <Link
      key={item.id}
      to={item.to}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
        isActive
          ? "bg-amber-600/15 text-amber-200 border border-amber-600/30"
          : "text-amber-100/65 hover:text-amber-100 hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <item.icon className="w-4 h-4 shrink-0" />
    </Link>
  );
}

function NavLinkWithLabel({ item, sidebarOpen }) {
  return (
    <Link
      key={item.id}
      to={item.to}
      activeProps={{
        className: "bg-amber-600/15 text-amber-200 border border-amber-600/30"
      }}
      activeOptions={{
        exact: item.isIndex
      }}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all text-amber-100/65 hover:text-amber-100 hover:bg-white/[0.04] border border-transparent ${!sidebarOpen ? "justify-center" : ""}`}
      title={!sidebarOpen ? item.label : ""}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {sidebarOpen && (
        <>
          <span className="flex-1 text-start truncate">{item.label}</span>
          {item.badge && (
            <span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded-full">{item.badge}</span>
          )}
        </>
      )}
    </Link>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Sidebar (user / admin)
   ════════════════════════════════════════════════════════════════════════ */
function Sidebar({ ctx, sidebarOpen, setSidebarOpen, switchRole, setLang }) {
  const { t, lang, isRTL, fontStack, monoFont, role, user } = ctx;

  const userNav = [
    { section: t.sections.product, items: [
      { id: "userDashboard", icon: LayoutDashboard, label: t.nav.dashboard, to: "/app/", isIndex: true },
      { id: "userDocuments", icon: FileSignature, label: t.nav.documents, to: "/app/documents" },
      { id: "userTemplates", icon: Library, label: t.nav.templates, to: "/app/templates" }
    ]},
    { section: t.sections.growth, items: [
      { id: "userTeam", icon: UsersRound, label: t.nav.team, to: "/app/team" },
      { id: "userReferrals", icon: Gift, label: t.nav.referrals, to: "/app/referrals" },
      { id: "userApiKeys", icon: Key, label: t.nav.apiKeys, to: "/app/api-keys" }
    ]},
    { section: t.sections.account, items: [
      { id: "userBilling", icon: CreditCard, label: t.nav.billing, to: "/app/billing" },
      { id: "userSettings", icon: Settings, label: t.nav.settings, to: "/app/settings" }
    ]}
  ];

  const adminNav = [
    { section: t.sections.admin, items: [
      { id: "adminOverview", icon: LayoutDashboard, label: t.nav.adminOverview, to: "/app/admin" },
      { id: "adminCustomers", icon: Users, label: t.nav.customers, to: "/app/admin" },
      { id: "adminAtRisk", icon: AlertTriangle, label: t.nav.atRisk, badge: "5", to: "/app/admin" }
    ]},
    { section: t.sections.growth, items: [
      { id: "adminAutomation", icon: Workflow, label: t.nav.automation, to: "/app/admin" },
      { id: "adminCampaigns", icon: Megaphone, label: t.nav.campaigns, to: "/app/admin" },
      { id: "adminCohorts", icon: BarChart3, label: t.nav.cohorts, to: "/app/admin" }
    ]},
    { section: t.sections.account, items: [
      { id: "adminSupport", icon: Inbox, label: t.nav.support, badge: "3", to: "/app/admin" }
    ]}
  ];

  const nav = role === "admin" ? adminNav : userNav;

  return (
    <aside
      className={`fixed top-0 ${isRTL ? "right-0 border-l" : "left-0 border-r"} h-screen border-amber-900/20 bg-black/40 backdrop-blur-md z-30 transition-all duration-200 ${sidebarOpen ? "w-64" : "w-16"} flex flex-col`}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 px-4 h-16 border-b border-amber-900/20 shrink-0">
        <Logo size={28} />
        {sidebarOpen && (
          <div className={isRTL ? "text-right" : "text-left"}>
            <div style={{ fontFamily: fontStack }} className="text-lg font-semibold leading-none">
              <span style={{ color: "#c8924a" }}>{t.brand}</span>
              <span className="text-amber-100/40 text-xs ms-1.5 font-normal" style={{ fontFamily: monoFont }}>v3</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/40 mt-1">{t.tagline}</div>
          </div>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {nav.map((group, gi) => (
          <div key={gi} className="mb-5">
            {sidebarOpen && (
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/40 px-3 mb-2">{group.section}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLinkWithLabel key={item.id} item={item} sidebarOpen={sidebarOpen} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: role + lang */}
      <div className="p-3 border-t border-amber-900/20 space-y-2">
        {user?.is_admin && sidebarOpen && (
          <div className="flex border border-amber-900/30 rounded-md p-0.5 bg-black/30">
            <button
              onClick={() => switchRole("user")}
              className={`flex-1 px-2 py-1 text-xs rounded ${role === "user" ? "bg-amber-600/20 text-amber-200" : "text-amber-100/50"}`}
            >
              {t.role.user}
            </button>
            <button
              onClick={() => switchRole("admin")}
              className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 ${role === "admin" ? "bg-amber-600/20 text-amber-200" : "text-amber-100/50"}`}
            >
              <ShieldCheck className="w-3 h-3" />{t.role.admin}
            </button>
          </div>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={() => { const newLang = lang === "he" ? "en" : "he"; setLang(newLang); localStorage.setItem("sigined_lang", newLang); }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-amber-900/30 hover:border-amber-600/60 text-xs"
          >
            <Globe className="w-3 h-3" />
            {sidebarOpen && <span>{lang === "he" ? "EN" : "עב"}</span>}
          </button>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="px-2 py-1.5 rounded-md border border-amber-900/30 hover:border-amber-600/60 text-amber-100/60"
          >
            {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ ctx, sidebarOpen, setSidebarOpen }) {
  const { t, monoFont, role, user, logout } = ctx;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const displayName = user?.full_name || (role === "admin" ? "Admin" : user?.email?.split("@")[0] || "User");
  const displayEmail = role === "admin" ? "admin@sigined.app" : (user?.email || "");

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="border-b border-amber-900/20 bg-black/20 backdrop-blur-md sticky top-0 z-20">
      <div className="h-14 flex items-center justify-between gap-4 px-4 md:px-6">
        <button onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-md hover:bg-white/5">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-md hover:bg-white/5 text-amber-100/60 relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
          </button>
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 cursor-pointer"
            >
              <Avatar name={displayName} size={28} />
              <div className="hidden md:block text-start">
                <div className="text-xs text-amber-50">{displayName}</div>
                <div className="text-[10px] text-amber-100/40" style={{ fontFamily: monoFont }}>{displayEmail}</div>
              </div>
              <ChevronDown className="w-3 h-3 text-amber-100/40" />
            </button>
            {dropdownOpen && (
              <div className="absolute end-0 mt-2 w-48 bg-black/90 border border-amber-900/30 rounded-md shadow-lg overflow-hidden">
                <Link 
                  to="/app/settings" 
                  className="block px-4 py-2 text-sm text-amber-100/70 hover:bg-amber-900/20 hover:text-amber-100"
                  onClick={() => setDropdownOpen(false)}
                >
                  {t?.nav?.settings || "Settings"}
                </Link>
                <button 
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full text-start px-4 py-2 text-sm text-amber-100/70 hover:bg-amber-900/20 hover:text-amber-100"
                >
                  {ctx.lang === "he" ? "יציאה" : "Logout"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// Exports
export { NavItem, Sidebar, TopBar };
