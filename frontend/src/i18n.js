// ════════════════════════════════════════════════════════════════════════
// i18n  ·  All translation strings for Sigined (Hebrew + English)
// ════════════════════════════════════════════════════════════════════════
// To add a new translation key, add it to BOTH `he` and `en` blocks below.
// Access in components via:  const t = STR[lang];  t.user.welcome
// ════════════════════════════════════════════════════════════════════════

export const STR = {
  he: {
    brand: "סיגנד", tagline: "חתום. אמת. שלוט.",
    role: { user: "משתמש", admin: "מנהל" },
    common: {
      back: "חזרה", next: "הבא", save: "שמור", cancel: "בטל", delete: "מחק",
      edit: "ערוך", view: "צפייה", search: "חיפוש", filter: "סינון", all: "הכל",
      active: "פעיל", inactive: "לא פעיל", suspended: "מושעה", trial: "ניסיון",
      paused: "מושהה", running: "פועל", draft: "טיוטה",
      sent: "נשלח", in_progress: "בתהליך", completed: "הושלם",
      declined: "נדחה", cancelled: "בוטל", expired: "פג תוקף",
      open: "פתח", new: "חדש", more: "עוד", less: "פחות",
      yes: "כן", no: "לא", loading: "טוען...", noResults: "אין תוצאות",
      copyLink: "העתק קישור", copied: "הועתק!", today: "היום", yesterday: "אתמול",
      daysAgo: "ימים", upgrade: "שדרג"
    },
    nav: {
      home: "בית", dashboard: "לוח בקרה", documents: "מסמכים",
      templates: "תבניות", team: "צוות", referrals: "הפניות",
      apiKeys: "מפתחות API", billing: "חיובים", settings: "הגדרות",
      pricing: "תמחור", features: "תכונות",
      adminOverview: "סקירה", customers: "לקוחות", atRisk: "לקוחות בסיכון",
      automation: "אוטומציה", campaigns: "קמפיינים", cohorts: "קוהורטות",
      support: "תמיכה"
    },
    sections: { product: "מוצר", growth: "צמיחה", account: "חשבון", admin: "ניהול" },
    hero: {
      eyebrow: "פלטפורמת חתימה מהדור הבא",
      title: "חתימה אלקטרונית עם",
      titleEm: "הוכחת בעלות",
      subtitle: "מסמכים · תמונות · סרטונים · מוצרים דיגיטליים. SHA-256, חותמת זמן בלתי ניתנת לזיוף, ו-API מלא — בעברית ובאנגלית, מהיום הראשון.",
      cta: "התחל בחינם", secondary: "ראה תמחור",
      trust: "מהימן ע״י עורכי דין, יזמים ויוצרי תוכן"
    },
    user: {
      welcome: "שלום, מתן",
      quickActions: "פעולות מהירות", uploadDoc: "העלה מסמך",
      newTemplate: "תבנית חדשה", inviteTeam: "הזמן צוות", refer: "הפנה חבר",
      stats: {
        signed: "מסמכים חתומים", pending: "ממתינים", certs: "תעודות", team: "חברי צוות"
      },
      recentDocs: "מסמכים אחרונים",
      onboarding: "השלם את ההגדרה",
      onboardingSteps: {
        upload: "העלה מסמך ראשון", sign: "חתום על מסמך", invite: "הזמן חבר צוות",
        api: "צור מפתח API", brand: "הוסף לוגו"
      },
      health: "בריאות החשבון"
    },
    docs: {
      title: "המסמכים שלי",
      filters: { all: "הכל", signed: "חתומים", pending: "ממתינים", drafts: "טיוטות" },
      newDoc: "מסמך חדש", search: "חפש מסמכים...",
      empty: "אין מסמכים עדיין"
    },
    templates: {
      title: "תבניות", subtitle: "התחל מהר עם תבניות מוכנות. כולן בעברית ואנגלית.",
      browse: "עיין בכולן", useTemplate: "השתמש", preview: "תצוגה",
      categories: { all: "הכל", legal: "משפט", business: "עסקים", real: "נדל״ן", hr: "משאבי אנוש", sales: "מכירות", creative: "יצירה" }
    },
    team: {
      title: "ניהול צוות",
      subtitle: "הזמן חברי צוות וקבע הרשאות",
      invite: "הזמן חבר", inviteCta: "שלח הזמנה",
      seats: "מקומות", member: "חבר",
      roles: { owner: "בעלים", admin: "מנהל", editor: "עורך", viewer: "צופה" }
    },
    referrals: {
      title: "תוכנית הפניות",
      subtitle: "הפנה חבר וקבל חודש חינם. הוא מקבל 50% הנחה.",
      yourLink: "הקישור שלך",
      stats: { invited: "הוזמנו", joined: "הצטרפו", earned: "צברת" },
      howItWorks: "איך זה עובד",
      steps: [
        "שתף את הקישור האישי שלך",
        "החבר נרשם וחותם על מסמך ראשון",
        "שניכם מקבלים חודש חינם"
      ],
      copyLink: "העתק קישור הפניה", shareEmail: "שלח במייל"
    },
    api: {
      title: "מפתחות API + Webhooks",
      subtitle: "שלב את Sigined במערכות שלך עם REST API ו-webhooks",
      keysTitle: "מפתחות פעילים", newKey: "צור מפתח",
      keyName: "שם המפתח", lastUsed: "שימוש אחרון", reveal: "חשף",
      webhooksTitle: "Webhooks", newWebhook: "הוסף Webhook",
      events: "אירועים", endpoint: "כתובת",
      docs: "צפה בתיעוד API"
    },
    billing: {
      title: "תוכנית וחיובים",
      currentPlan: "התוכנית הנוכחית", upgrade: "שדרג", manage: "נהל",
      nextCharge: "חיוב הבא", paymentMethod: "אמצעי תשלום",
      invoices: "חשבוניות", download: "הורד",
      usage: "שימוש", usageDocs: "מסמכים החודש",
      usageStorage: "אחסון בשימוש"
    },
    settings: {
      title: "הגדרות",
      profile: "פרופיל", company: "חברה", signature: "חתימה",
      name: "שם", email: "מייל", phone: "טלפון", language: "שפה",
      companyName: "שם חברה", companyId: "ח.פ / ע.מ", professionalRole: "תפקיד",
      country: "מדינה", barNumber: "מספר לשכה",
      teamName: "שם הצוות", teamLogo: "לוגו הצוות",
      notifications: "התראות", security: "אבטחה",
      twoFa: "אימות דו-שלבי", changePass: "שנה סיסמה",
      signatureType: "סוג חתימה", signatureTyped: "הקלד",
      signatureDrawn: "צייר", signatureUpload: "העלה",
      saveSignature: "שמור חתימה", removeSignature: "הסר חתימה",
      noSignature: "טרם נשמרה חתימה",
      notifyDocSigned: "מסמך נחתם", notifyReminders: "תזכורות חתימה",
      notifyFeatures: "פיצ׳רים חדשים"
    },
    admin: {
      welcome: "ברוך הבא, אדמין",
      overview: { title: "סקירה כללית" },
      mrr: "MRR", arr: "ARR", activeCustomers: "לקוחות פעילים",
      churnRate: "שיעור נטישה", ltv: "ערך חיים ממוצע", cac: "CAC",
      revByPlan: "הכנסות לפי תוכנית", recentActivity: "פעילות אחרונה",
      thisMonth: "החודש", vsLast: "לעומת חודש קודם",
      topCountries: "מדינות מובילות",
      customers: {
        title: "ניהול לקוחות", search: "חפש לקוח...",
        addCustomer: "הוסף לקוח", suspend: "השעה", activate: "הפעל"
      },
      atRisk: {
        title: "לקוחות בסיכון נטישה",
        subtitle: "זוהו אוטומטית לפי ירידה בפעילות, חוסר התחברות ו-engagement",
        score: "ציון בריאות", lastActive: "פעיל לאחרונה", trend: "מגמה",
        action: "פעולה מומלצת", sendReengagement: "שלח קמפיין",
        offerDiscount: "הצע הנחה", scheduleCall: "קבע שיחה",
        riskHigh: "סיכון גבוה", riskMed: "סיכון בינוני", riskLow: "סיכון נמוך"
      },
      automation: {
        title: "אוטומציית מייל",
        subtitle: "טייס אוטומטי - flows שרצים בלי שתצטרך להרים אצבע",
        newFlow: "צור Flow חדש",
        active: "פעיל", paused: "מושהה",
        stats: { sent: "נשלחו", opens: "פתיחות", clicks: "קליקים", conversions: "המרות" },
        flowSteps: "שלבים", trigger: "טריגר",
        flows: {
          welcome: { name: "סדרת ברוכים הבאים", desc: "מצטרף חדש → 4 מיילים על פני 7 ימים", trigger: "הרשמה" },
          trial: { name: "ניסיון מסתיים", desc: "תזכורת 3, 1 יום לפני סיום ניסיון + הצעה", trigger: "ניסיון פעיל" },
          churn: { name: "מנע נטישה", desc: "לקוח לא נכנס 14 יום → קמפיין החזרה", trigger: "חוסר פעילות" },
          winback: { name: "החזר לקוח שביטל", desc: "ביטל מנוי → שלוש פניות במהלך 30 יום", trigger: "ביטול מנוי" },
          referral: { name: "דחיפת הפניה", desc: "לקוח פעיל 30 יום → תזכורת לתוכנית הפניות", trigger: "lifetime ≥ 30" },
          feature: { name: "הכרזה על פיצ׳ר חדש", desc: "פיצ׳ר חדש עלה → הודעה לכל הפעילים", trigger: "ידני" }
        }
      },
      campaigns: {
        title: "קמפיינים",
        subtitle: "שליחה ידנית של מיילים לסגמנטים מותאמים",
        new: "קמפיין חדש", recipient: "נמענים", sentAt: "נשלח", openRate: "% פתיחות"
      },
      cohorts: { title: "שימור לפי קוהורטה", subtitle: "אחוז משתמשים שנשארים פעילים לפי חודש הצטרפות" },
      support: {
        title: "תיבת תמיכה", new: "פתוח", closed: "סגור",
        reply: "השב", priority: { high: "דחוף", med: "רגיל", low: "נמוך" }
      }
    },
    pricing: {
      title: "תמחור פשוט. ערך גלובלי.",
      subtitle: "התחל בחינם. שדרג כשאתה מוכן.",
      monthly: "לחודש",
      tiers: {
        free: { name: "חינם", price: "0", desc: "התחל לבד" },
        basic: { name: "בסיסי", price: "30", currency: "₪", priceUsd: "≈ $8", desc: "ליחידים ועוסקים" },
        pro: { name: "מקצועי", price: "100", currency: "$", priceIls: "≈ ₪370", desc: "לעסקים ויוצרים", popular: "פופולרי" },
        enterprise: { name: "ארגוני", price: "צור קשר", desc: "לארגונים ומשרדי עו״ד" }
      },
      cta: { free: "התחל חינם", paid: "התחל ניסיון", contact: "צור קשר" },
      features: {
        free: ["3 מסמכים בחודש", "חתימה דיגיטלית בסיסית", "טביעת SHA-256"],
        basic: ["50 מסמכים בחודש", "ריבוי חותמים", "תבניות מוכנות", "אחסון 5GB"],
        pro: ["מסמכים ללא הגבלה", "חתימה על סרטונים ותמונות", "מיקום שדות מתקדם", "תעודות בעלות מודפסות", "REST API + Webhooks", "מיתוג מותאם", "אחסון 100GB", "תמיכה מועדפת"],
        enterprise: ["כל מה שב-Pro", "SSO + SAML", "SLA 99.99%", "מנהל לקוח ייעודי", "פריסה On-prem"]
      }
    },
    toasts: {
      copied: "הועתק ללוח", flowEnabled: "ה-Flow הופעל", flowDisabled: "ה-Flow הושהה",
      campaignSent: "הקמפיין נשלח", inviteSent: "ההזמנה נשלחה",
      docCreated: "המסמך נוצר", planUpdated: "התוכנית עודכנה",
      keyCreated: "מפתח API נוצר", customerSuspended: "הלקוח הושעה",
      customerActivated: "הלקוח הופעל", reengagementSent: "קמפיין החזרה נשלח"
    }
  },
  en: {
    brand: "Sigined", tagline: "Sign. Verify. Own.",
    role: { user: "User", admin: "Admin" },
    common: {
      back: "Back", next: "Next", save: "Save", cancel: "Cancel", delete: "Delete",
      edit: "Edit", view: "View", search: "Search", filter: "Filter", all: "All",
      active: "Active", inactive: "Inactive", suspended: "Suspended", trial: "Trial",
      paused: "Paused", running: "Running", draft: "Draft",
      sent: "Sent", in_progress: "In Progress", completed: "Completed",
      declined: "Declined", cancelled: "Cancelled", expired: "Expired",
      open: "Open", new: "New", more: "More", less: "Less",
      yes: "Yes", no: "No", loading: "Loading...", noResults: "No results",
      copyLink: "Copy link", copied: "Copied!", today: "Today", yesterday: "Yesterday",
      daysAgo: "days ago", upgrade: "Upgrade"
    },
    nav: {
      home: "Home", dashboard: "Dashboard", documents: "Documents",
      templates: "Templates", team: "Team", referrals: "Referrals",
      apiKeys: "API keys", billing: "Billing", settings: "Settings",
      pricing: "Pricing", features: "Features",
      adminOverview: "Overview", customers: "Customers", atRisk: "At-risk",
      automation: "Automation", campaigns: "Campaigns", cohorts: "Cohorts",
      support: "Support"
    },
    sections: { product: "Product", growth: "Growth", account: "Account", admin: "Admin" },
    hero: {
      eyebrow: "Next-generation signing platform",
      title: "E-signatures with",
      titleEm: "ownership proof",
      subtitle: "Documents · Images · Videos · Digital goods. SHA-256 fingerprinting, immutable timestamps, and a full REST API — bilingual from day one.",
      cta: "Start free", secondary: "See pricing",
      trust: "Trusted by lawyers, founders, and creators"
    },
    user: {
      welcome: "Welcome, Matan",
      quickActions: "Quick actions", uploadDoc: "Upload document",
      newTemplate: "New template", inviteTeam: "Invite team", refer: "Refer a friend",
      stats: {
        signed: "Signed", pending: "Pending", certs: "Certificates", team: "Team members"
      },
      recentDocs: "Recent documents",
      onboarding: "Finish setup",
      onboardingSteps: {
        upload: "Upload first document", sign: "Sign a document", invite: "Invite teammate",
        api: "Create API key", brand: "Add your logo"
      },
      health: "Account health"
    },
    docs: {
      title: "My documents",
      filters: { all: "All", signed: "Signed", pending: "Pending", drafts: "Drafts" },
      newDoc: "New document", search: "Search documents...",
      empty: "No documents yet"
    },
    templates: {
      title: "Templates", subtitle: "Get started fast with ready-made templates. All bilingual.",
      browse: "Browse all", useTemplate: "Use", preview: "Preview",
      categories: { all: "All", legal: "Legal", business: "Business", real: "Real estate", hr: "HR", sales: "Sales", creative: "Creative" }
    },
    team: {
      title: "Team management",
      subtitle: "Invite teammates and set permissions",
      invite: "Invite teammate", inviteCta: "Send invite",
      seats: "seats", member: "Member",
      roles: { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" }
    },
    referrals: {
      title: "Referral program",
      subtitle: "Refer a friend and get a free month. They get 50% off.",
      yourLink: "Your referral link",
      stats: { invited: "Invited", joined: "Joined", earned: "Earned" },
      howItWorks: "How it works",
      steps: [
        "Share your unique referral link",
        "They sign up and complete one signature",
        "You both get a free month"
      ],
      copyLink: "Copy referral link", shareEmail: "Share via email"
    },
    api: {
      title: "API keys + Webhooks",
      subtitle: "Integrate Sigined into your stack with REST API and webhooks",
      keysTitle: "Active keys", newKey: "Create key",
      keyName: "Key name", lastUsed: "Last used", reveal: "Reveal",
      webhooksTitle: "Webhooks", newWebhook: "Add webhook",
      events: "Events", endpoint: "Endpoint",
      docs: "View API docs"
    },
    billing: {
      title: "Plan & billing",
      currentPlan: "Current plan", upgrade: "Upgrade", manage: "Manage",
      nextCharge: "Next charge", paymentMethod: "Payment method",
      invoices: "Invoices", download: "Download",
      usage: "Usage", usageDocs: "Documents this month",
      usageStorage: "Storage used"
    },
    settings: {
      title: "Settings",
      profile: "Profile", company: "Company", signature: "Signature",
      name: "Name", email: "Email", phone: "Phone", language: "Language",
      companyName: "Company name", companyId: "Company ID / Tax ID", professionalRole: "Job title",
      country: "Country", barNumber: "Bar number",
      teamName: "Team name", teamLogo: "Team logo",
      notifications: "Notifications", security: "Security",
      twoFa: "Two-factor auth", changePass: "Change password",
      signatureType: "Signature type", signatureTyped: "Type",
      signatureDrawn: "Draw", signatureUpload: "Upload",
      saveSignature: "Save signature", removeSignature: "Remove signature",
      noSignature: "No saved signature yet",
      notifyDocSigned: "Document signed", notifyReminders: "Signature reminders",
      notifyFeatures: "New features"
    },
    admin: {
      welcome: "Welcome back, admin",
      overview: { title: "Overview" },
      mrr: "MRR", arr: "ARR", activeCustomers: "Active customers",
      churnRate: "Churn rate", ltv: "Avg. LTV", cac: "CAC",
      revByPlan: "Revenue by plan", recentActivity: "Recent activity",
      thisMonth: "This month", vsLast: "vs last month",
      topCountries: "Top countries",
      customers: {
        title: "Customer management", search: "Search customers...",
        addCustomer: "Add customer", suspend: "Suspend", activate: "Activate"
      },
      atRisk: {
        title: "Customers at risk of churn",
        subtitle: "Auto-detected from declining activity, missed logins, low engagement",
        score: "Health score", lastActive: "Last active", trend: "Trend",
        action: "Recommended action", sendReengagement: "Send re-engagement",
        offerDiscount: "Offer discount", scheduleCall: "Schedule call",
        riskHigh: "High risk", riskMed: "Medium risk", riskLow: "Low risk"
      },
      automation: {
        title: "Email automation",
        subtitle: "Autopilot — flows that run without you lifting a finger",
        newFlow: "New flow",
        active: "Active", paused: "Paused",
        stats: { sent: "Sent", opens: "Opens", clicks: "Clicks", conversions: "Conversions" },
        flowSteps: "Steps", trigger: "Trigger",
        flows: {
          welcome: { name: "Welcome series", desc: "New signup → 4 emails over 7 days", trigger: "Signup" },
          trial: { name: "Trial ending", desc: "Reminders 3 and 1 day before trial ends + offer", trigger: "Trial active" },
          churn: { name: "Churn prevention", desc: "Inactive 14 days → re-engagement campaign", trigger: "Inactivity" },
          winback: { name: "Win back canceled", desc: "Subscription canceled → 3 emails over 30 days", trigger: "Cancellation" },
          referral: { name: "Referral nudge", desc: "Active for 30+ days → referral program reminder", trigger: "Lifetime ≥ 30" },
          feature: { name: "Feature announcement", desc: "New feature shipped → broadcast to active users", trigger: "Manual" }
        }
      },
      campaigns: {
        title: "Campaigns",
        subtitle: "Manual sends to custom segments",
        new: "New campaign", recipient: "Recipients", sentAt: "Sent", openRate: "Open rate"
      },
      cohorts: { title: "Cohort retention", subtitle: "% of users still active by signup month" },
      support: {
        title: "Support inbox", new: "Open", closed: "Closed",
        reply: "Reply", priority: { high: "High", med: "Normal", low: "Low" }
      }
    },
    pricing: {
      title: "Simple pricing. Global value.",
      subtitle: "Start free. Upgrade when you're ready.",
      monthly: "/ month",
      tiers: {
        free: { name: "Free", price: "0", desc: "Get started solo" },
        basic: { name: "Basic", price: "8", currency: "$", priceUsd: "≈ ₪30", desc: "For individuals" },
        pro: { name: "Professional", price: "100", currency: "$", priceIls: "≈ ₪370", desc: "For businesses & creators", popular: "Popular" },
        enterprise: { name: "Enterprise", price: "Contact us", desc: "For organizations & law firms" }
      },
      cta: { free: "Start free", paid: "Start trial", contact: "Talk to us" },
      features: {
        free: ["3 documents/month", "Basic e-signature", "SHA-256 fingerprint"],
        basic: ["50 documents/month", "Multi-signer", "Templates", "5GB storage"],
        pro: ["Unlimited documents", "Sign videos & images", "Advanced field placement", "Printable ownership certificates", "REST API + Webhooks", "Custom branding", "100GB storage", "Priority support"],
        enterprise: ["Everything in Pro", "SSO + SAML", "99.99% SLA", "Dedicated CSM", "On-prem deployment"]
      }
    },
    toasts: {
      copied: "Copied to clipboard", flowEnabled: "Flow activated", flowDisabled: "Flow paused",
      campaignSent: "Campaign sent", inviteSent: "Invite sent",
      docCreated: "Document created", planUpdated: "Plan updated",
      keyCreated: "API key created", customerSuspended: "Customer suspended",
      customerActivated: "Customer activated", reengagementSent: "Re-engagement campaign sent"
    }
  }
};

export default STR;
