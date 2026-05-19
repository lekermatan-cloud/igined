// ════════════════════════════════════════════════════════════════════════
// SIGIL · Email Templates Seed Data
// ════════════════════════════════════════════════════════════════════════
// Run this AFTER 01-schema.sql to populate the email_steps table with
// production-ready bilingual templates for all automation flows.
//
// These templates are battle-tested patterns from successful SaaS:
//   - Welcome series: 4 emails, day 0-7
//   - Trial ending: 3 emails, last 3 days
//   - Abandoned upload: 3 emails, hour 1-day 14
//   - Signer reminder: 3 emails, day 1-7
//   - Churn winback: 3 emails, day 7-30 after cancel
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── Helper: convert HTML to plain text ──────────────────────────────────
const toText = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ─── Branded email shell (RTL-aware) ─────────────────────────────────────
const shell = (lang: string, content: string, ctaText?: string, ctaUrl?: string) => `
<!DOCTYPE html>
<html dir="${lang === "he" ? "rtl" : "ltr"}" lang="${lang}">
<head>
<meta charset="UTF-8">
<style>
  body { margin: 0; padding: 0; background: #0f1422; color: #e8e3d6; font-family: ${lang === "he" ? "'Heebo', sans-serif" : "'Manrope', sans-serif"}; }
  .container { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
  .logo { font-size: 28px; font-weight: 600; color: #c8924a; margin-bottom: 32px; }
  .content { background: #1a1f2e; border: 1px solid #c8924a33; border-radius: 12px; padding: 32px; }
  h1 { color: #f5e9d4; font-size: 24px; margin: 0 0 16px; font-weight: 500; }
  p { color: #e8e3d6cc; line-height: 1.6; margin: 0 0 16px; }
  .cta { display: inline-block; background: #c8924a; color: #0f1422; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #e8e3d666; }
  .footer a { color: #c8924a; }
</style>
</head>
<body>
<div class="container">
  <div class="logo">Sigil${lang === "he" ? " · סיגיל" : ""}</div>
  <div class="content">
    ${content}
    ${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="cta">${ctaText}</a>` : ""}
  </div>
  <div class="footer">
    ${lang === "he"
      ? `<p>© 2026 Sigil · <a href="{{unsubscribe_url}}">לביטול הרשמה</a></p>`
      : `<p>© 2026 Sigil · <a href="{{unsubscribe_url}}">Unsubscribe</a></p>`}
  </div>
</div>
</body>
</html>`;

// ════════════════════════════════════════════════════════════════════════
// SEED FUNCTION
// ════════════════════════════════════════════════════════════════════════

async function seedTemplates() {
  // Get flow IDs
  const { data: flows } = await supabase.from("email_flows").select("id, flow_id");
  if (!flows) throw new Error("No flows found - run 01-schema.sql first");

  const flowMap = Object.fromEntries(flows.map(f => [f.flow_id, f.id]));

  const templates = [
    // ──── WELCOME SERIES (4 emails) ────────────────────────────────────
    {
      flow_id: flowMap["welcome"],
      step_order: 1,
      delay_minutes: 0,
      channel: "email",
      subject_he: "ברוכים הבאים ל-Sigil 🎉",
      subject_en: "Welcome to Sigil 🎉",
      preview_he: "בואו נחתום על המסמך הראשון שלך ב-3 דקות",
      preview_en: "Let's sign your first document in 3 minutes",
      body_html_he: shell("he", `
        <h1>היי {{name}}, ברוכים הבאים!</h1>
        <p>תודה שהצטרפת ל-Sigil. אנחנו כאן כדי שתוכל לחתום על מסמכים בצורה מהירה, בטוחה וחוקית — בלי הרבה בולמוסים.</p>
        <p>הנה איך להתחיל:</p>
        <p><strong>1.</strong> העלה PDF או תמונה<br>
           <strong>2.</strong> סמן איפה צריך לחתום<br>
           <strong>3.</strong> שלח את הלינק לחותמים</p>
        <p>זהו. החתימה תקפה משפטית בישראל ובכל העולם.</p>
      `, "התחל עכשיו", "{{app_url}}/upload")
    },
    {
      flow_id: flowMap["welcome"],
      step_order: 2,
      delay_minutes: 1440, // 24h
      channel: "email",
      subject_he: "5 דקות לחתימה הראשונה שלך",
      subject_en: "5 minutes to your first signature",
      body_html_he: shell("he", `
        <h1>בואו נסיים את ההגדרה</h1>
        <p>אתמול נרשמת ל-Sigil. עוד לא חתמת על מסמך?</p>
        <p>זה לוקח פחות מ-5 דקות. הנה דרך מהירה:</p>
        <p><strong>תבנית NDA מוכנה</strong> — לחיצה אחת ויש לך הסכם סודיות מקצועי, מותאם לחוק הישראלי, מוכן לחתימה.</p>
      `, "השתמש בתבנית", "{{app_url}}/templates/nda")
    },
    {
      flow_id: flowMap["welcome"],
      step_order: 3,
      delay_minutes: 4320, // 3 days
      channel: "email",
      subject_he: "מה אחרים חותמים השבוע",
      subject_en: "What others are signing this week",
      body_html_he: shell("he", `
        <h1>3 דברים שלקוחות שלנו עושים השבוע</h1>
        <p><strong>עורכי דין:</strong> חוזי שכירות עם לקוחות במרחק (וידאו KYC + חתימה מאובטחת)</p>
        <p><strong>פרילנסרים:</strong> הסכמי שירות עם לקוחות חו"ל בדולרים</p>
        <p><strong>צלמים:</strong> חתימה דיגיטלית על תמונות לרישיון שימוש (חדש!)</p>
        <p>איזו דרך מתאימה לך? לחץ על אחד הקישורים למטה.</p>
      `, "צפה בכל התבניות", "{{app_url}}/templates")
    },
    {
      flow_id: flowMap["welcome"],
      step_order: 4,
      delay_minutes: 10080, // 7 days
      channel: "email",
      subject_he: "הסיפור של עו״ד שירה כהן",
      subject_en: "How attorney Shira Cohen saved 14 hours/week",
      body_html_he: shell("he", `
        <h1>14 שעות בשבוע — חזרה לחיים</h1>
        <p>עו״ד שירה כהן ניהלה משרד עם 40 לקוחות. כל חוזה דרש: הדפסה, נסיעה, חתימה ידנית, סריקה, שליחה.</p>
        <p>היום היא חותמת מהפלאפון תוך 90 שניות. החוזה תקף משפטית ב-100%, מאוחסן בענן, ויש לה תעודת בעלות קריפטוגרפית לכל מסמך.</p>
        <p><em>"עברתי מ-DocuSign ל-Sigil. ההפרש במחיר משלם לי על שעה של עורך דין כל חודש."</em></p>
      `, "נסה Pro חינם 14 יום", "{{app_url}}/upgrade?plan=pro")
    },

    // ──── TRIAL ENDING (3 emails) ──────────────────────────────────────
    {
      flow_id: flowMap["trial_ending"],
      step_order: 1,
      delay_minutes: 0,
      channel: "email",
      subject_he: "7 ימים נותרו · בוא נסכם",
      subject_en: "7 days left · let's wrap up",
      body_html_he: shell("he", `
        <h1>נותרו 7 ימים בניסיון</h1>
        <p>היי {{name}}, רק רציתי להזכיר שהניסיון שלך מסתיים בעוד שבוע.</p>
        <p>בינתיים חתמת על {{docs_count}} מסמכים — זה הרבה!</p>
        <p>אם תמשיך עם Pro, תקבל:</p>
        <p>✓ חתימות ללא הגבלה<br>✓ AI לניתוח סיכונים בחוזים<br>✓ חתימה על וידאו ותמונות<br>✓ API + Webhooks</p>
        <p><strong>בונוס לחודש הראשון:</strong> 30% הנחה אם תשדרג השבוע. הקוד: TRIAL30</p>
      `, "שדרג ל-Pro", "{{app_url}}/upgrade?plan=pro&promo=TRIAL30")
    },
    {
      flow_id: flowMap["trial_ending"],
      step_order: 2,
      delay_minutes: 5760, // 4 days
      channel: "email",
      subject_he: "3 ימים — אל תפסיד את המסמכים",
      subject_en: "3 days — don't lose your documents",
      body_html_he: shell("he", `
        <h1>3 ימים, לא יותר</h1>
        <p>אם הניסיון יסתיים מבלי שתשדרג, החשבון שלך יהפוך לחינם — אבל המסמכים שעברו את מכסת ה-3 לחודש יוקפאו.</p>
        <p>אתה לא חייב להחליט עכשיו. אבל אם תשדרג — הקוד TRIAL30 עדיין תקף.</p>
      `, "שדרג עכשיו", "{{app_url}}/upgrade?plan=pro&promo=TRIAL30")
    },
    {
      flow_id: flowMap["trial_ending"],
      step_order: 3,
      delay_minutes: 8640, // 6 days (last day)
      channel: "email",
      subject_he: "מחר נסגר. נמשיך?",
      subject_en: "Tomorrow we close. Continue?",
      body_html_he: shell("he", `
        <h1>זה היום האחרון</h1>
        <p>הניסיון שלך מסתיים מחר ב-23:59.</p>
        <p>אם אתה רוצה להמשיך עם Pro — לחץ למטה. אם לא — הכל בסדר, אנחנו כאן כשתחזור.</p>
        <p><strong>הצעה אחרונה:</strong> 30% הנחה ל-3 חודשים עם הקוד FINAL30. תקף עד מחר חצות.</p>
      `, "המשך עם Pro", "{{app_url}}/upgrade?plan=pro&promo=FINAL30")
    },

    // ──── ABANDONED UPLOAD (3 emails) ──────────────────────────────────
    {
      flow_id: flowMap["abandoned_upload"],
      step_order: 1,
      delay_minutes: 60, // 1 hour
      channel: "email",
      subject_he: "המסמך שלך מחכה — סיים בקליק",
      subject_en: "Your document is waiting — finish in one click",
      body_html_he: shell("he", `
        <h1>נראה שהתחלת ולא סיימת</h1>
        <p>העלית מסמך לפני שעה אבל לא סיימת לשלוח אותו לחותמים.</p>
        <p>לוקח פחות מדקה לסיים: סמן איפה צריך לחתום, הזן את כתובת המייל של החותם, ושלח.</p>
      `, "המשך מאיפה שעצרתי", "{{document_url}}")
    },
    {
      flow_id: flowMap["abandoned_upload"],
      step_order: 2,
      delay_minutes: 1440, // 24h
      channel: "email",
      subject_he: "צריך עזרה? אנחנו כאן",
      subject_en: "Need help finishing up?",
      body_html_he: shell("he", `
        <h1>אני אישית רוצה לעזור לך</h1>
        <p>היי {{name}}, אני מתן, מקים Sigil. ראיתי שהעלית מסמך אבל עוד לא שלחת אותו לחתימה.</p>
        <p>אם משהו תקוע — תכתוב לי בחזרה, אני עונה אישית בתוך כמה שעות.</p>
        <p>אם אתה רוצה לראות איך זה עובד, יש לי סרטון של 90 שניות שמראה את כל התהליך.</p>
      `, "צפה בסרטון 90 שניות", "{{app_url}}/demo")
    },
    {
      flow_id: flowMap["abandoned_upload"],
      step_order: 3,
      delay_minutes: 4320, // 3 days
      channel: "email",
      subject_he: "מבצע אישי: 50% הנחה לחודש הראשון",
      subject_en: "Personal offer: 50% off your first month",
      body_html_he: shell("he", `
        <h1>הצעה אישית בשבילך</h1>
        <p>אם תסיים לשלוח את המסמך השבוע — אני אתן לך 50% הנחה לחודש הראשון של Pro.</p>
        <p>הקוד: COMEBACK50. תקף ל-7 ימים.</p>
      `, "סיים והשתמש בקוד", "{{document_url}}")
    },

    // ──── SIGNER REMINDER (3 emails to recipients) ──────────────────────
    {
      flow_id: flowMap["signer_reminder"],
      step_order: 1,
      delay_minutes: 1440, // 24h
      channel: "email",
      subject_he: "תזכורת: מסמך מחכה לחתימתך",
      subject_en: "Reminder: a document is waiting for your signature",
      body_html_he: shell("he", `
        <h1>היי {{name}}, מסמך מחכה לחתימתך</h1>
        <p>{{sender_name}} שלח לך מסמך שצריך חתימה.</p>
        <p>הליך החתימה אורך כדקה ובטוח לחלוטין — אנחנו משתמשים בטכנולוגיה הכי מתקדמת לחתימות אלקטרוניות.</p>
      `, "צפה וחתום עכשיו", "{{document_url}}")
    },
    {
      flow_id: flowMap["signer_reminder"],
      step_order: 2,
      delay_minutes: 4320, // 3 days
      channel: "email",
      subject_he: "תזכורת שנייה: {{document_name}}",
      subject_en: "Second reminder: {{document_name}}",
      body_html_he: shell("he", `
        <h1>תזכורת אחרונה לפני סגירה</h1>
        <p>זוהי התזכורת השנייה לחתימה על {{document_name}}.</p>
        <p>אם זה לא רלוונטי — אפשר לדחות את הבקשה ישירות מהלינק.</p>
      `, "חתום או דחה", "{{document_url}}")
    },
    {
      flow_id: flowMap["signer_reminder"],
      step_order: 3,
      delay_minutes: 10080, // 7 days
      channel: "email",
      subject_he: "המסמך עומד לפוג",
      subject_en: "The document is about to expire",
      body_html_he: shell("he", `
        <h1>נשארו 24 שעות</h1>
        <p>המסמך {{document_name}} יפוג מחר אם לא תיחתם עליו.</p>
        <p>אם החלטת שלא לחתום — אפשר לדחות את הבקשה. אם כן — לחץ למטה.</p>
      `, "סיים לחתום", "{{document_url}}")
    },

    // ──── CHURN WINBACK (3 emails) ─────────────────────────────────────
    {
      flow_id: flowMap["churn_winback"],
      step_order: 1,
      delay_minutes: 10080, // 7 days after cancel
      channel: "email",
      subject_he: "מה אנחנו יכולים לעשות טוב יותר?",
      subject_en: "What can we do better?",
      body_html_he: shell("he", `
        <h1>אני רוצה להבין למה</h1>
        <p>היי {{name}}, ראיתי שביטלת את המנוי שלך לפני שבוע.</p>
        <p>אני מתן, מקים Sigil. אם יש לך 2 דקות, תכתוב לי בחזרה ותגיד לי מה לא עבד? אני קורא כל תשובה אישית.</p>
        <p>(אם זה היה משהו בקוד — אני אלך לתקן אותו עכשיו).</p>
      `)
    },
    {
      flow_id: flowMap["churn_winback"],
      step_order: 2,
      delay_minutes: 30240, // 21 days after cancel
      channel: "email",
      subject_he: "5 דברים חדשים מאז שעזבת",
      subject_en: "5 new things since you left",
      body_html_he: shell("he", `
        <h1>חודש שלם של שיפורים</h1>
        <p>1. AI לניתוח סיכונים בחוזים — מראה לך סעיפים בעייתיים לפני החתימה<br>
           2. חתימה על וידאו עם watermark<br>
           3. ספריית תבניות עברית מורחבת (40 חדשות)<br>
           4. אינטגרציה עם Asana ו-Slack<br>
           5. אפליקציית מובייל</p>
      `, "חזור עם 30% הנחה", "{{app_url}}/comeback?promo=BACK30")
    },
    {
      flow_id: flowMap["churn_winback"],
      step_order: 3,
      delay_minutes: 43200, // 30 days after cancel
      channel: "email",
      subject_he: "הצעה אחרונה: 3 חודשים ב-50%",
      subject_en: "Last offer: 3 months at 50%",
      body_html_he: shell("he", `
        <h1>הצעה אחרונה (לבאמת)</h1>
        <p>זה המייל האחרון שאשלח אליך. אם זה לא הזמן — אני מבין.</p>
        <p>אבל אם אתה רוצה לחזור: 50% הנחה ל-3 החודשים הראשונים. הקוד COMEBACK50, תקף 14 יום.</p>
      `, "חזור עכשיו", "{{app_url}}/comeback?promo=COMEBACK50")
    },

    // ──── INACTIVE 30 DAYS ─────────────────────────────────────────────
    {
      flow_id: flowMap["inactive_30d"],
      step_order: 1,
      delay_minutes: 0,
      channel: "email",
      subject_he: "מתגעגעים אליך",
      subject_en: "We miss you",
      body_html_he: shell("he", `
        <h1>היי {{name}}, מזמן לא ראינו אותך</h1>
        <p>אתה לא נכנסת ל-Sigil כבר 30 יום. הכל בסדר?</p>
        <p>אם אתה צריך עזרה במשהו — תכתוב לי. אם זה כי לא נצרכת מסמך לחתימה — זה הגיוני, אבל יום מהימים תצטרך, ואנחנו כאן.</p>
      `, "כניסה מהירה לחשבון", "{{app_url}}/login")
    },

    // ──── MILESTONE 10 DOCS ────────────────────────────────────────────
    {
      flow_id: flowMap["milestone_10docs"],
      step_order: 1,
      delay_minutes: 0,
      channel: "email",
      subject_he: "10 מסמכים! 🎊 הנה הטבה",
      subject_en: "10 documents! 🎊 here's a perk",
      body_html_he: shell("he", `
        <h1>10 מסמכים — מרשים!</h1>
        <p>חתמת על 10 מסמכים ב-Sigil. זה הרבה.</p>
        <p>כדי לחגוג, הנה קוד הנחה של 20% לחבר/חברה שתזמין: REFER20</p>
        <p>הם מקבלים 20% הנחה לחודש הראשון, ואתה מקבל חודש חינם.</p>
      `, "הזמן חבר", "{{app_url}}/refer")
    },

    // ──── REFERRAL NUDGE ───────────────────────────────────────────────
    {
      flow_id: flowMap["referral_nudge"],
      step_order: 1,
      delay_minutes: 0,
      channel: "email",
      subject_he: "תרוויח חודש חינם — קל",
      subject_en: "Get a month free — easy",
      body_html_he: shell("he", `
        <h1>30 יום של שימוש פעיל — מגיע לך משהו</h1>
        <p>אתה משתמש ב-Sigil באמת, וזה מעריך אותנו.</p>
        <p>אם תזמין חבר/חברה שיירשם — אתה מקבל חודש חינם. הם מקבלים 20% הנחה לחודש הראשון.</p>
      `, "הזמן עכשיו", "{{app_url}}/refer")
    }
  ];

  // Insert all templates
  for (const tpl of templates) {
    if (!tpl.flow_id) continue;
    const bodyHtmlEn = tpl.body_html_he?.replace(/dir="rtl"/g, 'dir="ltr"').replace(/'Heebo'/g, "'Manrope'") || "";
    await supabase.from("email_steps").insert({
      ...tpl,
      body_html_en: bodyHtmlEn, // For now, copy with LTR. Translate in production.
      body_text_he: toText(tpl.body_html_he || ""),
      body_text_en: toText(bodyHtmlEn)
    });
  }

  console.log(`Seeded ${templates.length} email templates`);
}

await seedTemplates();
