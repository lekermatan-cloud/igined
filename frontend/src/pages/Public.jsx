// ════════════════════════════════════════════════════════════════════════
// Public pages  ·  Landing page + Pricing page + Auth page
// These are unauthenticated views — visible to anyone, used for marketing.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles, ShieldCheck, Zap, Users, Globe, FileSignature, Award,
  Workflow, Code2, Crown, Check, ArrowRight, ArrowLeft, Star,
  Hash, MousePointer2, Video, Mail, Lock, User, X, Eye, EyeOff
} from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";

export function Landing({ ctx }) {
  const { t, lang, isRTL, fontStack, monoFont, setView } = ctx;
  return (
    <div className="space-y-20">
      <section className="pt-12 pb-6">
        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-5">{t.hero.eyebrow}</div>
        <h1 style={{ fontFamily: fontStack, lineHeight: 1.05 }} className="text-5xl md:text-7xl font-light max-w-5xl mb-6">
          {t.hero.title}{" "}
          <em style={{ color: "#c8924a", fontStyle: "italic" }}>{t.hero.titleEm}</em>
        </h1>
        <p className="text-base md:text-xl text-amber-100/60 max-w-3xl leading-relaxed mb-8">{t.hero.subtitle}</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setView("auth")} className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md transition-colors">
            {t.hero.cta}
            {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
        <div className="mt-8 flex items-center gap-2 text-xs text-amber-100/40">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
          <span className="ms-2">{t.hero.trust}</span>
        </div>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: Hash, color: "#c8924a", t: lang === "he" ? "טביעת אצבע SHA-256" : "SHA-256 fingerprint", d: lang === "he" ? "כל קובץ מקבל hash קריפטוגרפי + חותמת זמן UTC. הוכחה משפטית." : "Every file gets a cryptographic hash + UTC timestamp. Legally defensible." },
          { icon: MousePointer2, color: "#7a9eb0", t: lang === "he" ? "מיקום שדות מתקדם" : "Advanced field placement", d: lang === "he" ? "גרור שדות חתימה, תאריך, ראשי תיבות וטקסט בדיוק היכן שצריך." : "Drag signature, date, initial and text fields with pixel precision." },
          { icon: Video, color: "#a6926e", t: lang === "he" ? "חתימה על סרטונים" : "Video & audio signing", d: lang === "he" ? "סמן בעלות על סרטון, פודקאסט או יצירה דיגיטלית." : "Mark ownership of videos, podcasts and digital art." },
          { icon: Workflow, color: "#9b7da3", t: lang === "he" ? "אוטומציה חכמה" : "Smart automation", d: lang === "he" ? "flow-ים אוטומטיים שדוחפים חותמים ומונעים נטישה." : "Auto flows that nudge signers and prevent churn." },
          { icon: Code2, color: "#7fa089", t: lang === "he" ? "REST API + Webhooks" : "REST API + webhooks", d: lang === "he" ? "שלב אצלך תוך שעה. תיעוד נקי, SDK-ים לכל שפה." : "Integrate in an hour. Clean docs, SDKs for every language." },
          { icon: Globe, color: "#c8924a", t: lang === "he" ? "דו-לשוני מלא" : "Fully bilingual", d: lang === "he" ? "ממשק עברית RTL ואנגלית LTR מהיום הראשון." : "RTL Hebrew and LTR English from day one." }
        ].map((f, i) => (
          <div key={i} className="p-6 rounded-lg border border-amber-900/20 bg-gradient-to-br from-white/[0.02] to-transparent hover:border-amber-600/40 transition-all">
            <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4" style={{ background: `${f.color}15`, border: `1px solid ${f.color}40` }}>
              <f.icon className="w-5 h-5" style={{ color: f.color }} />
            </div>
            <h3 style={{ fontFamily: fontStack }} className="text-lg text-amber-50 mb-2">{f.t}</h3>
            <p className="text-sm text-amber-100/55 leading-relaxed">{f.d}</p>
          </div>
        ))}
      </section>

      <section className="text-center max-w-3xl mx-auto py-8">
        <h2 style={{ fontFamily: fontStack }} className="text-4xl font-light mb-4">
          {lang === "he" ? "מוכן להתחיל?" : "Ready to start?"}
        </h2>
        <p className="text-amber-100/60 mb-6">
          {lang === "he" ? "התחל חינם, ללא התחייבות. שדרג כשתהיה מוכן." : "Start free, no commitment. Upgrade when ready."}
        </p>
        <button onClick={() => setView("auth")} className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md transition-colors">
          {lang === "he" ? "התחל עכשיו" : "Get started now"}
        </button>
      </section>

      <Pricing ctx={ctx} onSelectPlan={() => {}} />
    </div>
  );
}

export function Auth({ ctx }) {
  const { t, lang, isRTL, fontStack, setView, login, register, googleLogin, showToast } = ctx;
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
    termsAccepted: false,
    privacyAccepted: false
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "register" && formData.password !== formData.confirmPassword) {
      setError(isHe ? "הסיסמאות אינן תואמות" : "Passwords do not match");
      return;
    }

    if (mode === "register" && (!formData.termsAccepted || !formData.privacyAccepted)) {
      setError(isHe ? "יש לאשר את תנאי השימוש ומדיניות הפרטיות" : "Please accept the terms of use and privacy policy");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await login(formData.email, formData.password);
        showToast(lang === "he" ? "התחברות הצליחה!" : "Logged in successfully!");
        setView("userDashboard");
      } else {
        const referralCode = sessionStorage.getItem("referral_code");
        await register({
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
          phone: formData.phone,
          terms_accepted: formData.termsAccepted,
          privacy_accepted: formData.privacyAccepted,
          referral_code: referralCode,
        });
        sessionStorage.removeItem("referral_code");
        showToast(lang === "he" ? "נוצר חשבון בהצלחה!" : "Account created successfully!");
        setView("userDashboard");
      }
    } catch (err) {
      setError(err.message || (lang === "he" ? "שגיאה. נסה שוב." : "Error. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    setLoading(true);
    setError("");
    try {
      await googleLogin(credentialResponse.credential);
      showToast(lang === "he" ? "התחברות הצליחה!" : "Logged in successfully!");
      setView("userDashboard");
    } catch (err) {
      setError(err.message || (lang === "he" ? "שגיאה בהתחברות עם Google" : "Google sign-in failed"));
    } finally {
      setLoading(false);
    }
  }, [lang, showToast, setView, googleLogin]);

  const googleSignIn = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError("Google sign-in failed"),
    flow: "implicit",
  });

  const referralCode = typeof window !== "undefined" ? sessionStorage.getItem("referral_code") : null;
  const [referralNote, setReferralNote] = useState(referralCode ? (lang === "he" ? "הוזמנת על ידי חבר - 50% הנחה!" : "Referred by a friend - 50% off!") : "");

  useEffect(() => {
    const code = sessionStorage.getItem("referral_code");
    if (code) {
      setReferralNote(lang === "he" ? "הוזמנת על ידי חבר - 50% הנחה!" : "Referred by a friend - 50% off!");
    }
  }, [lang]);

  const isHe = lang === "he";

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 style={{ fontFamily: fontStack }} className="text-3xl font-light text-amber-50 mb-2">
            {mode === "login" ? (isHe ? "כניסה לחשבון" : "Sign in") : (isHe ? "יצירת חשבון" : "Create account")}
          </h1>
          <p className="text-amber-100/50">
            {mode === "login" 
              ? (isHe ? "ברוך הבא בחזרה!" : "Welcome back!")
              : (isHe ? "הצטרף לסיגנד היום" : "Join Sigined today")}
          </p>
        </div>

        {referralNote && mode === "register" && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center text-emerald-200 text-sm">
            {referralNote}
          </div>
        )}

        <button
          type="button"
          onClick={() => googleSignIn()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-md bg-white hover:bg-gray-50 hover:shadow-md disabled:opacity-50 transition-all border border-gray-300 mb-6"
        >
          <svg width="22" height="22" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          <span className="text-base font-medium text-gray-700">{isHe ? "המשך עם Google" : "Continue with Google"}</span>
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-amber-900/30"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0f1422] px-3 text-amber-100/40">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-medium text-sm">
                  {isHe ? "שגיאה" : "Error"}
                </span>
              </div>
              <p className="text-red-300/80 text-sm">{error}</p>
            </div>
          )}

          {mode === "register" && (
            <div>
              <label className="block text-sm text-amber-100/70 mb-1.5">
                {isHe ? "שם מלא" : "Full name"}
              </label>
              <div className="relative">
                <div className="absolute top-1/2 -translate-y-1/2 start-3 flex items-center pointer-events-none z-10">
                  <User className="w-4 h-4 text-amber-100/40" />
                </div>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full ps-10 pe-3 py-2.5 rounded-md bg-black/30 border border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                  placeholder={isHe ? "ישראל ישראלי" : "John Doe"}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-amber-100/70 mb-1.5">
              {isHe ? "אימייל" : "Email"}
            </label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 start-3 flex items-center pointer-events-none z-10">
                <Mail className="w-4 h-4 text-amber-100/40" />
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full ps-10 pe-3 py-2.5 rounded-md bg-black/30 border border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-amber-100/70 mb-1.5">
              {isHe ? "סיסמה" : "Password"}
            </label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 start-3 flex items-center pointer-events-none z-10">
                <Lock className="w-4 h-4 text-amber-100/40" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full ps-10 pe-10 py-2.5 rounded-md bg-black/30 border border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2 end-3 flex items-center justify-center p-0.5 text-amber-100/40 hover:text-amber-100 z-10"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm text-amber-100/70 mb-1.5">
                {isHe ? "אימות סיסמה" : "Confirm password"}
              </label>
              <div className="relative">
                <div className="absolute top-1/2 -translate-y-1/2 start-3 flex items-center pointer-events-none z-10">
                  <Lock className="w-4 h-4 text-amber-100/40" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full ps-10 pe-3 py-2.5 rounded-md bg-black/30 border border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {mode === "register" && (
            <div>
              <label className="block text-sm text-amber-100/70 mb-1.5">
                {isHe ? "טלפון (אופציונלי)" : "Phone (optional)"}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-3 py-2.5 rounded-md bg-black/30 border border-amber-900/30 text-amber-100 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
                placeholder="+972 50 123 4567"
              />
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({...formData, termsAccepted: e.target.checked})}
                  className="mt-1 w-4 h-4 rounded border-amber-900/40 bg-black/30 text-amber-600 focus:ring-amber-600/50 focus:ring-offset-0"
                />
                <span className="text-sm text-amber-100/60 group-hover:text-amber-100/80">
                  {isHe ? "אני מסכים ל" : "I agree to the "}
                  <button type="button" className="text-amber-400 hover:underline">
                    {isHe ? "תנאי השימוש" : "Terms of Service"}
                  </button>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.privacyAccepted}
                  onChange={(e) => setFormData({...formData, privacyAccepted: e.target.checked})}
                  className="mt-1 w-4 h-4 rounded border-amber-900/40 bg-black/30 text-amber-600 focus:ring-amber-600/50 focus:ring-offset-0"
                />
                <span className="text-sm text-amber-100/60 group-hover:text-amber-100/80">
                  {isHe ? "אני מסכים ל" : "I agree to the "}
                  <button type="button" className="text-amber-400 hover:underline">
                    {isHe ? "מדיניות הפרטיות" : "Privacy Policy"}
                  </button>
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-black font-medium rounded-md transition-colors"
          >
            {loading 
              ? (isHe ? "טוען..." : "Loading...")
              : (mode === "login" ? (isHe ? "כניסה" : "Sign in") : (isHe ? "הרשמה" : "Sign up"))
            }
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="text-sm text-amber-100/70 hover:text-amber-100"
          >
            {mode === "login" 
              ? (isHe ? "אין לך חשבון? הירשם כאן" : "Don't have an account? Sign up")
              : (isHe ? "יש לך חשבון? התחבר כאן" : "Already have an account? Sign in")
            }
          </button>
        </div>

        <button
          onClick={() => { setView("landing"); }}
          className="absolute top-4 end-4 p-2 rounded-full hover:bg-white/5 text-amber-100/50 hover:text-amber-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function Pricing({ ctx, onSelectPlan }) {
  const { t, lang, isRTL, fontStack, monoFont, setView } = ctx;
  const isHe = lang === "he";

  const plans = [
    {
      name: isHe ? "חינם" : "Free",
      key: "free",
      price: "₪0",
      period: isHe ? "/חודש" : "/mo",
      desc: isHe ? "להתחלה" : "For starters",
      features: [
        isHe ? "5 מסמכים/חודש" : "5 docs/month",
        isHe ? "חתימה אלקטרונית בסיסית" : "Basic e-signature",
        isHe ? "תבנית אחת" : "1 template",
        isHe ? "שפה אחת" : "1 language"
      ],
      cta: isHe ? "התחל חינם" : "Start free",
      popular: false,
      disabled: false
    },
    {
      name: isHe ? "בסיסי" : "Basic",
      key: "basic",
      price: "₪30",
      period: isHe ? "/חודש" : "/mo",
      desc: isHe ? "לעסקים קטנים" : "For small businesses",
      features: [
        isHe ? "50 מסמכים/חודש" : "50 docs/month",
        isHe ? "חתימה מתקדמת" : "Advanced signature",
        isHe ? "10 תבניות" : "10 templates",
        isHe ? "שני משתמשים" : "2 team members",
        isHe ? "תמיכה באימייל" : "Email support"
      ],
      cta: isHe ? "התחל גרסה בסיסית" : "Start basic",
      popular: false,
      disabled: false
    },
    {
      name: isHe ? "מקצועי" : "Pro",
      key: "pro",
      price: "₪120",
      period: isHe ? "/חודש" : "/mo",
      desc: isHe ? "לצמיחה" : "For growth",
      features: [
        isHe ? "מסמכים ללא הגבלה" : "Unlimited docs",
        isHe ? "חתימה מתקדמת + חותמת זמן" : "Advanced + timestamp",
        isHe ? "תבניות ללא הגבלה" : "Unlimited templates",
        isHe ? "5 משתמשים בצוות" : "5 team members",
        isHe ? "API מלא" : "Full API access",
        isHe ? "תמיכה בצ'אט" : "Chat support"
      ],
      cta: isHe ? "התחל גרסה מקצועית" : "Start pro",
      popular: true,
      disabled: false
    },
    {
      name: isHe ? "ארגון" : "Enterprise",
      key: "enterprise",
      price: isHe ? "צור קשר" : "Contact us",
      period: "",
      desc: isHe ? "לארגונים גדולים" : "For large organizations",
      features: [
        isHe ? "הכל ב-Pro" : "Everything in Pro",
        isHe ? "משתמשים ללא הגבלה" : "Unlimited users",
        isHe ? "דומיין מותאם" : "Custom domain",
        isHe ? "אימות חברתי" : "SSO/SAML",
        isHe ? "ניהול מלא" : "Full admin control",
        isHe ? "מנהל חשבון ייעודי" : "Dedicated account manager"
      ],
      cta: isHe ? "צור קשר" : "Contact us",
      popular: false,
      disabled: true
    }
  ];

  return (
    <div id="pricing" className="space-y-12 py-8">
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/60 mb-2">{t.pricing.eyebrow}</div>
        <h1 style={{ fontFamily: fontStack }} className="text-4xl md:text-5xl font-light text-amber-50 mb-4">
          {t.pricing.title}
        </h1>
        <p className="text-amber-100/60 max-w-2xl mx-auto">
          {isHe ? "תוכנית שמתאימה לצרכים שלך. שדרג או ירד בכל זמן." : "Plans that fit your needs. Upgrade or downgrade anytime."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, i) => (
          <div
            key={i}
            className={`relative p-6 rounded-xl border ${
              plan.popular
                ? "border-amber-500/50 bg-gradient-to-b from-amber-950/30 to-transparent"
                : "border-amber-900/30 bg-black/20"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 start-1/2 -translate-x-1/2 px-3 py-1 bg-amber-600 text-black text-xs font-medium rounded-full">
                {isHe ? "מומלץ" : "Popular"}
              </div>
            )}
            <div className="text-lg text-amber-50 mb-1" style={{ fontFamily: fontStack }}>{plan.name}</div>
            <div className="text-3xl text-amber-100 mb-1" style={{ fontFamily: monoFont }}>
              {plan.price}<span className="text-sm text-amber-100/50">{plan.period}</span>
            </div>
            <div className="text-xs text-amber-100/50 mb-4">{plan.desc}</div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, j) => (
                <li key={j} className="text-sm text-amber-100/70 flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => plan.key !== "free" && plan.key !== "enterprise" && onSelectPlan(plan.key)}
              disabled={plan.key === "free" || plan.key === "enterprise"}
              className={`w-full py-2.5 rounded-md font-medium transition-colors ${
                plan.disabled
                  ? "border border-amber-900/30 text-amber-100/30 cursor-not-allowed"
                  : plan.popular
                  ? "bg-amber-600 hover:bg-amber-500 text-black cursor-pointer"
                  : "border border-amber-600/40 hover:bg-amber-600/10 text-amber-100 cursor-pointer"
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center text-amber-100/50 text-sm">
        {isHe ? "כל המחירים בש\"ח. כולל מע\"מ." : "All prices in ILS. VAT included."}
      </div>
    </div>
  );
}