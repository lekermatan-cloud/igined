/**
 * ════════════════════════════════════════════════════════════════════════
 * SIGIL · Drizzle ORM Schema
 * ════════════════════════════════════════════════════════════════════════
 *
 * This file is the single source of truth for the database schema.
 * It mirrors all four migration files (01 → 04) and is used exclusively
 * for TypeScript types and AI code-assist inference.
 *
 * ⚠️  This schema is NOT used to run migrations or execute queries.
 *     Database access still goes through the Supabase JS client.
 *     Drizzle is added here as a schema-definition tool only.
 *
 * Usage in routes / services:
 *
 *   import type { Profile, NewProfile } from "../db/schema";
 *
 *   // Supabase query — AI now knows the exact column names & types
 *   const { data } = await supabase
 *     .from("profiles")
 *     .select("id, email, full_name")
 *     .eq("id", userId)
 *     .returns<Pick<Profile, "id" | "email" | "full_name">>();
 *
 * ════════════════════════════════════════════════════════════════════════
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  date,
  jsonb,
  inet,
  index,
  unique,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ════════════════════════════════════════════════════════════════════════
// USERS & TEAMS
// ════════════════════════════════════════════════════════════════════════

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique().notNull(),
    password_hash: text("password_hash").notNull(),
    full_name: text("full_name").notNull(),
    phone: text("phone"),
    country_code: text("country_code").default("IL"),
    preferred_language: text("preferred_language")
      .default("he")
      .$type<"he" | "en">(),
    timezone: text("timezone").default("Asia/Jerusalem"),
    avatar_url: text("avatar_url"),
    professional_role: text("professional_role"),
    bar_number: text("bar_number"),
    company_name: text("company_name"),
    company_id: text("company_id"),

    // Marketing
    referral_code: text("referral_code").unique(),
    referred_by: uuid("referred_by"),
    utm_source: text("utm_source"),
    utm_medium: text("utm_medium"),
    utm_campaign: text("utm_campaign"),

    // Compliance
    terms_accepted_at: timestamp("terms_accepted_at", { withTimezone: true }),
    privacy_accepted_at: timestamp("privacy_accepted_at", { withTimezone: true }),
    ip_at_signup: inet("ip_at_signup"),

    // Status
    is_admin: boolean("is_admin").default(false),
    is_suspended: boolean("is_suspended").default(false),
    suspension_reason: text("suspension_reason"),

    // Email verification
    email_verified: boolean("email_verified").default(false),
    email_verified_at: timestamp("email_verified_at", { withTimezone: true }),

    // Activity
    last_active_at: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
    login_count: integer("login_count").default(0),

    // WhatsApp opt-in
    whatsapp_number: text("whatsapp_number"),
    whatsapp_opted_in: boolean("whatsapp_opted_in").default(false),
    whatsapp_opted_in_at: timestamp("whatsapp_opted_in_at", { withTimezone: true }),

    // Onboarding (migration 04)
    onboarding_completed: boolean("onboarding_completed").default(false),
    onboarding_upload: boolean("onboarding_upload").default(false),
    onboarding_sign: boolean("onboarding_sign").default(false),
    onboarding_invite: boolean("onboarding_invite").default(false),
    onboarding_api: boolean("onboarding_api").default(false),
    onboarding_brand: boolean("onboarding_brand").default(false),

    // Saved signature
    saved_signature_url: text("saved_signature_url"),

    // Notification preferences
    notify_doc_signed: boolean("notify_doc_signed").default(true),
    notify_signature_reminders: boolean("notify_signature_reminders").default(true),
    notify_new_features: boolean("notify_new_features").default(false),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    emailIdx: index("idx_profiles_email").on(t.email),
    referralIdx: index("idx_profiles_referral_code").on(t.referral_code),
    lastActiveIdx: index("idx_profiles_last_active").on(t.last_active_at),
  })
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner_id: uuid("owner_id").notNull().references(() => profiles.id),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    logo_url: text("logo_url"),

    // Branding
    brand_color: text("brand_color").default("#c8924a"),
    custom_domain: text("custom_domain"),
    email_from_name: text("email_from_name"),
    email_from_address: text("email_from_address"),

    // Plan
    plan: text("plan").default("free").$type<"free" | "basic" | "pro" | "enterprise">(),
    seats: integer("seats").default(1),

    // Stripe
    stripe_customer_id: text("stripe_customer_id"),
    stripe_subscription_id: text("stripe_subscription_id"),
    subscription_status: text("subscription_status").$type<
      "trialing" | "active" | "past_due" | "canceled"
    >(),
    trial_ends_at: timestamp("trial_ends_at", { withTimezone: true }),
    current_period_end: timestamp("current_period_end", { withTimezone: true }),

    // Tranzila (ILS billing)
    tranzila_terminal_id: text("tranzila_terminal_id"),
    tranzila_token: text("tranzila_token"),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    ownerIdx: index("idx_teams_owner").on(t.owner_id),
    stripeIdx: index("idx_teams_stripe").on(t.stripe_customer_id),
  })
);

export const team_members = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"owner" | "admin" | "editor" | "viewer">(),
    invited_by: uuid("invited_by").references(() => profiles.id),
    joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamUserUnique: unique().on(t.team_id, t.user_id),
  })
);

// ════════════════════════════════════════════════════════════════════════
// DOCUMENTS & SIGNATURES
// ════════════════════════════════════════════════════════════════════════

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    created_by: uuid("created_by").notNull().references(() => profiles.id),

    // File metadata
    name: text("name").notNull(),
    description: text("description"),
    file_url: text("file_url").notNull(),
    signed_file_url: text("signed_file_url"),
    file_size_bytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    file_type: text("file_type").notNull().$type<
      "pdf" | "image" | "video" | "audio" | "doc" | "digital_product"
    >(),
    mime_type: text("mime_type").notNull(),

    // Cryptographic identity
    sha256_hash: text("sha256_hash").notNull().unique(),
    frame_hashes: jsonb("frame_hashes"), // [{timestamp, hash}]

    // Workflow
    status: text("status")
      .notNull()
      .default("draft")
      .$type<"draft" | "sent" | "in_progress" | "completed" | "expired" | "declined" | "cancelled">(),
    signing_order: text("signing_order")
      .default("parallel")
      .$type<"parallel" | "sequential">(),

    // Compliance
    legal_jurisdiction: text("legal_jurisdiction")
      .default("IL")
      .$type<"IL" | "US" | "EU" | "UK">(),
    signature_type: text("signature_type")
      .default("simple")
      .$type<"simple" | "advanced" | "qualified">(),

    // Expiration
    expires_at: timestamp("expires_at", { withTimezone: true }),
    reminder_schedule: jsonb("reminder_schedule").default([1, 3, 7]),

    // Template
    template_id: uuid("template_id"),

    // Categorisation
    category: text("category"),
    tags: text("tags").array(),

    // Tracking
    view_count: integer("view_count").default(0),
    last_viewed_at: timestamp("last_viewed_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),

    // Extended (migration 02)
    signed_video_url: text("signed_video_url"),
    signed_image_url: text("signed_image_url"),
    pixel_hash: text("pixel_hash"),
    language: text("language").default("he").$type<"he" | "en">(),
    ai_analysis_id: uuid("ai_analysis_id"),

    // Soft delete
    deleted_at: timestamp("deleted_at", { withTimezone: true }),

    // Timestamps
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamIdx: index("idx_documents_team").on(t.team_id),
    statusIdx: index("idx_documents_status").on(t.status),
    hashIdx: index("idx_documents_hash").on(t.sha256_hash),
    createdByIdx: index("idx_documents_created_by").on(t.created_by),
    expiresIdx: index("idx_documents_expires").on(t.expires_at),
  })
);

export const signers = pgTable(
  "signers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    document_id: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),

    // Identity
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    id_number: text("id_number"),

    // Order
    signing_order: integer("signing_order").default(0),
    role_label: text("role_label").default("signer").$type<"signer" | "witness" | "approver" | "cc">(),
    color: text("color").default("#c8924a"),

    // Auth
    access_token: text("access_token").unique().notNull(),
    auth_method: text("auth_method")
      .default("email")
      .$type<"email" | "sms" | "id_check" | "video_kyc" | "qualified_certificate">(),
    auth_completed_at: timestamp("auth_completed_at", { withTimezone: true }),

    // Status
    status: text("status")
      .default("pending")
      .$type<"pending" | "viewed" | "signed" | "declined" | "expired">(),

    // Forensic data
    ip_address: inet("ip_address"),
    user_agent: text("user_agent"),
    geolocation: jsonb("geolocation"), // {lat, lng, city, country}
    device_fingerprint: text("device_fingerprint"),

    // Signature data
    signature_image_url: text("signature_image_url"),
    signature_typed_text: text("signature_typed_text"),
    signature_method: text("signature_method").$type<"drawn" | "typed" | "uploaded">(),

    // Cryptographic proof
    consent_text_shown: text("consent_text_shown"),
    consent_accepted_at: timestamp("consent_accepted_at", { withTimezone: true }),

    // Timestamps
    invited_at: timestamp("invited_at", { withTimezone: true }).defaultNow(),
    first_viewed_at: timestamp("first_viewed_at", { withTimezone: true }),
    signed_at: timestamp("signed_at", { withTimezone: true }),

    // Reminders
    reminder_count: integer("reminder_count").default(0),
    last_reminder_at: timestamp("last_reminder_at", { withTimezone: true }),

    // Expiration
    expires_at: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    documentIdx: index("idx_signers_document").on(t.document_id),
    emailIdx: index("idx_signers_email").on(t.email),
    statusIdx: index("idx_signers_status").on(t.status),
    tokenIdx: index("idx_signers_token").on(t.access_token),
  })
);

export const document_fields = pgTable(
  "document_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    document_id: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    signer_id: uuid("signer_id").references(() => signers.id, { onDelete: "cascade" }),

    // Type
    field_type: text("field_type").notNull().$type<
      | "signature"
      | "initials"
      | "date"
      | "text"
      | "checkbox"
      | "name"
      | "email"
      | "phone"
      | "id_number"
      | "video_signature"
    >(),

    // Position
    page_number: integer("page_number").default(1),
    x_percent: numeric("x_percent", { precision: 5, scale: 2 }).notNull(),
    y_percent: numeric("y_percent", { precision: 5, scale: 2 }).notNull(),
    width_px: integer("width_px").notNull(),
    height_px: integer("height_px").notNull(),

    // Behaviour
    is_required: boolean("is_required").default(true),
    default_value: text("default_value"),
    validation_regex: text("validation_regex"),

    // Filled value
    filled_value: text("filled_value"),
    filled_at: timestamp("filled_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    documentIdx: index("idx_fields_document").on(t.document_id),
    signerIdx: index("idx_fields_signer").on(t.signer_id),
  })
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    document_id: uuid("document_id").notNull().unique().references(() => documents.id, { onDelete: "cascade" }),

    // Cryptographic proof
    cert_hash: text("cert_hash").notNull().unique(),
    document_hash: text("document_hash").notNull(),
    signers_hash: text("signers_hash").notNull(),

    // Timestamping (RFC 3161)
    rfc3161_token: text("rfc3161_token"),
    rfc3161_authority: text("rfc3161_authority"),
    issued_at_utc: timestamp("issued_at_utc", { withTimezone: true }).notNull().defaultNow(),

    // Public verification
    public_url: text("public_url").unique().notNull(),
    qr_code_url: text("qr_code_url"),
    pdf_url: text("pdf_url"),

    // Compliance level
    compliance_level: text("compliance_level")
      .notNull()
      .default("simple")
      .$type<"simple" | "advanced" | "qualified">(),

    // Blockchain (phase 2)
    blockchain_tx_hash: text("blockchain_tx_hash"),
    blockchain_network: text("blockchain_network"),
    blockchain_confirmed_at: timestamp("blockchain_confirmed_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    hashIdx: index("idx_certs_hash").on(t.cert_hash),
    publicUrlIdx: index("idx_certs_public_url").on(t.public_url),
  })
);

// ════════════════════════════════════════════════════════════════════════
// AUDIT TRAIL  (immutable — never UPDATE or DELETE)
// ════════════════════════════════════════════════════════════════════════

export const audit_log = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    document_id: uuid("document_id").references(() => documents.id),
    signer_id: uuid("signer_id").references(() => signers.id),
    user_id: uuid("user_id").references(() => profiles.id),

    // Event
    event_type: text("event_type").notNull().$type<
      | "created"
      | "sent"
      | "viewed"
      | "signed"
      | "declined"
      | "reminded"
      | "expired"
      | "completed"
      | "downloaded"
      | "verified"
    >(),
    event_data: jsonb("event_data"),

    // Forensic
    ip_address: inet("ip_address"),
    user_agent: text("user_agent"),
    geolocation: jsonb("geolocation"),

    // Tamper-proof chain
    previous_log_hash: text("previous_log_hash"),
    current_log_hash: text("current_log_hash").notNull(),

    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdx: index("idx_audit_document").on(t.document_id),
    signerIdx: index("idx_audit_signer").on(t.signer_id),
    occurredIdx: index("idx_audit_occurred").on(t.occurred_at),
  })
);

// ════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════════════════

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    is_system: boolean("is_system").default(false),

    // Content
    name_he: text("name_he").notNull(),
    name_en: text("name_en").notNull(),
    description_he: text("description_he"),
    description_en: text("description_en"),
    category: text("category").notNull().$type<
      "legal" | "business" | "real_estate" | "hr" | "sales" | "creative"
    >(),
    professional_role: text("professional_role"),

    // Document data
    base_pdf_url: text("base_pdf_url"),
    base_html_he: text("base_html_he"),
    base_html_en: text("base_html_en"),
    default_fields: jsonb("default_fields"),

    // Stats
    use_count: integer("use_count").default(0),
    is_published: boolean("is_published").default(false),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    categoryIdx: index("idx_templates_category").on(t.category),
    teamIdx: index("idx_templates_team").on(t.team_id),
  })
);

// ════════════════════════════════════════════════════════════════════════
// BILLING & SUBSCRIPTIONS
// ════════════════════════════════════════════════════════════════════════

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id),

    // Invoice details
    invoice_number: text("invoice_number").unique().notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().$type<"USD" | "ILS" | "EUR">(),
    vat_amount: numeric("vat_amount", { precision: 10, scale: 2 }).default("0"),
    vat_rate: numeric("vat_rate", { precision: 5, scale: 2 }).default("17.00"),
    // total_amount is a generated column (amount + vat_amount) — read-only in queries

    // Status
    status: text("status").notNull().$type<"pending" | "paid" | "failed" | "refunded">(),

    // Provider
    provider: text("provider").notNull().$type<"stripe" | "tranzila" | "manual">(),
    provider_invoice_id: text("provider_invoice_id"),
    provider_payment_id: text("provider_payment_id"),

    // Tax compliance
    recipient_business_id: text("recipient_business_id"),
    recipient_business_name: text("recipient_business_name"),
    recipient_address: text("recipient_address"),

    // Documents
    pdf_url: text("pdf_url"),
    period_start: timestamp("period_start", { withTimezone: true }),
    period_end: timestamp("period_end", { withTimezone: true }),

    paid_at: timestamp("paid_at", { withTimezone: true }),
    due_at: timestamp("due_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamIdx: index("idx_invoices_team").on(t.team_id),
    statusIdx: index("idx_invoices_status").on(t.status),
  })
);

// ════════════════════════════════════════════════════════════════════════
// EMAIL / MESSAGE AUTOMATION
// ════════════════════════════════════════════════════════════════════════

export const email_flows = pgTable("email_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  flow_id: text("flow_id").unique().notNull(),
  name_he: text("name_he").notNull(),
  name_en: text("name_en").notNull(),
  description_he: text("description_he"),
  description_en: text("description_en"),

  trigger_event: text("trigger_event").notNull(),
  trigger_conditions: jsonb("trigger_conditions"),

  is_active: boolean("is_active").default(true),
  total_sent: integer("total_sent").default(0),
  total_opens: integer("total_opens").default(0),
  total_clicks: integer("total_clicks").default(0),
  total_conversions: integer("total_conversions").default(0),
  attributed_revenue: numeric("attributed_revenue", { precision: 12, scale: 2 }).default("0"),

  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const email_steps = pgTable(
  "email_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flow_id: uuid("flow_id").notNull().references(() => email_flows.id, { onDelete: "cascade" }),
    step_order: integer("step_order").notNull(),
    delay_minutes: integer("delay_minutes").notNull(),
    channel: text("channel").notNull().$type<"email" | "whatsapp" | "sms">(),

    // Content (bilingual)
    subject_he: text("subject_he"),
    subject_en: text("subject_en"),
    preview_he: text("preview_he"),
    preview_en: text("preview_en"),
    body_html_he: text("body_html_he"),
    body_html_en: text("body_html_en"),
    body_text_he: text("body_text_he"),
    body_text_en: text("body_text_en"),

    // Skip conditions
    skip_if_signed: boolean("skip_if_signed").default(false),
    skip_if_paid: boolean("skip_if_paid").default(false),
    skip_if_active_recently: boolean("skip_if_active_recently").default(false),

    variant: text("variant").default("A"),
  },
  (t) => ({
    flowStepVariantUnique: unique().on(t.flow_id, t.step_order, t.variant),
  })
);

export const message_queue = pgTable(
  "message_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Recipient
    recipient_email: text("recipient_email"),
    recipient_phone: text("recipient_phone"),
    recipient_user_id: uuid("recipient_user_id").references(() => profiles.id),
    recipient_signer_id: uuid("recipient_signer_id").references(() => signers.id),

    // Source
    flow_id: uuid("flow_id").references(() => email_flows.id),
    step_id: uuid("step_id").references(() => email_steps.id),
    campaign_id: uuid("campaign_id"),

    // Channel & content
    channel: text("channel").notNull().$type<"email" | "whatsapp" | "sms">(),
    subject: text("subject"),
    body_html: text("body_html"),
    body_text: text("body_text"),
    language: text("language").default("he"),

    // Scheduling
    scheduled_for: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    priority: integer("priority").default(5),

    // Status
    status: text("status")
      .notNull()
      .default("queued")
      .$type<"queued" | "sending" | "sent" | "failed" | "cancelled" | "skipped">(),
    attempts: integer("attempts").default(0),
    last_error: text("last_error"),

    // Provider
    provider_message_id: text("provider_message_id"),

    // Engagement
    sent_at: timestamp("sent_at", { withTimezone: true }),
    opened_at: timestamp("opened_at", { withTimezone: true }),
    clicked_at: timestamp("clicked_at", { withTimezone: true }),
    replied_at: timestamp("replied_at", { withTimezone: true }),
    bounced_at: timestamp("bounced_at", { withTimezone: true }),
    unsubscribed_at: timestamp("unsubscribed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    scheduledIdx: index("idx_queue_scheduled").on(t.scheduled_for, t.status),
    recipientIdx: index("idx_queue_recipient").on(t.recipient_user_id),
  })
);

// ════════════════════════════════════════════════════════════════════════
// ABANDONMENT TRACKING
// ════════════════════════════════════════════════════════════════════════

export const abandonment_events = pgTable(
  "abandonment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => profiles.id),
    signer_id: uuid("signer_id").references(() => signers.id),
    email: text("email"),
    abandonment_type: text("abandonment_type").notNull().$type<
      | "signup_started"
      | "document_uploaded"
      | "signature_pending"
      | "trial_no_action"
      | "payment_failed"
      | "inactive_30d"
      | "inactive_60d"
      | "churned"
    >(),
    document_id: uuid("document_id").references(() => documents.id),
    abandonment_data: jsonb("abandonment_data"),

    // Recovery
    recovery_status: text("recovery_status")
      .default("pending")
      .$type<"pending" | "in_recovery" | "recovered" | "lost" | "excluded">(),
    emails_sent: integer("emails_sent").default(0),
    whatsapps_sent: integer("whatsapps_sent").default(0),
    recovered_at: timestamp("recovered_at", { withTimezone: true }),
    recovery_revenue: numeric("recovery_revenue", { precision: 10, scale: 2 }),

    detected_at: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    next_action_at: timestamp("next_action_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("idx_abandonment_user").on(t.user_id),
    statusIdx: index("idx_abandonment_status").on(t.recovery_status),
    nextActionIdx: index("idx_abandonment_next_action").on(t.next_action_at),
  })
);

// ════════════════════════════════════════════════════════════════════════
// API KEYS & WEBHOOKS
// ════════════════════════════════════════════════════════════════════════

export const api_keys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    created_by: uuid("created_by").notNull().references(() => profiles.id),
    name: text("name").notNull(),
    key_prefix: text("key_prefix").notNull(),
    key_suffix: text("key_suffix").notNull(),
    key_hash: text("key_hash").notNull().unique(),

    // Permissions
    scopes: text("scopes").array().default(["documents:read", "documents:write", "webhooks:read"]),
    rate_limit_per_minute: integer("rate_limit_per_minute").default(60),

    // Status
    is_active: boolean("is_active").default(true),
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    hashIdx: index("idx_api_keys_hash").on(t.key_hash),
  })
);

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  signing_secret: text("signing_secret").notNull(),
  is_active: boolean("is_active").default(true),
  last_triggered_at: timestamp("last_triggered_at", { withTimezone: true }),
  failure_count: integer("failure_count").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════
// DIGITAL PRODUCT SALES  (migration 02)
// ════════════════════════════════════════════════════════════════════════

export const digital_product_sales = pgTable(
  "digital_product_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),

    // Product
    product_name: text("product_name").notNull(),
    product_description: text("product_description"),
    product_url: text("product_url").notNull(),
    product_hash: text("product_hash").notNull(),
    product_size_bytes: bigint("product_size_bytes", { mode: "number" }),
    product_type: text("product_type").$type<
      "ebook" | "audio" | "video" | "code" | "design_files" | "archive"
    >(),

    // Buyer
    buyer_email: text("buyer_email").notNull(),
    buyer_name: text("buyer_name").notNull(),
    buyer_country: text("buyer_country"),

    // Certificate
    certificate_hash: text("certificate_hash").notNull(),
    certificate_pdf_url: text("certificate_pdf_url"),
    bundled_zip_url: text("bundled_zip_url"),

    // License
    license_terms: text("license_terms").notNull(),
    resale_allowed: boolean("resale_allowed").default(false),
    commercial_use_allowed: boolean("commercial_use_allowed").default(true),
    attribution_required: boolean("attribution_required").default(false),

    // Payment
    amount_paid: numeric("amount_paid", { precision: 10, scale: 2 }),
    currency: text("currency").default("USD"),
    payment_provider: text("payment_provider").$type<"stripe" | "tranzila" | "paypal" | "manual">(),
    payment_id: text("payment_id"),

    // Lifecycle
    download_count: integer("download_count").default(0),
    last_downloaded_at: timestamp("last_downloaded_at", { withTimezone: true }),

    // Resale chain
    resold_from_id: uuid("resold_from_id"),
    is_active_owner: boolean("is_active_owner").default(true),

    purchased_at: timestamp("purchased_at", { withTimezone: true }).defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamIdx: index("idx_dps_team").on(t.team_id),
    buyerIdx: index("idx_dps_buyer").on(t.buyer_email),
    hashIdx: index("idx_dps_hash").on(t.certificate_hash),
  })
);

// ════════════════════════════════════════════════════════════════════════
// AI CONTRACT ANALYSIS  (migration 02)
// ════════════════════════════════════════════════════════════════════════

export const contract_analyses = pgTable(
  "contract_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    document_id: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),

    // Analysis
    contract_type: text("contract_type").notNull(),
    detected_language: text("detected_language").notNull().$type<"he" | "en" | "mixed">(),

    // Risk
    risk_score: integer("risk_score").notNull(),
    risk_level: text("risk_level").notNull().$type<"low" | "medium" | "high" | "critical">(),
    findings_count: integer("findings_count").notNull().default(0),
    findings_data: jsonb("findings_data").notNull(),

    // Summaries
    summary_he: text("summary_he"),
    summary_en: text("summary_en"),
    recommended_actions: text("recommended_actions").array(),

    // Provenance
    ai_model_used: text("ai_model_used").default("claude-opus-4-7"),
    analysis_duration_ms: integer("analysis_duration_ms"),
    cost_credits: numeric("cost_credits", { precision: 10, scale: 4 }),

    // Timestamps & feedback
    analyzed_at: timestamp("analyzed_at", { withTimezone: true }).defaultNow(),
    user_rating: integer("user_rating"),
    user_feedback: text("user_feedback"),
  },
  (t) => ({
    docIdx: index("idx_analyses_doc").on(t.document_id),
    riskIdx: index("idx_analyses_risk").on(t.risk_level),
  })
);

// ════════════════════════════════════════════════════════════════════════
// LAWYER CASE MANAGEMENT  (migration 02)
// ════════════════════════════════════════════════════════════════════════

export const legal_cases = pgTable(
  "legal_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),

    // Identification
    case_number: text("case_number"),
    court_case_number: text("court_case_number"),
    court_name: text("court_name"),

    // Parties
    client_name: text("client_name").notNull(),
    client_id_number: text("client_id_number"),
    opposing_party_name: text("opposing_party_name"),

    // Type & subject
    case_type: text("case_type").$type<
      "civil" | "family" | "criminal" | "labor" | "administrative" | "commercial"
    >(),
    case_subject: text("case_subject").notNull(),
    legal_basis: text("legal_basis"),

    // Status
    status: text("status")
      .default("active")
      .$type<"intake" | "active" | "in_court" | "pending_decision" | "closed" | "archived">(),

    // Dates
    opened_at: date("opened_at").notNull().default(sql`CURRENT_DATE`),
    next_hearing_at: timestamp("next_hearing_at", { withTimezone: true }),
    closed_at: timestamp("closed_at", { withTimezone: true }),

    // Financials
    fee_arrangement: text("fee_arrangement").$type<"hourly" | "flat" | "contingency" | "hybrid">(),
    hourly_rate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    flat_fee: numeric("flat_fee", { precision: 10, scale: 2 }),
    contingency_percentage: numeric("contingency_percentage", { precision: 5, scale: 2 }),
    total_billed: numeric("total_billed", { precision: 12, scale: 2 }).default("0"),
    total_paid: numeric("total_paid", { precision: 12, scale: 2 }).default("0"),
    notes: text("notes"),
    primary_attorney_id: uuid("primary_attorney_id").references(() => profiles.id),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamIdx: index("idx_cases_team").on(t.team_id),
    statusIdx: index("idx_cases_status").on(t.status),
    attorneyIdx: index("idx_cases_attorney").on(t.primary_attorney_id),
    hearingIdx: index("idx_cases_hearing").on(t.next_hearing_at),
  })
);

export const case_documents = pgTable(
  "case_documents",
  {
    case_id: uuid("case_id").notNull().references(() => legal_cases.id, { onDelete: "cascade" }),
    document_id: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    document_role: text("document_role").$type<
      "engagement" | "pleading" | "evidence" | "judgment" | "correspondence"
    >(),
    added_at: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.case_id, t.document_id] }),
  })
);

export const time_entries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    case_id: uuid("case_id").notNull().references(() => legal_cases.id, { onDelete: "cascade" }),
    attorney_id: uuid("attorney_id").notNull().references(() => profiles.id),
    entry_date: date("entry_date").notNull().default(sql`CURRENT_DATE`),
    duration_minutes: integer("duration_minutes").notNull(),
    description: text("description").notNull(),
    is_billable: boolean("is_billable").default(true),
    hourly_rate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    // `amount` is a GENERATED ALWAYS column — do not write to it
    is_invoiced: boolean("is_invoiced").default(false),
    invoice_id: uuid("invoice_id").references(() => invoices.id),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    caseIdx: index("idx_time_case").on(t.case_id),
    attorneyIdx: index("idx_time_attorney").on(t.attorney_id),
  })
);

// ════════════════════════════════════════════════════════════════════════
// MARKETING CAMPAIGNS  (migration 02)
// ════════════════════════════════════════════════════════════════════════

export const marketing_campaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaign_name: text("campaign_name").notNull(),
    campaign_type: text("campaign_type").notNull().$type<
      "email_blast" | "cold_outreach" | "paid_ads" | "webinar" | "content_series"
    >(),
    target_market: text("target_market").notNull().$type<"IL" | "US" | "EU" | "global">(),
    target_audience: text("target_audience"),
    language: text("language").default("en").$type<"he" | "en">(),

    // Status & schedule
    status: text("status")
      .default("draft")
      .$type<"draft" | "scheduled" | "active" | "paused" | "completed">(),
    scheduled_start: timestamp("scheduled_start", { withTimezone: true }),
    scheduled_end: timestamp("scheduled_end", { withTimezone: true }),

    // Targeting
    recipient_filter: jsonb("recipient_filter"),
    estimated_recipients: integer("estimated_recipients"),

    // Content
    email_subject: text("email_subject"),
    email_body_html: text("email_body_html"),
    whatsapp_template_name: text("whatsapp_template_name"),
    landing_page_url: text("landing_page_url"),
    utm_source: text("utm_source"),
    utm_medium: text("utm_medium"),
    utm_campaign: text("utm_campaign"),

    // Budget
    budget_amount: numeric("budget_amount", { precision: 10, scale: 2 }),
    budget_currency: text("budget_currency").default("USD"),

    // Results
    total_sent: integer("total_sent").default(0),
    total_opens: integer("total_opens").default(0),
    total_clicks: integer("total_clicks").default(0),
    total_conversions: integer("total_conversions").default(0),
    attributed_revenue: numeric("attributed_revenue", { precision: 12, scale: 2 }).default("0"),

    created_by: uuid("created_by").references(() => profiles.id),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    statusIdx: index("idx_campaigns_status").on(t.status),
    marketIdx: index("idx_campaigns_market").on(t.target_market),
  })
);

// ════════════════════════════════════════════════════════════════════════
// LAWYER VERIFICATION  (migration 02)
// ════════════════════════════════════════════════════════════════════════

export const lawyer_verifications = pgTable(
  "lawyer_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),

    // Bar info
    bar_number: text("bar_number").notNull(),
    bar_country: text("bar_country").default("IL"),
    full_name_on_record: text("full_name_on_record"),

    // Verification
    status: text("status")
      .notNull()
      .default("pending")
      .$type<"pending" | "verified" | "rejected" | "expired">(),
    verified_at: timestamp("verified_at", { withTimezone: true }),
    verification_method: text("verification_method").$type<
      "manual" | "api" | "document_upload"
    >(),
    verification_doc_url: text("verification_doc_url"),

    // Renewal
    expires_at: date("expires_at"),
    rejection_reason: text("rejection_reason"),
    admin_notes: text("admin_notes"),

    submitted_at: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("idx_lawyer_user").on(t.user_id),
    statusIdx: index("idx_lawyer_status").on(t.status),
  })
);

// ════════════════════════════════════════════════════════════════════════
// VERIFICATION LOG  (migration 03)
// ════════════════════════════════════════════════════════════════════════

export const verification_log = pgTable(
  "verification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // What was checked
    file_hash: text("file_hash").notNull(),
    file_size: bigint("file_size", { mode: "number" }),
    file_type: text("file_type"),

    // Verdict
    verdict: text("verdict").notNull().$type<
      "authentic" | "tampered" | "ai_generated" | "suspicious" | "unknown"
    >(),
    confidence: integer("confidence"),
    is_ai: boolean("is_ai").default(false),
    is_tampered: boolean("is_tampered").default(false),
    is_in_registry: boolean("is_in_registry").default(false),

    // Full report
    full_report: jsonb("full_report"),

    // Who checked
    checked_by_user_id: uuid("checked_by_user_id").references(() => profiles.id),
    checked_by_team_id: uuid("checked_by_team_id").references(() => teams.id),
    ip_address: inet("ip_address"),

    checked_at: timestamp("checked_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    hashIdx: index("idx_verlog_hash").on(t.file_hash),
    verdictIdx: index("idx_verlog_verdict").on(t.verdict),
    userIdx: index("idx_verlog_user").on(t.checked_by_user_id),
    whenIdx: index("idx_verlog_when").on(t.checked_at),
  })
);

// ════════════════════════════════════════════════════════════════════════
// AUTOMATIONS  (migration 03)
// ════════════════════════════════════════════════════════════════════════

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),
    automation_type: text("automation_type").notNull().$type<
      "make" | "zapier" | "n8n" | "custom_script" | "ai_agent" | "rpa" | "other"
    >(),

    // Technical details
    platform_url: text("platform_url"),
    ai_model: text("ai_model"),
    ai_provider: text("ai_provider"),
    inputs_schema: jsonb("inputs_schema"),
    outputs_schema: jsonb("outputs_schema"),

    // Compliance
    human_oversight: text("human_oversight")
      .notNull()
      .default("none")
      .$type<"none" | "review_after" | "approval_required" | "co-pilot">(),

    // Authentication
    signing_key_hash: text("signing_key_hash").unique().notNull(),

    // Status
    is_active: boolean("is_active").default(true),
    total_runs: bigint("total_runs", { mode: "number" }).default(0),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    deactivated_at: timestamp("deactivated_at", { withTimezone: true }),
  },
  (t) => ({
    teamIdx: index("idx_auto_team").on(t.team_id),
    activeIdx: index("idx_auto_active").on(t.is_active),
    keyHashIdx: index("idx_auto_keyhash").on(t.signing_key_hash),
  })
);

export const automation_signatures = pgTable(
  "automation_signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automation_id: uuid("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
    team_id: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),

    // Output
    output_type: text("output_type").notNull().$type<
      "document" | "data" | "decision" | "action" | "message"
    >(),
    output_hash: text("output_hash").notNull(),
    output_size_bytes: bigint("output_size_bytes", { mode: "number" }),
    output_metadata: jsonb("output_metadata"),

    // Inputs
    inputs_hash: text("inputs_hash").notNull(),
    inputs_data: jsonb("inputs_data"),

    // Steps
    steps_hash: text("steps_hash"),
    steps_data: jsonb("steps_data"),

    // Signature
    signature_hash: text("signature_hash").notNull().unique(),
    rfc3161_token: text("rfc3161_token"),
    public_url: text("public_url").unique(),

    // Context
    triggered_by: text("triggered_by"),
    human_approver_id: uuid("human_approver_id").references(() => profiles.id),
    parent_run_id: uuid("parent_run_id"),

    signed_at: timestamp("signed_at", { withTimezone: true }).defaultNow(),
    verification_count: integer("verification_count").default(0),
    last_verified_at: timestamp("last_verified_at", { withTimezone: true }),
  },
  (t) => ({
    automationIdx: index("idx_autosig_automation").on(t.automation_id),
    teamIdx: index("idx_autosig_team").on(t.team_id),
    hashIdx: index("idx_autosig_hash").on(t.signature_hash),
    outputIdx: index("idx_autosig_output").on(t.output_hash),
    publicIdx: index("idx_autosig_public").on(t.public_url),
    whenIdx: index("idx_autosig_when").on(t.signed_at),
  })
);

export const automation_templates = pgTable("automation_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  template_id: text("template_id").unique().notNull(),
  name_he: text("name_he").notNull(),
  name_en: text("name_en").notNull(),
  description_he: text("description_he"),
  description_en: text("description_en"),
  category: text("category"),
  platform: text("platform").notNull().$type<"make" | "zapier" | "n8n" | "native">(),
  platform_template_url: text("platform_template_url"),
  use_case_he: text("use_case_he"),
  use_case_en: text("use_case_en"),
  setup_steps_he: jsonb("setup_steps_he"),
  setup_steps_en: jsonb("setup_steps_en"),
  use_count: integer("use_count").default(0),
  is_published: boolean("is_published").default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════
// INFERRED TYPES
// ════════════════════════════════════════════════════════════════════════
// Import these in routes / services for full type safety without Drizzle queries.
//
//   import type { Profile, NewProfile, Document, NewDocument, ... } from "../db/schema";

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type Profile                = InferSelectModel<typeof profiles>;
export type NewProfile             = InferInsertModel<typeof profiles>;

export type Team                   = InferSelectModel<typeof teams>;
export type NewTeam                = InferInsertModel<typeof teams>;

export type TeamMember             = InferSelectModel<typeof team_members>;
export type NewTeamMember          = InferInsertModel<typeof team_members>;

export type Document               = InferSelectModel<typeof documents>;
export type NewDocument            = InferInsertModel<typeof documents>;

export type Signer                 = InferSelectModel<typeof signers>;
export type NewSigner              = InferInsertModel<typeof signers>;

export type DocumentField          = InferSelectModel<typeof document_fields>;
export type NewDocumentField       = InferInsertModel<typeof document_fields>;

export type Certificate            = InferSelectModel<typeof certificates>;
export type NewCertificate         = InferInsertModel<typeof certificates>;

export type AuditLog               = InferSelectModel<typeof audit_log>;
export type NewAuditLog            = InferInsertModel<typeof audit_log>;

export type Template               = InferSelectModel<typeof templates>;
export type NewTemplate            = InferInsertModel<typeof templates>;

export type Invoice                = InferSelectModel<typeof invoices>;
export type NewInvoice             = InferInsertModel<typeof invoices>;

export type EmailFlow              = InferSelectModel<typeof email_flows>;
export type NewEmailFlow           = InferInsertModel<typeof email_flows>;

export type EmailStep              = InferSelectModel<typeof email_steps>;
export type NewEmailStep           = InferInsertModel<typeof email_steps>;

export type MessageQueue           = InferSelectModel<typeof message_queue>;
export type NewMessageQueue        = InferInsertModel<typeof message_queue>;

export type AbandonmentEvent       = InferSelectModel<typeof abandonment_events>;
export type NewAbandonmentEvent    = InferInsertModel<typeof abandonment_events>;

export type ApiKey                 = InferSelectModel<typeof api_keys>;
export type NewApiKey              = InferInsertModel<typeof api_keys>;

export type Webhook                = InferSelectModel<typeof webhooks>;
export type NewWebhook             = InferInsertModel<typeof webhooks>;

export type DigitalProductSale     = InferSelectModel<typeof digital_product_sales>;
export type NewDigitalProductSale  = InferInsertModel<typeof digital_product_sales>;

export type ContractAnalysis       = InferSelectModel<typeof contract_analyses>;
export type NewContractAnalysis    = InferInsertModel<typeof contract_analyses>;

export type LegalCase              = InferSelectModel<typeof legal_cases>;
export type NewLegalCase           = InferInsertModel<typeof legal_cases>;

export type CaseDocument           = InferSelectModel<typeof case_documents>;
export type NewCaseDocument        = InferInsertModel<typeof case_documents>;

export type TimeEntry              = InferSelectModel<typeof time_entries>;
export type NewTimeEntry           = InferInsertModel<typeof time_entries>;

export type MarketingCampaign      = InferSelectModel<typeof marketing_campaigns>;
export type NewMarketingCampaign   = InferInsertModel<typeof marketing_campaigns>;

export type LawyerVerification     = InferSelectModel<typeof lawyer_verifications>;
export type NewLawyerVerification  = InferInsertModel<typeof lawyer_verifications>;

export type VerificationLog        = InferSelectModel<typeof verification_log>;
export type NewVerificationLog     = InferInsertModel<typeof verification_log>;

export type Automation             = InferSelectModel<typeof automations>;
export type NewAutomation          = InferInsertModel<typeof automations>;

export type AutomationSignature    = InferSelectModel<typeof automation_signatures>;
export type NewAutomationSignature = InferInsertModel<typeof automation_signatures>;

export type AutomationTemplate     = InferSelectModel<typeof automation_templates>;
export type NewAutomationTemplate  = InferInsertModel<typeof automation_templates>;
