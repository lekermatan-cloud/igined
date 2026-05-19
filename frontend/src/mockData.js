// ════════════════════════════════════════════════════════════════════════
// Mock data  ·  In production replace with real API calls to Supabase.
// ════════════════════════════════════════════════════════════════════════
// Each export is a plain JS array. The shape mirrors what the backend will
// eventually return — keep these shapes stable across files.
// ════════════════════════════════════════════════════════════════════════

export const MOCK_CUSTOMERS = [
  { id: 1, name: "Sarah Chen", email: "sarah@northstar.io", plan: "pro", mrr: 100, currency: "USD", status: "active", joined: "2025-09-12", country: "US", docs: 47, lastActive: 1, health: 92 },
  { id: 2, name: "מתן לקר", email: "matan@1945thestory.com", plan: "comp", mrr: 0, currency: "USD", status: "active", joined: "2025-08-03", country: "IL", docs: 89, lastActive: 0, health: 100 },
  { id: 3, name: "James Whitfield", email: "j.whitfield@whitfieldlaw.co.uk", plan: "enterprise", mrr: 450, currency: "USD", status: "active", joined: "2025-06-21", country: "UK", docs: 312, lastActive: 0, health: 98 },
  { id: 4, name: "דנה פרץ", email: "dana.peretz@startup.co.il", plan: "basic", mrr: 30, currency: "ILS", status: "active", joined: "2026-01-14", country: "IL", docs: 8, lastActive: 22, health: 41 },
  { id: 5, name: "Marco Rossi", email: "marco@studiolegale.it", plan: "pro", mrr: 100, currency: "USD", status: "active", joined: "2025-11-05", country: "IT", docs: 64, lastActive: 18, health: 38 },
  { id: 6, name: "Aisha Patel", email: "aisha@patel-creative.com", plan: "pro", mrr: 100, currency: "USD", status: "trial", joined: "2026-04-28", country: "US", docs: 3, lastActive: 2, health: 67 },
  { id: 7, name: "אבי גולן", email: "avi@golanrealty.co.il", plan: "basic", mrr: 30, currency: "ILS", status: "active", joined: "2025-12-09", country: "IL", docs: 22, lastActive: 1, health: 84 },
  { id: 8, name: "Elena Volkov", email: "elena@volkov-photo.com", plan: "pro", mrr: 100, currency: "USD", status: "active", joined: "2025-10-17", country: "DE", docs: 156, lastActive: 0, health: 95 },
  { id: 9, name: "David Park", email: "david@parkmedia.kr", plan: "basic", mrr: 8, currency: "USD", status: "suspended", joined: "2025-07-30", country: "KR", docs: 4, lastActive: 47, health: 12 },
  { id: 10, name: "שירה כהן", email: "shira@shiracpa.co.il", plan: "pro", mrr: 100, currency: "USD", status: "active", joined: "2026-02-22", country: "IL", docs: 41, lastActive: 1, health: 88 },
  { id: 11, name: "Liam O'Brien", email: "liam@obrien-films.ie", plan: "pro", mrr: 100, currency: "USD", status: "active", joined: "2026-03-11", country: "IE", docs: 28, lastActive: 35, health: 22 },
  { id: 12, name: "Yuki Tanaka", email: "yuki@tanaka-studio.jp", plan: "basic", mrr: 8, currency: "USD", status: "trial", joined: "2026-05-01", country: "JP", docs: 1, lastActive: 5, health: 51 },
  { id: 13, name: "רות לוי", email: "ruth.levi@levillaw.co.il", plan: "enterprise", mrr: 450, currency: "USD", status: "active", joined: "2025-05-19", country: "IL", docs: 521, lastActive: 0, health: 99 },
  { id: 14, name: "Carlos Mendez", email: "carlos@mendez-arch.mx", plan: "pro", mrr: 100, currency: "USD", status: "active", joined: "2025-12-02", country: "MX", docs: 73, lastActive: 4, health: 71 },
  { id: 15, name: "Anna Schmidt", email: "anna@schmidt-design.de", plan: "basic", mrr: 8, currency: "USD", status: "active", joined: "2026-04-08", country: "DE", docs: 12, lastActive: 28, health: 33 }
];

export const MOCK_TEAM = [
  { id: 1, name: "Matan Leker", email: "matan@1945thestory.com", role: "owner", lastActive: 0 },
  { id: 2, name: "Iris Chen", email: "iris@1945thestory.com", role: "admin", lastActive: 0 },
  { id: 3, name: "Daniel Roth", email: "daniel@1945thestory.com", role: "editor", lastActive: 2 },
  { id: 4, name: "Maya Silver", email: "maya@1945thestory.com", role: "viewer", lastActive: 5 }
];

export const MOCK_TEMPLATES = [
  { id: 1, name: { he: "הסכם NDA דו-כיווני", en: "Mutual NDA" }, cat: "legal", uses: 1247 },
  { id: 2, name: { he: "חוזה שכירות דירה", en: "Residential lease" }, cat: "real", uses: 892 },
  { id: 3, name: { he: "הסכם מתן שירותים", en: "Service agreement" }, cat: "business", uses: 1543 },
  { id: 4, name: { he: "טופס קבלת עובד", en: "Employee onboarding" }, cat: "hr", uses: 612 },
  { id: 5, name: { he: "הצעת מחיר", en: "Sales proposal" }, cat: "sales", uses: 2134 },
  { id: 6, name: { he: "רישיון שימוש בתמונה", en: "Photo license" }, cat: "creative", uses: 387 },
  { id: 7, name: { he: "חוזה קבלן עצמאי", en: "Independent contractor" }, cat: "business", uses: 956 },
  { id: 8, name: { he: "הסכם סודיות לעובדים", en: "Employee NDA" }, cat: "hr", uses: 723 },
  { id: 9, name: { he: "ייפוי כוח", en: "Power of attorney" }, cat: "legal", uses: 445 }
];

export const MOCK_FLOWS = [
  { id: "welcome", active: true, sent: 12847, opens: 0.62, clicks: 0.18, conversions: 0.09, steps: 4 },
  { id: "trial", active: true, sent: 3421, opens: 0.74, clicks: 0.31, conversions: 0.22, steps: 3 },
  { id: "churn", active: true, sent: 892, opens: 0.41, clicks: 0.12, conversions: 0.07, steps: 3 },
  { id: "winback", active: false, sent: 234, opens: 0.28, clicks: 0.08, conversions: 0.03, steps: 3 },
  { id: "referral", active: true, sent: 5612, opens: 0.55, clicks: 0.21, conversions: 0.14, steps: 2 },
  { id: "feature", active: true, sent: 8924, opens: 0.49, clicks: 0.15, conversions: 0.06, steps: 1 }
];

export const MOCK_CAMPAIGNS = [
  { id: 1, name: { he: "השקת חתימה על וידאו", en: "Video signing launch" }, recipients: 8924, sentAt: "2026-04-22", openRate: 0.51, status: "active" },
  { id: 2, name: { he: "הנחה לסוף הרבעון", en: "End-of-quarter promo" }, recipients: 4231, sentAt: "2026-03-28", openRate: 0.43, status: "active" },
  { id: 3, name: { he: "סקר משוב לקוחות", en: "Customer feedback survey" }, recipients: 2103, sentAt: "2026-03-15", openRate: 0.38, status: "active" },
  { id: 4, name: { he: "טיוטה: הצגת API", en: "Draft: API launch" }, recipients: 0, sentAt: null, openRate: 0, status: "draft" }
];

export const MOCK_TICKETS = [
  { id: 1, customer: "Sarah Chen", subject: { he: "שאלה על חתימה על וידאו", en: "Question about video signing" }, priority: "med", status: "new", at: "2h ago" },
  { id: 2, customer: "Marco Rossi", subject: { he: "החיוב לא עבר", en: "Payment failed" }, priority: "high", status: "new", at: "4h ago" },
  { id: 3, customer: "Aisha Patel", subject: { he: "איך מזמינים חבר צוות?", en: "How to invite teammate?" }, priority: "low", status: "new", at: "1d ago" },
  { id: 4, customer: "Elena Volkov", subject: { he: "צריך לייצא 100 חוזים", en: "Need to export 100 contracts" }, priority: "med", status: "closed", at: "3d ago" }
];

export const MOCK_API_KEYS = [
  { id: 1, name: "Production", prefix: "sk_live_", suffix: "x9k2d", lastUsed: "2h ago", created: "2025-10-14" },
  { id: 2, name: "Staging", prefix: "sk_test_", suffix: "p3m7t", lastUsed: "5d ago", created: "2025-11-02" }
];

export const MOCK_WEBHOOKS = [
  { id: 1, url: "https://api.1945thestory.com/sigined/webhook", events: ["doc.signed", "doc.viewed"], active: true },
  { id: 2, url: "https://crm.example.com/hooks/sigined", events: ["doc.signed"], active: true }
];

export const REVENUE_TREND = [42, 48, 51, 58, 64, 72, 79, 85, 92, 98, 108, 124];
export const COHORT_DATA = [
  { month: "Nov", size: 142, retention: [100, 78, 64, 55, 51, 48] },
  { month: "Dec", size: 198, retention: [100, 82, 71, 62, 58] },
  { month: "Jan", size: 234, retention: [100, 85, 74, 66] },
  { month: "Feb", size: 287, retention: [100, 88, 76] },
  { month: "Mar", size: 341, retention: [100, 89] },
  { month: "Apr", size: 412, retention: [100] }
];

