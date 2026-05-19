// ════════════════════════════════════════════════════════════════════════
// User pages  ·  Personal area for logged-in users.
//   · UserDashboard      — overview with onboarding checklist + stats
//   · UserDocuments      — document list with filters
//   · UserTemplates      — template library (NDA, contracts, etc.)
//   · UserTeam           — invite & manage team members
//   · UserReferrals      — referral program with copy-link
//   · UserApiKeys        — API keys + webhooks management
//   · UserBilling        — current plan, usage, invoice history
//   · UserSettings       — profile, security, notifications
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, FileText, FileSignature, FileCheck, Award, Clock, ChevronRight, ArrowRight,
  ArrowLeft, Search, Filter, MoreHorizontal, Copy, Check, ExternalLink,
  Trash2, UserPlus, User, Mail, Crown, Briefcase, Eye, Download, AlertTriangle, Users, UserCheck,
  Workflow, Layers, Library, BookOpen, FilePlus, Gift, UsersRound, Key,
  CreditCard, Receipt, ShieldCheck, BadgeCheck, Sparkles, Code2, Webhook, Send, DollarSign,
  Zap, ArrowUpRight, ArrowDownRight, Image as ImageIcon, Video, Bell, Globe, X, Plug, Upload, Lock, Camera, Loader2
} from "lucide-react";
import { Avatar, StatusPill, PlanPill } from "../components/UI.jsx";
import SignaturePanel from "../components/SignaturePanel.jsx";
import { fmtMoney, fmtBytes, copyToClipboard } from "../lib.js";
import { api, documents, auth as authApi } from "../api.js";
import { teams as teamsApi } from "../api.js";
import { referrals as referralsApi } from "../api.js";
import { dashboard as dashboardApi } from "../api.js";
import { apiKeys as apiKeysApi } from "../api.js";
import { billing as billingApi } from "../api.js";
import { MOCK_TEMPLATES, MOCK_TEAM, MOCK_WEBHOOKS } from "../mockData.js";

function UserDashboard({ ctx }) {
  const { t, lang, fontStack, monoFont, setView, showToast, user } = ctx;
  const [stats, setStats] = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      showToast(lang === "he" ? "אימייל אימות נשלח מחדש" : "Verification email resent");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה בשליחת אימייל אימות" : "Failed to send verification email"), "error");
    } finally {
      setResending(false);
    }
  };

  const userName = user?.full_name || user?.email?.split("@")[0] || (lang === "he" ? "משתמש" : "User");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await dashboardApi.getStats();
        setStats(data.stats || {});
        setRecentDocs(data.recent_documents || []);
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const getKindFromMime = (mimeType) => {
    if (!mimeType) return "doc";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType === "application/pdf") return "pdf";
    return "doc";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return lang === "he" ? "היום" : "Today";
    if (diffDays === 1) return lang === "he" ? "אתמול" : "Yesterday";
    return `${diffDays} ${lang === "he" ? "ימים" : "days"} ${lang === "he" ? " ago" : " ago"}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-2">
          {lang === "he" ? "ברוך הבא" : "Welcome back"}
        </div>
        <h1 style={{ fontFamily: fontStack }} className="text-4xl font-light text-amber-50">
          {lang === "he" ? `${userName}, ברוך הבא` : `Welcome back, ${userName}`}
        </h1>
        {user?.email && (
          <p className="text-sm text-amber-100/50 mt-1" style={{ fontFamily: monoFont }}>{user.email}</p>
        )}
      </div>

      {user && !user.email_verified && (
        <div className="border border-amber-500/40 rounded-lg p-4 bg-gradient-to-br from-amber-950/30 to-transparent">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-amber-200">
                {lang === "he" ? "אמת את כתובת הדוא\"ל שלך" : "Verify your email address"}
              </h3>
              <p className="text-xs text-amber-100/50 mt-1">
                {lang === "he"
                  ? "נשלח אליך אימייל אימות. לחץ על הקישור באימייל כדי לאמת את החשבון שלך."
                  : "A verification email has been sent. Click the link in the email to verify your account."}
              </p>
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 disabled:text-amber-400/50 transition-colors"
              >
                {resending
                  ? (lang === "he" ? "שולח..." : "Sending...")
                  : (lang === "he" ? "שלח אימייל אימות שוב" : "Resend verification email")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="border border-amber-900/30 rounded-lg p-4 bg-gradient-to-br from-white/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-md bg-amber-800/20"></div>
                  <div className="w-12 h-3 bg-amber-800/20 rounded"></div>
                </div>
                <div className="w-16 h-6 bg-amber-800/20 rounded mb-1"></div>
                <div className="w-20 h-3 bg-amber-800/20 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t.user.stats.signed} value={stats?.documents_signed || 0} icon={FileCheck} color="#c8924a" {...{ fontStack, monoFont }} />
          <Stat label={t.user.stats.pending} value={stats?.documents_pending || 0} icon={Clock} color="#7a9eb0" {...{ fontStack, monoFont }} />
          <Stat label={t.user.stats.certs} value={stats?.certificates || 0} icon={Award} color="#9b7da3" {...{ fontStack, monoFont }} />
          <Stat label={t.user.stats.team} value={stats?.team_members || 0} icon={Users} color="#7fa089" {...{ fontStack, monoFont }} />
        </div>
      )}

      {/* Quick actions */}
      <section>
        <h2 style={{ fontFamily: fontStack }} className="text-xl font-light mb-4">{t.user.quickActions}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Upload, label: t.user.uploadDoc, view: "userDocuments" },
            { icon: FilePlus, label: t.user.newTemplate, view: "userTemplates" },
            { icon: UsersRound, label: t.user.inviteTeam, view: "userTeam" },
            { icon: Gift, label: t.user.refer, view: "userReferrals" }
          ].map((a, i) => (
            <button
              key={i}
              onClick={() => setView(a.view)}
              className="p-4 rounded-lg border border-amber-900/20 hover:border-amber-600/40 bg-black/20 text-start transition-all group"
            >
              <a.icon className="w-5 h-5 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
              <div className="text-sm text-amber-50">{a.label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent docs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: fontStack }} className="text-xl font-light">{t.user.recentDocs}</h2>
          <button onClick={() => setView("userDocuments")} className="text-sm text-amber-300/70 hover:text-amber-200">
            {lang === "he" ? "הכל" : "View all"} →
          </button>
        </div>
        <div className="border border-amber-900/20 rounded-lg overflow-hidden bg-black/20">
          {loading ? (
            <div className="animate-pulse">
              <div className="flex items-center justify-between px-5 py-4 border-b border-amber-900/10">
                <div className="w-24 h-4 bg-amber-800/20 rounded"></div>
                <div className="w-16 h-3 bg-amber-800/20 rounded"></div>
              </div>
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10 last:border-0">
                  <div className="w-9 h-9 rounded-md bg-amber-800/20"></div>
                  <div className="flex-1">
                    <div className="w-3/5 h-3 bg-amber-800/20 rounded mb-1.5"></div>
                    <div className="w-1/4 h-2.5 bg-amber-800/20 rounded"></div>
                  </div>
                  <div className="w-16 h-5 bg-amber-800/20 rounded-full"></div>
                </div>
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="p-8 text-center text-amber-100/40">{t.docs.empty}</div>
          ) : (
            recentDocs.map(d => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10 last:border-0 hover:bg-amber-950/10 cursor-pointer" onClick={() => setView("userDocuments")}>
                <div className="w-9 h-9 rounded-md bg-amber-600/10 border border-amber-600/30 flex items-center justify-center shrink-0">
                  {getKindFromMime(d.mime_type) === "image" ? <ImageIcon className="w-4 h-4 text-amber-400" /> : <FileText className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-amber-50 truncate">{d.name}</div>
                  <div className="text-xs text-amber-100/40">{formatDate(d.created_at)}</div>
                </div>
                <StatusPill status={d.status} t={t} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const Stat = ({ label, value, delta, icon: Icon, color, fontStack, monoFont }) => (
  <div className="border border-amber-900/30 rounded-lg p-4 bg-gradient-to-br from-white/[0.02] to-transparent">
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      {delta && (
        <span className={`text-xs flex items-center gap-0.5 ${delta.startsWith("+") ? "text-emerald-400" : "text-red-400"}`} style={{ fontFamily: monoFont }}>
          {delta.startsWith("+") ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {delta}
        </span>
      )}
    </div>
    <div className="text-[11px] uppercase tracking-wider text-amber-300/50 mb-1">{label}</div>
    <div style={{ fontFamily: fontStack }} className="text-2xl md:text-3xl font-light text-amber-50">{value}</div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   USER : Documents
   ════════════════════════════════════════════════════════════════════════ */
function UserDocuments({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast, setView } = ctx;
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [signers, setSigners] = useState([]);
  const [signerEmail, setSignerEmail] = useState("");
  const [signerName, setSignerName] = useState("");
  const [sending, setSending] = useState(false);
  const [selfSigning, setSelfSigning] = useState(false);
  const [docSigners, setDocSigners] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [fieldCount, setFieldCount] = useState(0);
  const [fieldCountLoading, setFieldCountLoading] = useState(false);

  useEffect(() => {
    if (selectedDoc) {
      setFieldCountLoading(true);
      documents.getFields(selectedDoc.id).then(data => {
        setFieldCount(data.fields?.length || 0);
      }).catch(() => setFieldCount(0)).finally(() => setFieldCountLoading(false));
    } else {
      setFieldCount(0);
      setFieldCountLoading(false);
    }
  }, [selectedDoc]);

  const handleDownload = async (doc) => {
    setDownloading(true);
    try {
      const data = await documents.getDownloadUrl(doc.id);
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      }
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה בהורדה" : "Download failed"), "error");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const data = await documents.list();
        setDocs(data.documents || []);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        showToast(lang === "he" ? "שגיאה בטעינת מסמכים" : "Failed to load documents", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  useEffect(() => {
    const fetchSigners = async () => {
      if (selectedDoc && selectedDoc.status !== "draft") {
        try {
          const res = await fetch(`${api.baseUrl}/documents/${selectedDoc.id}/signers`, {
            headers: { Authorization: `Bearer ${api.getToken()}` },
          });
          const data = await res.json();
          setDocSigners(data.signers || []);
        } catch (err) {
          console.error("Failed to fetch signers:", err);
        }
      } else {
        setDocSigners([]);
      }
    };
    fetchSigners();
  }, [selectedDoc]);

  const getKindFromMime = (mimeType) => {
    if (!mimeType) return "doc";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType === "application/pdf") return "pdf";
    return "doc";
  };

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || d.status === filter || (filter === "drafts" && d.status === "draft") || (filter === "signed" && d.status === "completed") || (filter === "pending" && (d.status === "sent" || d.status === "in_progress"));
    return matchSearch && matchFilter;
  });

  const handleSendForSigning = async () => {
    if (!selectedDoc || !signerEmail || !signerName) return;
    
    setSending(true);
    try {
      const res = await fetch(`${api.baseUrl}/documents/${selectedDoc.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({
          signers: [{ email: signerEmail, name: signerName }],
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to send");
      }
      
      showToast(lang === "he" ? "המסמך נשלח בהצלחה!" : "Document sent successfully!");
      setShowSendModal(false);
      setSelectedDoc(null);
      setSignerEmail("");
      setSignerName("");
      
      const updated = await documents.list();
      setDocs(updated.documents || []);
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה בשליחה" : "Failed to send"), "error");
    } finally {
      setSending(false);
    }
  };

  const handleSelfSign = async () => {
    if (!selectedDoc) return;
    
    setSelfSigning(true);
    try {
      const res = await fetch(`${api.baseUrl}/documents/${selectedDoc.id}/self-sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${api.getToken()}`,
        },
      });
      
      const data = await res.json();
      console.log("Self-sign response:", res.status, data);
      
      if (!res.ok) {
        throw new Error(data.error || `Failed to initiate self-sign (${res.status})`);
      }
      
      if (!data.signing_token) {
        console.error("Missing signing_token in response:", data);
        throw new Error("No signing token returned - check console for details");
      }
      
      setShowSendModal(false);
      setSelectedDoc(null);
      
      const baseUrl = window.location.origin;
      window.location.href = `${baseUrl}/sign/${data.signing_token}`;
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה" : "Error"), "error");
    } finally {
      setSelfSigning(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    
    setDeleting(true);
    try {
      await documents.delete(docToDelete.id);
      showToast(lang === "he" ? "המסמך נמחק" : "Document deleted");
      setShowDeleteConfirm(false);
      setDocToDelete(null);
      setSelectedDoc(null);
      
      const updated = await documents.list();
      setDocs(updated.documents || []);
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה במחיקה" : "Failed to delete"), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">{t.docs.title}</h1>
        <button onClick={() => setView("userUpload")} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm">
          <Plus className="w-4 h-4" /> {t.docs.newDoc}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-amber-100/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.docs.search}
            className="w-full bg-black/40 border border-amber-900/30 rounded-md ps-10 pe-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
          />
        </div>
        <div className="flex border border-amber-900/30 rounded-md overflow-hidden bg-black/30">
          {Object.entries(t.docs.filters).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-2 text-xs ${filter === k ? "bg-amber-600/20 text-amber-200" : "text-amber-100/50 hover:text-amber-100"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
        {loading ? (
          <div className="animate-pulse">
            <div className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10">
              <div className="w-10 h-10 rounded-md bg-amber-800/20 shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="w-3/5 h-3 bg-amber-800/20 rounded"></div>
                <div className="w-1/3 h-2.5 bg-amber-800/20 rounded"></div>
              </div>
              <div className="w-16 h-5 bg-amber-800/20 rounded-full"></div>
            </div>
            <div className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10">
              <div className="w-10 h-10 rounded-md bg-amber-800/20 shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="w-2/5 h-3 bg-amber-800/20 rounded"></div>
                <div className="w-1/4 h-2.5 bg-amber-800/20 rounded"></div>
              </div>
              <div className="w-16 h-5 bg-amber-800/20 rounded-full"></div>
            </div>
            <div className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10">
              <div className="w-10 h-10 rounded-md bg-amber-800/20 shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="w-1/2 h-3 bg-amber-800/20 rounded"></div>
                <div className="w-1/3 h-2.5 bg-amber-800/20 rounded"></div>
              </div>
              <div className="w-16 h-5 bg-amber-800/20 rounded-full"></div>
            </div>
            <div className="flex items-center gap-4 px-5 py-3">
              <div className="w-10 h-10 rounded-md bg-amber-800/20 shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-3 bg-amber-800/20 rounded"></div>
                <div className="w-1/2 h-2.5 bg-amber-800/20 rounded"></div>
              </div>
              <div className="w-16 h-5 bg-amber-800/20 rounded-full"></div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-amber-100/40">{t.docs.empty}</div>
        ) : (
          filtered.map(d => (
            <div 
              key={d.id} 
              className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10 last:border-0 hover:bg-amber-950/10"
            >
              <div 
                onClick={() => {
                  if (d.status === "draft") {
                    window.location.href = `/app/add-fields?docId=${d.id}`;
                  } else {
                    setSelectedDoc(d);
                    setShowSendModal(true);
                  }
                }}
                className="flex items-center gap-4 flex-1 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-md bg-amber-600/10 border border-amber-600/30 flex items-center justify-center shrink-0">
                  {getKindFromMime(d.mime_type) === "image" ? <ImageIcon className="w-4 h-4 text-amber-400" /> :
                   <FileText className="w-4 h-4 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-amber-50 truncate">{d.name}</div>
                  <div className="text-xs text-amber-100/40 flex items-center gap-2 mt-0.5" style={{ fontFamily: monoFont }}>
                    <span>{d.created_at ? new Date(d.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-US") : ""}</span>
                    <span>·</span>
                    <span>{fmtBytes(d.file_size_bytes || 0)}</span>
                  </div>
                </div>
                <StatusPill status={d.status} t={t} />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDocToDelete(d); setShowDeleteConfirm(true); }}
                className="p-2 text-amber-100/40 hover:text-red-400 transition-colors"
                title={lang === "he" ? "מחק" : "Delete"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {showSendModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f1422] border border-amber-900/40 rounded-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-amber-900/20">
              <h2 style={{ fontFamily: fontStack }} className="text-xl text-amber-50">{selectedDoc.name}</h2>
              <button onClick={() => { setShowSendModal(false); setSelectedDoc(null); }} className="p-1 text-amber-100/50 hover:text-amber-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-amber-100/50 mb-1">{lang === "he" ? "סטטוס" : "Status"}</div>
                  <StatusPill status={selectedDoc.status} t={t} />
                </div>
                <div>
                  <div className="text-amber-100/50 mb-1">{lang === "he" ? "גודל" : "Size"}</div>
                  <div className="text-amber-50" style={{ fontFamily: monoFont }}>{fmtBytes(selectedDoc.file_size_bytes || 0)}</div>
                </div>
                <div>
                  <div className="text-amber-100/50 mb-1">{lang === "he" ? "נוצר" : "Created"}</div>
                  <div className="text-amber-50" style={{ fontFamily: monoFont }}>
                    {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-US") : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-amber-100/50 mb-1">{lang === "he" ? "סוג קובץ" : "Type"}</div>
                  <div className="text-amber-50" style={{ fontFamily: monoFont }}>{selectedDoc.mime_type || selectedDoc.file_type || "-"}</div>
                </div>
              </div>

              {selectedDoc.status === "draft" && fieldCountLoading && (
                <div className="border-t border-amber-900/20 pt-6 pb-4 text-center">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                </div>
              )}

              {selectedDoc.status === "draft" && !fieldCountLoading && fieldCount === 0 && (
                <div className="border-t border-amber-900/20 pt-4 text-center py-6">
                  <div className="text-amber-100/50 text-sm mb-3">
                    {lang === "he" ? "יש להוסיף שדות חתימה לפני שליחה" : "Add signature fields before sending"}
                  </div>
                  <button
                    onClick={() => { setShowSendModal(false); window.location.href = `/app/add-fields?docId=${selectedDoc.id}`; }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm"
                  >
                    <FileSignature className="w-4 h-4" />
                    {lang === "he" ? "הוסף שדות חתימה" : "Add Signature Fields"}
                  </button>
                </div>
              )}

              {selectedDoc.status === "draft" && !fieldCountLoading && fieldCount > 0 && (
                <div className="border-t border-amber-900/20 pt-4 space-y-4">
                  <div>
                    <h3 className="text-sm text-amber-200 mb-3">{lang === "he" ? "שלח לחתימה" : "Send for Signing"}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-amber-100/50 mb-1">{lang === "he" ? "אימייל החותם" : "Signer Email"}</label>
                      <input
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="signer@example.com"
                        className="w-full bg-black/40 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-amber-100/50 mb-1">{lang === "he" ? "שם החותם" : "Signer Name"}</label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder={lang === "he" ? "שם מלא" : "Full name"}
                        className="w-full bg-black/40 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleSendForSigning}
                      disabled={sending || !signerEmail || !signerName}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {lang === "he" ? "שולח..." : "Sending..."}
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          {lang === "he" ? "שלח לחתימה" : "Send for Signing"}
                        </>
                      )}
                    </button>
                    </div>
                    </div>

              <div className="border-t border-amber-900/20 pt-4">
                    <h3 className="text-sm text-amber-200 mb-3">{lang === "he" ? "חתום בעצמך" : "Sign Yourself"}</h3>
                    <p className="text-xs text-amber-100/50 mb-3">
                      {lang === "he" 
                        ? "חתום על המסמך בעצמך כעת" 
                        : "Sign this document yourself now"}
                    </p>
                    <button
                      onClick={handleSelfSign}
                      disabled={selfSigning}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-medium rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {selfSigning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {lang === "he" ? "מכין..." : "Preparing..."}
                        </>
                      ) : (
                        <>
                          <FileSignature className="w-4 h-4" />
                          {lang === "he" ? "חתום בעצמך" : "Sign Yourself"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {selectedDoc.status === "sent" && (
                <div className="border-t border-amber-900/20 pt-4 space-y-4">
                  <h3 className="text-sm text-amber-200">{lang === "he" ? "חותמים" : "Signers"}</h3>
                  <div className="space-y-2">
                    {docSigners.map((signer) => (
                      <div key={signer.id} className="flex items-center justify-between p-3 bg-black/30 rounded-md">
                        <div>
                          <div className="text-sm text-amber-50">{signer.name}</div>
                          <div className="text-xs text-amber-100/50">{signer.email}</div>
                        </div>
                        <StatusPill status={signer.status} t={t} />
                      </div>
                    ))}
                  </div>
                  {docSigners.length > 0 && docSigners.some(s => s.status === "pending") && (
                    <p className="text-xs text-amber-100/50">
                      {lang === "he" 
                        ? "המתנה לחתימת החותמים" 
                        : "Waiting for signers to complete signing"}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowSendModal(false); setSelectedDoc(null); }}
                  className="flex-1 py-2 border border-amber-900/30 text-amber-100/70 hover:text-amber-100 hover:border-amber-600/60 rounded-md text-sm"
                >
                  {t.common.cancel}
                </button>
                {selectedDoc.file_url && (
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    disabled={downloading}
                    className="flex-1 py-2 bg-amber-600/10 border border-amber-600/30 text-amber-200 hover:bg-amber-600/20 rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {downloading
                      ? (lang === "he" ? "מוריד..." : "Downloading...")
                      : (lang === "he" ? "הורד" : "Download")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f1422] border border-amber-900/40 rounded-lg shadow-2xl">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50">
                    {lang === "he" ? "מחק מסמך?" : "Delete document?"}
                  </h3>
                  <p className="text-sm text-amber-100/60">
                    {lang === "he" ? "פעולה זו לא ניתנת לביטול" : "This action cannot be undone"}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-black/30 rounded-md">
                <div className="text-sm text-amber-50">{docToDelete.name}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDocToDelete(null); }}
                  className="flex-1 py-2 border border-amber-900/30 text-amber-100/70 hover:text-amber-100 hover:border-amber-600/60 rounded-md text-sm"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleDeleteDoc}
                  disabled={deleting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {lang === "he" ? "מוחק..." : "Deleting..."}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {lang === "he" ? "מחק" : "Delete"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   USER : Templates
   ════════════════════════════════════════════════════════════════════════ */
function UserTemplates({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast } = ctx;
  const [cat, setCat] = useState("all");
  const filtered = MOCK_TEMPLATES.filter(tpl => cat === "all" || tpl.cat === cat);

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.templates.title}</h1>
        <p className="text-amber-100/60 text-sm">{t.templates.subtitle}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(t.templates.categories).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setCat(k)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
              cat === k ? "bg-amber-600/20 border-amber-500/60 text-amber-200" : "border-amber-900/30 text-amber-100/60 hover:border-amber-600/50"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(tpl => (
          <div key={tpl.id} className="p-5 rounded-lg border border-amber-900/20 bg-black/20 hover:border-amber-600/40 transition-all group">
            <div className="aspect-[8.5/11] bg-stone-100 rounded mb-4 p-4 text-stone-700 text-[10px] overflow-hidden relative">
              <div className="font-bold text-stone-800 mb-2" style={{ fontFamily: "Georgia, serif", fontSize: "11px" }}>
                {tpl.name[lang]}
              </div>
              <div className="space-y-1 opacity-60">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-1 bg-stone-300 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
                ))}
              </div>
              <div className="absolute bottom-2 end-2 w-12 h-6 border border-dashed border-amber-600 rounded bg-amber-100/40 text-[8px] flex items-center justify-center text-amber-700">
                {lang === "he" ? "חתימה" : "Signature"}
              </div>
            </div>
            <h3 style={{ fontFamily: fontStack }} className="text-base text-amber-50 mb-1">{tpl.name[lang]}</h3>
            <div className="text-xs text-amber-100/40 mb-3" style={{ fontFamily: monoFont }}>
              {tpl.uses.toLocaleString()} {lang === "he" ? "שימושים" : "uses"}
            </div>
            <button
              onClick={() => showToast(t.toasts.docCreated)}
              className="w-full py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-black font-medium rounded transition-colors"
            >
              {t.templates.useTemplate}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   USER : Team
   ════════════════════════════════════════════════════════════════════════ */
function UserTeam({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast, user } = ctx;
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await teamsApi.list();
        setTeams(data.teams || []);
        if (data.teams?.length > 0 && !selectedTeam) {
          setSelectedTeam(data.teams[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
        showToast(lang === "he" ? "שגיאה בטעינת צוותים" : "Failed to load teams", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    
    const fetchMembers = async () => {
      try {
        const data = await teamsApi.getMembers(selectedTeam);
        setMembers(data.members || []);
      } catch (err) {
        console.error("Failed to fetch members:", err);
      }
    };
    fetchMembers();
  }, [selectedTeam]);

  const handleInvite = async () => {
    if (!inviteEmail || !selectedTeam) return;
    
    setInviting(true);
    try {
      await teamsApi.inviteMember(selectedTeam, inviteEmail, inviteRole);
      showToast(t.toasts.inviteSent);
      setInviteEmail("");
      const data = await teamsApi.getMembers(selectedTeam);
      setMembers(data.members || []);
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה בשליחת הזמנה" : "Failed to invite"), "error");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedTeam) return;
    try {
      await teamsApi.removeMember(selectedTeam, memberId);
      setMembers(members.filter(m => m.profiles?.id !== memberId));
      showToast(lang === "he" ? "חבר הוסר" : "Member removed");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה" : "Error"), "error");
    }
  };

  const getRoleBadgeClass = (role) => {
    if (role === "owner") return "bg-amber-500/15 text-amber-200 border border-amber-500/30";
    if (role === "admin") return "bg-red-500/15 text-red-200 border border-red-500/30";
    return "bg-stone-500/15 text-stone-300";
  };

  const currentTeam = teams.find(t => t.id === selectedTeam);

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.team.title}</h1>
        <p className="text-amber-100/60 text-sm">{t.team.subtitle}</p>
      </div>

      {teams.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => setSelectedTeam(team.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                selectedTeam === team.id 
                  ? "bg-amber-600/20 border-amber-500/60 text-amber-200" 
                  : "border-amber-900/30 text-amber-100/60 hover:border-amber-600/50"
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}

      <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20">
        <h3 className="text-sm text-amber-200 mb-3">{t.team.invite}</h3>
        <div className="flex gap-2">
          <input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder={lang === "he" ? "כתובת מייל..." : "Email address..."}
            dir="ltr"
            className="flex-1 bg-black/40 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
            style={{ fontFamily: monoFont }}
          />
          <select 
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="bg-black/40 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none"
          >
            <option value="editor">{t.team.roles.editor}</option>
            <option value="admin">{t.team.roles.admin}</option>
            <option value="viewer">{t.team.roles.viewer}</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviting ? (lang === "he" ? "שולח..." : "Sending...") : t.team.inviteCta}
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs text-amber-300/60 mb-3 flex items-center justify-between">
          <span>{members.length} {t.team.seats}</span>
          {currentTeam?.seats && (
            <span style={{ fontFamily: monoFont }}>{members.length} / {currentTeam.seats}</span>
          )}
        </div>
        <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
          {loading ? (
            <div className="animate-pulse">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-900/10">
                <div className="w-9 h-9 rounded-full bg-amber-800/20 shrink-0"></div>
                <div className="flex-1 space-y-1.5">
                  <div className="w-2/5 h-3 bg-amber-800/20 rounded"></div>
                  <div className="w-1/3 h-2.5 bg-amber-800/20 rounded"></div>
                </div>
                <div className="w-14 h-5 bg-amber-800/20 rounded-full"></div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-900/10">
                <div className="w-9 h-9 rounded-full bg-amber-800/20 shrink-0"></div>
                <div className="flex-1 space-y-1.5">
                  <div className="w-1/2 h-3 bg-amber-800/20 rounded"></div>
                  <div className="w-1/4 h-2.5 bg-amber-800/20 rounded"></div>
                </div>
                <div className="w-14 h-5 bg-amber-800/20 rounded-full"></div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-amber-800/20 shrink-0"></div>
                <div className="flex-1 space-y-1.5">
                  <div className="w-3/5 h-3 bg-amber-800/20 rounded"></div>
                  <div className="w-1/3 h-2.5 bg-amber-800/20 rounded"></div>
                </div>
                <div className="w-14 h-5 bg-amber-800/20 rounded-full"></div>
              </div>
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-amber-100/40">{t.common.noResults}</div>
          ) : (
            members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-amber-900/10 last:border-0">
                <Avatar name={m.profiles?.full_name || m.profiles?.email || "User"} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-amber-50">{m.profiles?.full_name || (lang === "he" ? "ללא שם" : "No name")}</div>
                  <div className="text-xs text-amber-100/40" style={{ fontFamily: monoFont }} dir="ltr">{m.profiles?.email || "-"}</div>
                </div>
                <span className="text-xs text-amber-100/50 hidden md:block">
                  {m.joined_at ? new Date(m.joined_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-US") : ""}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeClass(m.role)}`}>
                  {t.team.roles[m.role] || m.role}
                </span>
                {m.role !== "owner" && currentTeam?.owner_id === user?.id && (
                  <button
                    onClick={() => handleRemoveMember(m.profiles?.id)}
                    className="p-1.5 text-amber-100/30 hover:text-red-400 transition-colors"
                    title={lang === "he" ? "הסר חבר" : "Remove member"}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   USER : Referrals
   ════════════════════════════════════════════════════════════════════════ */
function UserReferrals({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast, user } = ctx;
  const [stats, setStats] = useState({ invited: 0, joined: 0 });
  const [referralLink, setReferralLink] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await referralsApi.getStats();
        setStats(data.stats || { invited: 0, joined: 0 });
        setReferralLink(data.referral_url || "");
      } catch (err) {
        console.error("Failed to fetch referral stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard?.writeText(referralLink);
      showToast(t.toasts.copied);
    }
  };

  const handleShareEmail = () => {
    const subject = lang === "he" 
      ? `${user?.full_name || "מישהו"} מזמין אותך להצטרף ל-Sigined`
      : `${user?.full_name || "Someone"} invites you to join Sigined`;
    const body = lang === "he"
      ? `היי!\n\nהשתמש בקישור הזה כדי להירשם ולקבל 50% הנחה:\n${referralLink}\n\nבברכה`
      : `Hi!\n\nUse this link to sign up and get 50% off:\n${referralLink}\n\nCheers`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.referrals.title}</h1>
        <p className="text-amber-100/60">{t.referrals.subtitle}</p>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="border border-amber-900/30 rounded-lg p-4 bg-black/20">
                <div className="w-5 h-5 bg-amber-800/20 rounded mx-auto mb-2"></div>
                <div className="w-12 h-6 bg-amber-800/20 rounded mx-auto mb-1"></div>
                <div className="w-16 h-2.5 bg-amber-800/20 rounded mx-auto"></div>
              </div>
            ))}
          </div>
          <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20">
            <div className="w-24 h-3 bg-amber-800/20 rounded mb-3"></div>
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-amber-800/20 rounded"></div>
              <div className="w-20 h-10 bg-amber-800/20 rounded"></div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="border border-amber-900/20 rounded-lg p-5 bg-black/20">
                <div className="w-9 h-9 rounded-full bg-amber-800/20 mb-3"></div>
                <div className="w-full h-3 bg-amber-800/20 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t.referrals.stats.invited, value: stats.invited || 0, icon: Send },
              { label: t.referrals.stats.joined, value: stats.joined || 0, icon: UserCheck },
              { label: t.referrals.stats.earned, value: `${(stats.joined || 0) * 1} ${lang === "he" ? "חודשים" : "months"}`, icon: DollarSign }
            ].map((s, i) => (
              <div key={i} className="border border-amber-900/30 rounded-lg p-4 bg-black/20 text-center">
                <s.icon className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">{s.value}</div>
                <div className="text-xs text-amber-300/50 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Link */}
          <div className="border border-amber-600/40 rounded-lg p-5 bg-gradient-to-br from-amber-950/20 to-transparent">
            <div className="text-xs uppercase tracking-wider text-amber-300/60 mb-2">{t.referrals.yourLink}</div>
            <div className="flex gap-2">
              <code className="flex-1 bg-black/40 border border-amber-900/30 rounded-md px-4 py-2.5 text-sm text-amber-100 truncate" style={{ fontFamily: monoFont }} dir="ltr">
                {referralLink || "..."}
              </code>
              <button
                onClick={handleCopy}
                disabled={!referralLink}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-black rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Copy className="w-4 h-4" /> {t.referrals.copyLink}
              </button>
              <button
                onClick={handleShareEmail}
                className="px-3 py-2.5 bg-amber-600/10 border border-amber-600/30 hover:bg-amber-600/20 text-amber-200 rounded-md"
                title={t.referrals.shareEmail}
              >
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* How it works */}
          <div>
            <h3 style={{ fontFamily: fontStack }} className="text-xl text-amber-50 mb-4">{t.referrals.howItWorks}</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {t.referrals.steps.map((step, i) => (
                <div key={i} className="border border-amber-900/20 rounded-lg p-5 bg-black/20">
                  <div className="w-9 h-9 rounded-full bg-amber-600/15 border border-amber-600/30 flex items-center justify-center text-amber-300 mb-3" style={{ fontFamily: monoFont }}>
                    {i + 1}
                  </div>
                  <p className="text-sm text-amber-100/80 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   USER : API Keys + Webhooks
   ════════════════════════════════════════════════════════════════════════ */
function UserApiKeys({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast } = ctx;
  const [keys, setKeys] = useState([]);
  const [hooks] = useState(MOCK_WEBHOOKS);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const data = await apiKeysApi.list();
        setKeys(data.keys || []);
      } catch (err) {
        console.error("Failed to fetch API keys:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchKeys();
  }, []);

  const [keyToDelete, setKeyToDelete] = useState(null);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    
    setCreating(true);
    try {
      const data = await apiKeysApi.create(newKeyName.trim());
      setCreatedKey(data.key);
      setNewKeyName("");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה" : "Error"), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    try {
      await apiKeysApi.delete(keyId);
      setKeys(prev => prev.filter(k => k.id !== keyId));
      showToast(lang === "he" ? "מפתח נמחק" : "Key deleted");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה" : "Error"), "error");
    }
  };

  const copyKey = () => {
    if (createdKey?.plain_key) {
      navigator.clipboard?.writeText(createdKey.plain_key);
      showToast(t.toasts.copied);
      setKeys(prev => [createdKey, ...prev]);
      setCreatedKey(null);
      setShowCreateModal(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-1">{t.api.title}</h1>
        <p className="text-amber-100/60 text-sm">{t.api.subtitle}</p>
      </div>

      {/* Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: fontStack }} className="text-xl text-amber-50">{t.api.keysTitle}</h3>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm">
            <Plus className="w-4 h-4" /> {t.api.newKey}
          </button>
        </div>
        <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
          {loading ? (
            <div className="p-8 text-center text-amber-100/40">{t.common.loading}</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-amber-100/40">
              {lang === "he" ? "אין מפתחות API" : "No API keys yet"}
            </div>
          ) : (
            keys.map(k => (
              <div key={k.id} className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10 last:border-0">
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-amber-50">{k.name}</div>
                  <code className="text-xs text-amber-100/60" style={{ fontFamily: monoFont }} dir="ltr">
                    {k.key_prefix}••••••••••••{k.key_suffix}
                  </code>
                </div>
                <div className="text-xs text-amber-100/40 hidden md:block" style={{ fontFamily: monoFont }}>
                  {k.created_at ? new Date(k.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "en-US") : ""}
                </div>
                <button className="text-amber-100/50 hover:text-red-400" onClick={() => setKeyToDelete(k)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Webhooks - simple placeholder for now */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: fontStack }} className="text-xl text-amber-50">{t.api.webhooksTitle}</h3>
        </div>
        <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
          <div className="p-8 text-center text-amber-100/40">
            {lang === "he" ? "Webhooks יתווספו בקרוב" : "Webhooks coming soon"}
          </div>
        </div>
      </div>

      {/* Code sample */}
      <div className="border border-amber-900/30 rounded-lg p-5 bg-black/40">
        <div className="text-xs uppercase tracking-wider text-amber-300/60 mb-3">cURL example</div>
        <pre className="text-xs text-amber-100/80 overflow-x-auto" style={{ fontFamily: monoFont }} dir="ltr">{`curl -X POST https://api.sigined.com/documents \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@contract.pdf" \\
  -F "name=My Contract"`}</pre>
      </div>

      {/* Delete Key Confirmation Modal */}
      {keyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f1422] border border-amber-900/40 rounded-lg shadow-2xl">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 style={{ fontFamily: fontStack }} className="text-lg text-amber-50">
                    {lang === "he" ? "מחיקת מפתח API" : "Delete API key"}
                  </h2>
                  <p className="text-sm text-amber-100/50">
                    {lang === "he" ? "פעולה זו不可 להפיכה" : "This action cannot be undone"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-amber-100/70 mb-2">
                {lang === "he"
                  ? `האם אתה בטוח שברצונך למחוק את המפתח "${keyToDelete.name}"?`
                  : `Are you sure you want to delete the key "${keyToDelete.name}"?`}
              </p>
              <p className="text-xs text-amber-100/40 mb-5">
                {lang === "he"
                  ? "כל השירותים המשתמשים במפתח זה יאבדו גישה מידית."
                  : "Any services using this key will lose access immediately."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setKeyToDelete(null)}
                  className="flex-1 py-2 border border-amber-900/30 text-amber-100/70 hover:text-amber-100 rounded-md text-sm"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => {
                    handleDeleteKey(keyToDelete.id);
                    setKeyToDelete(null);
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-md text-sm"
                >
                  {lang === "he" ? "מחק" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f1422] border border-amber-900/40 rounded-lg shadow-2xl">
            <div className="p-5 border-b border-amber-900/20">
              <h2 style={{ fontFamily: fontStack }} className="text-xl text-amber-50">{lang === "he" ? "צור מפתח API חדש" : "Create new API key"}</h2>
            </div>
            <div className="p-5 space-y-4">
              {createdKey ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                  <p className="text-sm text-emerald-200 mb-2">{lang === "he" ? "העתק את המפתח עכשיו - לא תוכל לראות אותו שוב!" : "Copy the key now - you won't see it again!"}</p>
                  <code 
                    className="block text-sm text-emerald-100 bg-black/30 p-3 rounded cursor-pointer hover:bg-black/50 transition-colors break-all"
                    style={{ fontFamily: monoFont }}
                    onClick={copyKey}
                  >
                    {createdKey.plain_key}
                  </code>
                  <button onClick={copyKey} className="mt-3 text-sm text-emerald-300 hover:text-emerald-200 flex items-center gap-2 mx-auto">
                    <Copy className="w-4 h-4" />
                    {lang === "he" ? "העתק ללוח" : "Copy to clipboard"}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-amber-100/70 mb-2">{lang === "he" ? "שם המפתח" : "Key name"}</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={lang === "he" ? "למשל: Production Key" : "e.g.: Production Key"}
                      className="w-full bg-black/40 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateKey}
                      disabled={creating || !newKeyName.trim()}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {lang === "he" ? "יוצר..." : "Creating..."}
                        </>
                      ) : (
                        lang === "he" ? "צור מפתח" : "Create key"
                      )}
                    </button>
                    <button
                      onClick={() => { setShowCreateModal(false); setNewKeyName(""); }}
                      className="px-4 py-2 border border-amber-900/30 text-amber-100/70 hover:text-amber-100 rounded-md text-sm"
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   USER : Billing
   ════════════════════════════════════════════════════════════════════════ */
function UserBilling({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast } = ctx;
  const [sub, setSub] = useState(null);
  const [usage, setUsage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [subData, invData] = await Promise.all([
          billingApi.getSubscription(),
          billingApi.getInvoices(),
        ]);
        setSub(subData.subscription);
        setUsage(subData.usage);
        setInvoices(invData.invoices || []);
      } catch (err) {
        console.error("Billing load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleManage = async () => {
    try {
      const { url } = await billingApi.portal();
      if (url) window.location.href = url;
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה" : "Error"), "error");
    }
  };

  const planName = sub?.plan === "basic" ? (lang === "he" ? "בסיסי" : "Basic")
    : sub?.plan === "pro" ? (lang === "he" ? "מקצועי" : "Pro")
    : sub?.plan === "enterprise" ? (lang === "he" ? "ארגון" : "Enterprise")
    : (lang === "he" ? "חינם" : "Free");

  const planPrice = sub?.plan === "basic" ? "$8" : sub?.plan === "pro" ? "$100" : sub?.plan === "enterprise" ? (lang === "he" ? "צור קשר" : "Custom") : "$0";

  const nextCharge = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const isHe = lang === "he";
  const hasSubscription = sub && ["basic", "pro", "enterprise"].includes(sub.plan);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="w-32 h-8 bg-amber-800/20 rounded"></div>
        <div className="border-2 border-amber-900/30 rounded-lg p-6 bg-black/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="w-16 h-3 bg-amber-800/20 rounded"></div>
              <div className="w-32 h-7 bg-amber-800/20 rounded"></div>
              <div className="w-24 h-5 bg-amber-800/20 rounded"></div>
            </div>
            <div className="flex gap-2">
              <div className="w-20 h-9 bg-amber-800/20 rounded"></div>
              <div className="w-20 h-9 bg-amber-800/20 rounded"></div>
            </div>
          </div>
          <div className="flex gap-8 pt-2">
            <div className="space-y-1">
              <div className="w-14 h-2.5 bg-amber-800/20 rounded"></div>
              <div className="w-24 h-3 bg-amber-800/20 rounded"></div>
            </div>
            <div className="space-y-1">
              <div className="w-14 h-2.5 bg-amber-800/20 rounded"></div>
              <div className="w-24 h-3 bg-amber-800/20 rounded"></div>
            </div>
          </div>
        </div>
        <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20 space-y-4">
          <div className="w-24 h-4 bg-amber-800/20 rounded"></div>
          <div className="flex gap-8">
            {[1,2].map(i => (
              <div key={i} className="flex-1 space-y-2">
                <div className="w-20 h-3 bg-amber-800/20 rounded"></div>
                <div className="w-full h-8 bg-amber-800/20 rounded"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
          <div className="flex gap-8 px-5 py-3 border-b border-amber-900/10">
            {[1,2,3].map(i => <div key={i} className="flex-1 h-3 bg-amber-800/20 rounded"></div>)}
          </div>
          {[1,2,3].map(i => (
            <div key={i} className="flex gap-8 px-5 py-3 border-b border-amber-900/10 last:border-0">
              {[1,2,3].map(j => <div key={j} className="flex-1 h-3 bg-amber-800/20 rounded"></div>)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">{t.billing.title}</h1>

      {/* Current plan */}
      <div className="border-2 border-amber-500/40 rounded-lg p-6 bg-gradient-to-br from-amber-950/30 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-amber-300/60 uppercase tracking-wider mb-1">{t.billing.currentPlan}</div>
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-amber-400" />
              <div>
                <div style={{ fontFamily: fontStack }} className="text-2xl text-amber-50">{planName}</div>
                <div className="text-sm text-amber-100/60" style={{ fontFamily: monoFont }}>{planPrice} / {t.pricing.monthly}</div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {hasSubscription && (
              <button onClick={handleManage} className="px-4 py-2 border border-amber-600/40 hover:bg-amber-600/10 rounded-md text-sm">{t.billing.manage}</button>
            )}
            {!hasSubscription && (
              <button onClick={() => ctx.setView("pricing")} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md text-sm">
                {t.billing.upgrade}
              </button>
            )}
          </div>
        </div>
        {hasSubscription && (
          <div className="mt-5 pt-5 border-t border-amber-900/20 grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-amber-300/50 uppercase tracking-wider mb-1">{t.billing.nextCharge}</div>
              <div className="text-amber-50" style={{ fontFamily: monoFont }}>{nextCharge}</div>
            </div>
            <div>
              <div className="text-xs text-amber-300/50 uppercase tracking-wider mb-1">{lang === "he" ? "סטטוס" : "Status"}</div>
              <div className="text-amber-50 capitalize">{sub.subscription_status || "active"}</div>
            </div>
            <div>
              <div className="text-xs text-amber-300/50 uppercase tracking-wider mb-1">{lang === "he" ? "מחזור" : "Cycle"}</div>
              <div className="text-amber-50">{lang === "he" ? "חודשי" : "Monthly"}</div>
            </div>
          </div>
        )}
        {!hasSubscription && (
          <div className="mt-4 text-sm text-amber-100/60">
            {isHe ? "אין לך מנוי פעיל. בחר תוכנית להתחיל." : "No active subscription. Choose a plan to get started."}
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="grid md:grid-cols-2 gap-4">
        <UsageCard label={t.billing.usageDocs} used={usage?.documents || 0} max={9999} unit="" {...{ fontStack, monoFont }} />
        <UsageCard label={t.billing.usageStorage} used={(usage?.storage_mb || 0) / 1000} max={100} unit="GB" {...{ fontStack, monoFont }} />
      </div>

      {/* Invoices */}
      <div>
        <h3 style={{ fontFamily: fontStack }} className="text-xl text-amber-50 mb-3">{t.billing.invoices}</h3>
        {invoices.length === 0 ? (
          <div className="border border-amber-900/30 rounded-lg p-8 text-center text-amber-100/50 text-sm">
            {isHe ? "אין חשבוניות עדיין" : "No invoices yet"}
          </div>
        ) : (
          <div className="border border-amber-900/30 rounded-lg overflow-hidden bg-black/20">
            {invoices.map((inv, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-amber-900/10 last:border-0">
                <Receipt className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 text-sm text-amber-50" style={{ fontFamily: monoFont }}>
                  {inv.invoice_number || inv.id?.slice(0, 8)}
                </div>
                <div className="text-sm text-amber-50" style={{ fontFamily: monoFont }}>
                  {inv.currency} {inv.amount}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded border ${
                  inv.status === "paid"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}>
                  {inv.status}
                </span>
                {inv.pdf_url && (
                  <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-amber-100/50 hover:text-amber-100">
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const UsageCard = ({ label, used, max, unit, fontStack, monoFont }) => {
  const pct = Math.min(100, (used / max) * 100);
  return (
    <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20">
      <div className="text-xs text-amber-300/60 uppercase tracking-wider mb-3">{label}</div>
      <div className="flex items-baseline gap-2 mb-3">
        <span style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">{used}</span>
        {unit && <span className="text-sm text-amber-100/40" style={{ fontFamily: monoFont }}>{unit}</span>}
        <span className="text-xs text-amber-100/40 ms-auto" style={{ fontFamily: monoFont }}>/ {max}{unit}</span>
      </div>
      <div className="h-1.5 bg-amber-900/20 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   USER : Settings
   ════════════════════════════════════════════════════════════════════════ */
function UserSettings({ ctx }) {
  const { t, lang, fontStack, monoFont, showToast, user, usersApi } = ctx;
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (usersApi?.getMe) {
          const data = await usersApi.getMe();
          setProfile(data);
        } else if (user) {
          setProfile(user);
        }
        const { teams: teamsApi } = await import("../api.js");
        const teamData = await teamsApi.list();
        setTeams(teamData.teams || []);
      } catch (err) {
        console.error("Failed to load settings data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, usersApi]);

  const tabs = [
    { key: "profile", label: t.settings.profile },
    { key: "company", label: t.settings.company },
    { key: "signature", label: t.settings.signature },
  ];

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-pulse">
        <div className="w-36 h-8 bg-amber-800/20 rounded"></div>
        <div className="flex gap-6 border-b border-amber-900/30 pb-0">
          {[1,2,3].map(i => (
            <div key={i} className="w-20 h-8 bg-amber-800/20 rounded-t"></div>
          ))}
        </div>
        <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20 space-y-4">
          <div className="w-28 h-4 bg-amber-800/20 rounded"></div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-800/20"></div>
            <div className="flex-1 space-y-2">
              <div className="w-32 h-3 bg-amber-800/20 rounded"></div>
              <div className="w-24 h-2.5 bg-amber-800/20 rounded"></div>
            </div>
          </div>
          {[1,2,3].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="w-20 h-2.5 bg-amber-800/20 rounded"></div>
              <div className="w-full h-8 bg-amber-800/20 rounded"></div>
            </div>
          ))}
        </div>
        <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20 space-y-4">
          <div className="w-32 h-4 bg-amber-800/20 rounded"></div>
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="w-24 h-3 bg-amber-800/20 rounded"></div>
                <div className="w-40 h-2.5 bg-amber-800/20 rounded"></div>
              </div>
              <div className="w-10 h-5 bg-amber-800/20 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50">{t.settings.title}</h1>
      </div>

      <div className="flex border-b border-amber-900/30 gap-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-amber-500 text-amber-200"
                : "border-transparent text-amber-100/50 hover:text-amber-100/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <ProfileTab
          profile={profile}
          usersApi={usersApi}
          t={t}
          lang={lang}
          fontStack={fontStack}
          monoFont={monoFont}
          showToast={showToast}
        />
      )}

      {activeTab === "company" && (
        <CompanyTab
          profile={profile}
          teams={teams}
          usersApi={usersApi}
          t={t}
          lang={lang}
          fontStack={fontStack}
          showToast={showToast}
        />
      )}

      {activeTab === "signature" && (
        <SignatureTab
          profile={profile}
          usersApi={usersApi}
          t={t}
          lang={lang}
          fontStack={fontStack}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function ProfileTab({ profile, usersApi, t, lang, fontStack, monoFont, showToast }) {
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    preferred_language: profile?.preferred_language || "he",
    timezone: profile?.timezone || "Asia/Jerusalem",
  });
  const [notifications, setNotifications] = useState({
    notify_doc_signed: profile?.notify_doc_signed !== false,
    notify_signature_reminders: profile?.notify_signature_reminders !== false,
    notify_new_features: profile?.notify_new_features || false,
  });
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", next: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(lang === "he" ? "נא להעלות תמונה בלבד" : "Please select an image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(lang === "he" ? "גודל הקובץ חייב להיות עד 5MB" : "File size must be under 5MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setAvatarPreview(dataUrl);
      try {
        if (usersApi?.updateAvatar) {
          const result = await usersApi.updateAvatar(dataUrl);
          showToast(lang === "he" ? "התמונה נשמרה" : "Avatar saved");
        }
      } catch (err) {
        showToast(err.message || (lang === "he" ? "שגיאה בהעלאת תמונה" : "Error uploading avatar"), "error");
        setAvatarPreview(profile?.avatar_url || null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!usersApi?.updateMe) return;
    setSaving(true);
    try {
      const updated = await usersApi.updateMe(formData);
      showToast(lang === "he" ? "הפרופיל נשמר" : "Profile saved");
    } catch (err) {
      showToast(lang === "he" ? "שגיאה בשמירה" : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = async (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    try {
      await usersApi.updateMe({ [key]: value });
      showToast(lang === "he" ? "העדפות נשמרו" : "Preferences saved");
    } catch (err) {
      setNotifications(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.next !== passwordData.confirm) {
      showToast(lang === "he" ? "הסיסמאות לא תואמות" : "Passwords do not match", "error");
      return;
    }
    if (passwordData.next.length < 8) {
      showToast(lang === "he" ? "הסיסמה חייבת להיות לפחות 8 תווים" : "Password must be at least 8 characters", "error");
      return;
    }
    setChangingPassword(true);
    try {
      await usersApi.updatePassword(passwordData.next, passwordData.current);
      setPasswordData({ current: "", next: "", confirm: "" });
      setShowPasswordForm(false);
      showToast(lang === "he" ? "הסיסמה שונתה בהצלחה" : "Password changed successfully");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה בשינוי סיסמה" : "Error changing password"), "error");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard title={lang === "he" ? "תמונת פרופיל" : "Profile Picture"} fontStack={fontStack}>
        <div className="flex items-center gap-5">
          <div
            onClick={() => avatarInputRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-amber-900/30 border-2 border-amber-700/40 cursor-pointer hover:border-amber-500/60 overflow-hidden shrink-0 group"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-amber-400">
                <User className="w-8 h-8" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          <div className="text-sm text-amber-100/60">
            <p>{lang === "he" ? "לחץ להחלפת תמונה" : "Click to change photo"}</p>
            <p>{lang === "he" ? "PNG, JPG עד 5MB" : "PNG, JPG up to 5MB"}</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={t.settings.profile} fontStack={fontStack}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.name}</label>
            <input type="text" value={formData.full_name || ""} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
          </div>
          <Field label={t.settings.email} value={profile?.email || "-"} {...{ monoFont }} />
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.phone}</label>
            <input type="tel" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" placeholder="+972 50 123 4567" />
          </div>
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.language}</label>
            <select value={formData.preferred_language || "he"} onChange={e => setFormData({ ...formData, preferred_language: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none">
              <option value="he">עברית</option>
              <option value="en">English</option>
            </select>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-black font-medium rounded-md text-sm">
            {saving ? (lang === "he" ? "שומר..." : "Saving...") : (lang === "he" ? "שמור שינויים" : "Save changes")}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title={t.settings.notifications} fontStack={fontStack}>
        <ToggleRow label={t.settings.notifyDocSigned} defaultOn={notifications.notify_doc_signed}
          onChange={v => toggleNotification("notify_doc_signed", v)} />
        <ToggleRow label={t.settings.notifyReminders} defaultOn={notifications.notify_signature_reminders}
          onChange={v => toggleNotification("notify_signature_reminders", v)} />
        <ToggleRow label={t.settings.notifyFeatures} defaultOn={notifications.notify_new_features}
          onChange={v => toggleNotification("notify_new_features", v)} />
      </SettingsCard>

      <SettingsCard title={t.settings.security} fontStack={fontStack}>
        <ToggleRow label={t.settings.twoFa} desc={lang === "he" ? "אבטחה נוספת ע״י קוד SMS" : "Extra security via SMS code"} defaultOn />
        <button onClick={() => setShowPasswordForm(v => !v)}
          className="text-sm text-amber-300/80 hover:text-amber-200 flex items-center gap-1 mt-3">
          <Lock className="w-3.5 h-3.5" />
          {t.settings.changePass}
        </button>
        {showPasswordForm && (
          <div className="mt-4 space-y-3 pt-3 border-t border-amber-900/20">
            <div>
              <label className="block text-xs text-amber-100/60 mb-1">{lang === "he" ? "סיסמה נוכחית" : "Current password"}</label>
              <input type="password" value={passwordData.current} onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-amber-100/60 mb-1">{lang === "he" ? "סיסמה חדשה" : "New password"}</label>
              <input type="password" value={passwordData.next} onChange={e => setPasswordData({ ...passwordData, next: e.target.value })}
                placeholder={lang === "he" ? "לפחות 8 תווים" : "At least 8 characters"}
                className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-amber-100/60 mb-1">{lang === "he" ? "אימות סיסמה חדשה" : "Confirm new password"}</label>
              <input type="password" value={passwordData.confirm} onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleChangePassword} disabled={changingPassword}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-black font-medium rounded-md text-sm">
                {changingPassword ? (lang === "he" ? "שומר..." : "Saving...") : (lang === "he" ? "שנה סיסמה" : "Change password")}
              </button>
              <button onClick={() => { setShowPasswordForm(false); setPasswordData({ current: "", next: "", confirm: "" }); }}
                className="px-4 py-2 border border-amber-900/30 hover:bg-amber-900/20 rounded-md text-sm text-amber-100/70">
                {lang === "he" ? "ביטול" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

function CompanyTab({ profile, teams, usersApi, t, lang, fontStack, showToast }) {
  const [formData, setFormData] = useState({
    company_name: profile?.company_name || "",
    company_id: profile?.company_id || "",
    professional_role: profile?.professional_role || "",
    country_code: profile?.country_code || "",
    bar_number: profile?.bar_number || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!usersApi?.updateMe) return;
    setSaving(true);
    try {
      await usersApi.updateMe(formData);
      showToast(lang === "he" ? "פרטי החברה נשמרו" : "Company info saved");
    } catch (err) {
showToast(err.message || (lang === "he" ? "שגיאה בשמירה" : "Failed to save"), "error");
    } finally {
      setSaving(false);
    }
  };
 
  const primaryTeam = teams?.[0];

  return (
    <div className="space-y-6">
      <SettingsCard title={t.settings.company} fontStack={fontStack}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.companyName}</label>
            <input type="text" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.companyId}</label>
            <input type="text" value={formData.company_id} onChange={e => setFormData({ ...formData, company_id: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.professionalRole}</label>
            <input type="text" value={formData.professional_role} onChange={e => setFormData({ ...formData, professional_role: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.country}</label>
            <select value={formData.country_code} onChange={e => setFormData({ ...formData, country_code: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none">
              <option value="IL">Israel 🇮🇱</option>
              <option value="US">United States 🇺🇸</option>
              <option value="GB">United Kingdom 🇬🇧</option>
              <option value="CA">Canada 🇨🇦</option>
              <option value="AU">Australia 🇦🇺</option>
              <option value="DE">Germany 🇩🇪</option>
              <option value="FR">France 🇫🇷</option>
              <option value="ES">Spain 🇪🇸</option>
              <option value="IT">Italy 🇮🇹</option>
              <option value="NL">Netherlands 🇳🇱</option>
              <option value="CH">Switzerland 🇨🇭</option>
              <option value="AE">UAE 🇦🇪</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-amber-100/60 mb-1">{t.settings.barNumber}</label>
            <input type="text" value={formData.bar_number} onChange={e => setFormData({ ...formData, bar_number: e.target.value })}
              className="w-full bg-black/30 border border-amber-900/30 rounded-md px-3 py-2 text-sm text-amber-50 focus:border-amber-600/60 focus:outline-none" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-black font-medium rounded-md text-sm">
            {saving ? (lang === "he" ? "שומר..." : "Saving...") : (lang === "he" ? "שמור שינויים" : "Save changes")}
          </button>
        </div>
      </SettingsCard>

      {primaryTeam && (
        <SettingsCard title={t.settings.teamName} fontStack={fontStack}>
          <div className="space-y-3">
            <Field label={t.settings.teamName} value={primaryTeam.name || "-"} />
            {primaryTeam.logo_url && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-amber-100/70">{t.settings.teamLogo}</span>
                <img src={primaryTeam.logo_url} alt="Team logo" className="h-10 w-auto rounded border border-amber-900/30" />
              </div>
            )}
            <p className="text-xs text-amber-100/40 mt-2">
              {lang === "he" ? "נהל את הגדרות הצוות בדף" : "Manage team settings in"}{" "}
              <a href="/app/team" className="text-amber-400 hover:underline">{t.team.title}</a>
            </p>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

function SignatureTab({ profile, usersApi, t, lang, fontStack, showToast }) {
  const [signatureType, setSignatureType] = useState("drawn");
  const [typedName, setTypedName] = useState("");
  const [signatureData, setSignatureData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(profile?.saved_signature_url || null);

  const handleSignatureChange = (dataUrl, typed) => {
    setSignatureData(dataUrl || typed || null);
  };

  const handleSave = async () => {
    if (!signatureData || !usersApi?.updateSignature) return;
    setSaving(true);
    try {
      let dataToSave = signatureData;
      if (signatureType === "typed" && typedName) {
        const c = document.createElement("canvas");
        c.width = 400;
        c.height = 100;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 400, 100);
          ctx.fillStyle = "#000000";
          ctx.font = "36px cursive";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(typedName, 200, 50);
          dataToSave = c.toDataURL("image/png");
        }
      }
      const result = await usersApi.updateSignature(dataToSave);
      setSavedUrl(result.signature_url);
      showToast(lang === "he" ? "החתימה נשמרה" : "Signature saved");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה בשמירת חתימה" : "Failed to save signature"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!usersApi?.updateMe) return;
    setSaving(true);
    try {
      await usersApi.updateMe({ saved_signature_url: null });
      setSavedUrl(null);
      setSignatureData(null);
      setTypedName("");
      showToast(lang === "he" ? "החתימה הוסרה" : "Signature removed");
    } catch (err) {
      showToast(err.message || (lang === "he" ? "שגיאה" : "Error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard title={t.settings.signature} fontStack={fontStack}>
        <SignaturePanel
          onSignatureChange={handleSignatureChange}
          signatureType={signatureType}
          setSignatureType={setSignatureType}
          typedName={typedName}
          setTypedName={setTypedName}
          isDraggable={false}
        />
        <div className="flex gap-3 mt-4 pt-4 border-t border-amber-900/20">
          <button onClick={handleSave} disabled={saving || !signatureData}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-black font-medium rounded-md text-sm">
            {saving ? (lang === "he" ? "שומר..." : "Saving...") : t.settings.saveSignature}
          </button>
          {savedUrl && (
            <button onClick={handleRemove} disabled={saving}
              className="px-4 py-2 border border-red-500/40 hover:bg-red-500/10 rounded-md text-sm text-red-300">
              {t.settings.removeSignature}
            </button>
          )}
        </div>
      </SettingsCard>

      {savedUrl && (
        <SettingsCard title={lang === "he" ? "חתימה שמורה" : "Saved Signature"} fontStack={fontStack}>
          <div className="flex items-center justify-center bg-white rounded-lg p-4 max-w-xs mx-auto">
            <img src={savedUrl} alt="Saved signature" className="max-h-16" />
          </div>
        </SettingsCard>
      )}

      {!savedUrl && !signatureData && (
        <div className="text-center text-sm text-amber-100/40 py-8">
          {t.settings.noSignature}
        </div>
      )}
    </div>
  );
}

const SettingsCard = ({ title, fontStack, children }) => (
  <div className="border border-amber-900/30 rounded-lg p-5 bg-black/20">
    <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50 mb-4">{title}</h3>
    {children}
  </div>
);
const Field = ({ label, value, monoFont }) => (
  <div className="flex items-center justify-between py-2 border-b border-amber-900/10 last:border-0">
    <span className="text-sm text-amber-100/70">{label}</span>
    <span className="text-sm text-amber-50" style={{ fontFamily: monoFont }}>{value}</span>
  </div>
);
const ToggleRow = ({ label, desc, defaultOn, onChange }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-amber-900/10 last:border-0 gap-4">
      <div className="min-w-0">
        <div className="text-sm text-amber-50">{label}</div>
        {desc && <div className="text-xs text-amber-100/40 mt-0.5">{desc}</div>}
      </div>
      <button
        onClick={() => { const next = !on; setOn(next); onChange?.(next); }}
        className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${on ? "bg-amber-500" : "bg-stone-600"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${on ? "start-[18px]" : "start-0.5"}`} />
      </button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   End of User pages
   ════════════════════════════════════════════════════════════════════════ */

export {
  UserDashboard, UserDocuments, UserTemplates, UserTeam,
  UserReferrals, UserApiKeys, UserBilling, UserSettings
};
