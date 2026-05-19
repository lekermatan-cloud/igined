// ════════════════════════════════════════════════════════════════════════
// SIGIL · AI Contract Analysis (Hebrew + English)
// ════════════════════════════════════════════════════════════════════════
// Pre-signing risk analysis powered by Claude API.
// For each contract, surfaces:
//   1. Unfair clauses (one-sided liability, automatic renewal traps)
//   2. Missing standard protections (jurisdiction, dispute resolution)
//   3. Ambiguous language that could cause future disputes
//   4. Deviation from industry standards
//   5. Compliance with Israeli Standard Contracts Law
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// ────────────────────────────────────────────────────────────────────────
// MAIN ANALYSIS ENDPOINT
// ────────────────────────────────────────────────────────────────────────

interface RiskFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "liability" | "termination" | "payment" | "confidentiality" | "ip" | "jurisdiction" | "ambiguity" | "compliance" | "missing_clause";
  title: string;
  description: string;
  affected_text: string; // Quoted from contract
  suggested_fix: string;
  legal_reference?: string; // Israeli law citation if applicable
}

interface ContractAnalysis {
  document_id: string;
  language: "he" | "en" | "mixed";
  contract_type: string; // Detected: "employment" | "lease" | "service" | "nda" | etc.
  risk_score: number; // 0-100
  risk_level: "low" | "medium" | "high" | "critical";
  findings: RiskFinding[];
  summary: {
    he: string;
    en: string;
  };
  recommended_actions: string[];
  analysis_duration_ms: number;
}

export async function analyzeContract(
  documentId: string,
  documentText: string,
  options: {
    detectedLanguage?: "he" | "en";
    contractType?: string;
    requestorRole?: "client" | "vendor" | "employer" | "employee" | "tenant" | "landlord";
  } = {}
): Promise<ContractAnalysis> {
  const startTime = Date.now();

  // 1. Detect language if not specified
  const language = options.detectedLanguage || detectLanguage(documentText);

  // 2. Detect contract type if not specified
  const contractType = options.contractType || await detectContractType(documentText, language);

  // 3. Run Claude analysis
  const findings = await runClaudeAnalysis(
    documentText,
    contractType,
    language,
    options.requestorRole || "client"
  );

  // 4. Calculate overall risk score
  const riskScore = calculateRiskScore(findings);
  const riskLevel = riskScoreToLevel(riskScore);

  // 5. Generate summary in both languages
  const summary = await generateSummary(documentText, findings, contractType);

  // 6. Build recommended actions list
  const recommendedActions = buildRecommendedActions(findings, language);

  const analysis: ContractAnalysis = {
    document_id: documentId,
    language,
    contract_type: contractType,
    risk_score: riskScore,
    risk_level: riskLevel,
    findings,
    summary,
    recommended_actions: recommendedActions,
    analysis_duration_ms: Date.now() - startTime
  };

  // 7. Store in database
  await supabase.from("contract_analyses").insert({
    document_id: documentId,
    risk_score: riskScore,
    risk_level: riskLevel,
    findings_count: findings.length,
    findings_data: findings,
    summary_he: summary.he,
    summary_en: summary.en,
    contract_type: contractType,
    detected_language: language,
    analyzed_at: new Date().toISOString()
  });

  return analysis;
}

// ────────────────────────────────────────────────────────────────────────
// CLAUDE API CALL
// ────────────────────────────────────────────────────────────────────────

async function runClaudeAnalysis(
  contractText: string,
  contractType: string,
  language: string,
  requestorRole: string
): Promise<RiskFinding[]> {
  const systemPrompt = `You are a senior contract attorney reviewing contracts for clients. You speak fluent Hebrew and English. You specialize in Israeli law (חוק החוזים, חוק החוזים האחידים, חוק הגנת הצרכן) and international commercial law.

Your task: identify risks in the contract that could harm the user's interests.

Respond ONLY with valid JSON in this exact format:
{
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "category": "liability|termination|payment|confidentiality|ip|jurisdiction|ambiguity|compliance|missing_clause",
      "title": "Short title (max 80 chars)",
      "description": "Detailed explanation of the risk",
      "affected_text": "Exact quote from contract",
      "suggested_fix": "Specific suggested wording",
      "legal_reference": "Optional: Israeli law section or international standard"
    }
  ]
}

Focus on:
1. One-sided liability clauses (where client takes all risk)
2. Termination clauses that lock the user in
3. Automatic renewals without proper notice (illegal in many cases under חוק הגנת הצרכן)
4. IP transfers that exceed normal scope
5. Confidentiality clauses that are overly broad
6. Jurisdiction clauses that disadvantage the user
7. Ambiguous language likely to cause disputes
8. Missing standard protections
9. Violations of mandatory law (חוק החוזים האחידים for consumer contracts)

Be thorough but practical - don't flag every minor issue. Focus on issues that materially affect the user's position.`;

  const userPrompt = `Contract type: ${contractType}
User role: ${requestorRole}
Language: ${language}

CONTRACT TEXT:
${contractText.substring(0, 100000)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Strip markdown fences if present
  const cleaned = content.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return parsed.findings || [];
}

// ────────────────────────────────────────────────────────────────────────
// CONTRACT TYPE DETECTION
// ────────────────────────────────────────────────────────────────────────

async function detectContractType(text: string, language: string): Promise<string> {
  // Quick heuristic-based detection (faster than Claude call)
  const sample = text.substring(0, 5000).toLowerCase();

  const patterns: Record<string, RegExp[]> = {
    "employment": [/\bemployee\b/, /\bemployer\b/, /\bsalary\b/, /עובד/, /מעסיק/, /משכורת/, /שכר/],
    "lease": [/\blease\b/, /\brental\b/, /\btenant\b/, /\blandlord\b/, /שכירות/, /שוכר/, /משכיר/, /דמי שכירות/],
    "service": [/\bservices\b/, /\bvendor\b/, /\bcontractor\b/, /שירותים/, /ספק/, /קבלן/, /נותן שירות/],
    "nda": [/\bnon-disclosure\b/, /\bconfidentiality\b/, /\btrade secret\b/, /סודיות/, /אי-גילוי/, /מידע סודי/],
    "sale": [/\bpurchase\b/, /\bsale of\b/, /\bbuyer\b/, /\bseller\b/, /מכר/, /קונה/, /מוכר/, /הסכם מכר/],
    "license": [/\blicense\b/, /\blicensee\b/, /\blicensor\b/, /רישיון/, /רשיון/],
    "investment": [/\binvestment\b/, /\bshareholder\b/, /\bequity\b/, /השקעה/, /מניות/, /בעל מניות/],
    "partnership": [/\bpartnership\b/, /\bjoint venture\b/, /שותפות/, /מיזם משותף/]
  };

  let bestMatch = "general";
  let bestScore = 0;

  for (const [type, regexes] of Object.entries(patterns)) {
    const score = regexes.reduce((s, r) => s + (sample.match(r) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  return bestMatch;
}

// ────────────────────────────────────────────────────────────────────────
// LANGUAGE DETECTION
// ────────────────────────────────────────────────────────────────────────

function detectLanguage(text: string): "he" | "en" | "mixed" {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const total = hebrewChars + englishChars;

  if (total === 0) return "en";
  const hebrewRatio = hebrewChars / total;

  if (hebrewRatio > 0.7) return "he";
  if (hebrewRatio < 0.3) return "en";
  return "mixed";
}

// ────────────────────────────────────────────────────────────────────────
// RISK SCORE CALCULATION
// ────────────────────────────────────────────────────────────────────────

function calculateRiskScore(findings: RiskFinding[]): number {
  const weights = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
  const totalWeight = findings.reduce((sum, f) => sum + (weights[f.severity] || 0), 0);
  return Math.min(100, totalWeight);
}

function riskScoreToLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 60) return "critical";
  if (score >= 30) return "high";
  if (score >= 15) return "medium";
  return "low";
}

// ────────────────────────────────────────────────────────────────────────
// SUMMARY GENERATION
// ────────────────────────────────────────────────────────────────────────

async function generateSummary(
  contractText: string,
  findings: RiskFinding[],
  contractType: string
): Promise<{ he: string; en: string }> {
  const findingsSummary = findings.slice(0, 10).map(f => `[${f.severity}] ${f.title}`).join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      system: "You write concise contract summaries. Respond ONLY with JSON: {\"he\": \"Hebrew summary\", \"en\": \"English summary\"}. Each summary should be 3-4 sentences, plain language, no legalese.",
      messages: [{
        role: "user",
        content: `Contract type: ${contractType}\n\nKey findings:\n${findingsSummary}\n\nContract excerpt (first 3000 chars):\n${contractText.substring(0, 3000)}\n\nWrite the summaries.`
      }]
    })
  });

  const data = await response.json();
  const cleaned = data.content[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ────────────────────────────────────────────────────────────────────────
// RECOMMENDED ACTIONS
// ────────────────────────────────────────────────────────────────────────

function buildRecommendedActions(findings: RiskFinding[], language: string): string[] {
  const actions: string[] = [];
  const isHebrew = language === "he";

  const criticalCount = findings.filter(f => f.severity === "critical").length;
  const highCount = findings.filter(f => f.severity === "high").length;

  if (criticalCount > 0) {
    actions.push(isHebrew
      ? `⚠️ נמצאו ${criticalCount} סיכונים קריטיים — מומלץ לא לחתום עד תיקון`
      : `⚠️ ${criticalCount} critical risks found — do not sign until resolved`);
  }

  if (highCount > 0) {
    actions.push(isHebrew
      ? `נמצאו ${highCount} סיכונים גבוהים — דרוש משא ומתן`
      : `${highCount} high-priority issues — negotiation recommended`);
  }

  // Category-specific recommendations
  const categories = new Set(findings.map(f => f.category));

  if (categories.has("jurisdiction") && isHebrew) {
    actions.push("בקש להוסיף סעיף שמירה על זכותך לבית משפט בישראל");
  } else if (categories.has("jurisdiction")) {
    actions.push("Request a clause preserving your right to local jurisdiction");
  }

  if (categories.has("liability") && isHebrew) {
    actions.push("בקש הגבלת אחריות סבירה (cap על נזקים)");
  } else if (categories.has("liability")) {
    actions.push("Negotiate a reasonable liability cap");
  }

  if (categories.has("termination") && isHebrew) {
    actions.push("בקש זכות יציאה עם הודעה מוקדמת סבירה");
  } else if (categories.has("termination")) {
    actions.push("Request fair termination clause with reasonable notice");
  }

  if (categories.has("missing_clause") && isHebrew) {
    actions.push("יש סעיפים חסרים — דרוש להוסיף הגנות סטנדרטיות");
  } else if (categories.has("missing_clause")) {
    actions.push("Standard clauses are missing — request to add protections");
  }

  if (actions.length === 0) {
    actions.push(isHebrew
      ? "החוזה נראה סטנדרטי וסביר"
      : "The contract appears standard and reasonable");
  }

  return actions;
}

// ────────────────────────────────────────────────────────────────────────
// EXTRACTING TEXT FROM PDF FOR ANALYSIS
// ────────────────────────────────────────────────────────────────────────

export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  // Use a PDF text extraction service
  // Options: PDFShift, Adobe PDF Services, AWS Textract, custom Lambda
  const PDF_API = Deno.env.get("PDF_TEXT_API") || "https://api.pdf.co/v1/pdf/convert/to/text";
  const PDF_API_KEY = Deno.env.get("PDF_API_KEY")!;

  const response = await fetch(PDF_API, {
    method: "POST",
    headers: {
      "x-api-key": PDF_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: pdfUrl,
      inline: true
    })
  });

  if (!response.ok) {
    throw new Error(`PDF extraction failed: ${response.status}`);
  }

  const data = await response.json();
  return data.body || data.text || "";
}

// ────────────────────────────────────────────────────────────────────────
// HOOK INTO DOCUMENT UPLOAD FLOW
// ────────────────────────────────────────────────────────────────────────
// Call this when a document is uploaded, BEFORE it's sent for signing.
// Show analysis to user, let them decide whether to proceed.

export async function analyzeUploadedDocument(documentId: string): Promise<ContractAnalysis> {
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (!doc) throw new Error("Document not found");

  // Extract text based on file type
  let text = "";
  if (doc.mime_type === "application/pdf") {
    text = await extractTextFromPDF(doc.file_url);
  } else if (doc.mime_type.startsWith("text/")) {
    text = await fetch(doc.file_url).then(r => r.text());
  } else {
    throw new Error(`Cannot analyze ${doc.mime_type} - text extraction not supported`);
  }

  if (text.length < 200) {
    throw new Error("Document too short to analyze meaningfully");
  }

  return analyzeContract(documentId, text);
}
