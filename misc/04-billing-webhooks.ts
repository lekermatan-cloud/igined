// ════════════════════════════════════════════════════════════════════════
// SIGIL · Billing Webhooks (Stripe + Tranzila)
// ════════════════════════════════════════════════════════════════════════
// Handles subscription lifecycle events from both payment providers.
// Stripe is for USD billing (US, EU customers).
// Tranzila is for ILS billing (Israeli customers).
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const TRANZILA_TERMINAL = Deno.env.get("TRANZILA_TERMINAL_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2023-10-16" });

// Plan price mapping
const PLAN_PRICES = {
  basic_usd: { plan: "basic", currency: "USD", amount: 8 },
  basic_ils: { plan: "basic", currency: "ILS", amount: 30 },
  pro_usd: { plan: "pro", currency: "USD", amount: 100 },
  pro_ils: { plan: "pro", currency: "ILS", amount: 370 },
  enterprise_usd: { plan: "enterprise", currency: "USD", amount: 450 }
};

// ─── Routes ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  if (path === "stripe" && req.method === "POST") {
    return handleStripeWebhook(req);
  }
  if (path === "tranzila" && req.method === "POST") {
    return handleTranzilaWebhook(req);
  }
  if (path === "create-checkout" && req.method === "POST") {
    return handleCreateCheckout(req);
  }
  if (path === "cancel" && req.method === "POST") {
    return handleCancel(req);
  }

  return new Response("Not found", { status: 404 });
});

// ════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK
// ════════════════════════════════════════════════════════════════════════
// Configure in Stripe Dashboard → Developers → Webhooks
// Subscribe to: customer.subscription.*, invoice.paid, invoice.payment_failed

async function handleStripeWebhook(req: Request): Promise<Response> {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const teamId = session.metadata?.team_id;
  if (!teamId) return;

  await supabase
    .from("teams")
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: "active"
    })
    .eq("id", teamId);

  // Trigger welcome email
  await supabase.from("abandonment_events").insert({
    user_id: session.metadata?.user_id,
    abandonment_type: "signup_started",
    recovery_status: "recovered",
    recovered_at: new Date().toISOString(),
    recovery_revenue: (session.amount_total || 0) / 100
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  const plan = mapPriceIdToPlan(priceId);

  await supabase
    .from("teams")
    .update({
      plan,
      subscription_status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
    })
    .eq("stripe_subscription_id", sub.id);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  // Don't delete the team - just downgrade to free
  await supabase
    .from("teams")
    .update({
      plan: "free",
      subscription_status: "canceled",
      stripe_subscription_id: null
    })
    .eq("stripe_subscription_id", sub.id);

  // Trigger churn winback flow
  const { data: team } = await supabase
    .from("teams")
    .select("owner_id")
    .eq("stripe_subscription_id", sub.id)
    .single();

  if (team) {
    await supabase.from("abandonment_events").insert({
      user_id: team.owner_id,
      abandonment_type: "churned",
      recovery_status: "in_recovery",
      next_action_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("stripe_customer_id", invoice.customer as string)
    .single();

  if (!team) return;

  await supabase.from("invoices").insert({
    team_id: team.id,
    invoice_number: invoice.number || invoice.id,
    amount: (invoice.amount_paid || 0) / 100,
    currency: (invoice.currency || "usd").toUpperCase(),
    status: "paid",
    provider: "stripe",
    provider_invoice_id: invoice.id,
    provider_payment_id: invoice.payment_intent as string,
    paid_at: new Date((invoice.status_transitions?.paid_at || 0) * 1000).toISOString(),
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    pdf_url: invoice.invoice_pdf
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const { data: team } = await supabase
    .from("teams")
    .select("id, owner_id")
    .eq("stripe_customer_id", invoice.customer as string)
    .single();

  if (!team) return;

  // Mark subscription as past_due
  await supabase
    .from("teams")
    .update({ subscription_status: "past_due" })
    .eq("id", team.id);

  // Trigger payment failure flow
  await supabase.from("abandonment_events").insert({
    user_id: team.owner_id,
    abandonment_type: "payment_failed",
    recovery_status: "in_recovery",
    next_action_at: new Date().toISOString(),
    abandonment_data: {
      amount: (invoice.amount_due || 0) / 100,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count
    }
  });
}

// ════════════════════════════════════════════════════════════════════════
// CREATE STRIPE CHECKOUT SESSION
// ════════════════════════════════════════════════════════════════════════

async function handleCreateCheckout(req: Request): Promise<Response> {
  const { team_id, plan, currency, return_url } = await req.json();

  // Map plan to Stripe price ID
  const priceIds: Record<string, string> = {
    "basic_USD": Deno.env.get("STRIPE_PRICE_BASIC_USD")!,
    "pro_USD": Deno.env.get("STRIPE_PRICE_PRO_USD")!,
    "enterprise_USD": Deno.env.get("STRIPE_PRICE_ENTERPRISE_USD")!
  };

  const priceId = priceIds[`${plan}_${currency}`];
  if (!priceId) {
    return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("stripe_customer_id, owner_id, profiles:owner_id(email)")
    .eq("id", team_id)
    .single();

  // Create or retrieve Stripe customer
  let customerId = team?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: (team?.profiles as any)?.email,
      metadata: { team_id }
    });
    customerId = customer.id;
    await supabase.from("teams").update({ stripe_customer_id: customerId }).eq("id", team_id);
  }

  // Create checkout session with 14-day trial
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14
    },
    success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: return_url,
    metadata: { team_id, user_id: team?.owner_id, plan }
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handleCancel(req: Request): Promise<Response> {
  const { team_id } = await req.json();

  const { data: team } = await supabase
    .from("teams")
    .select("stripe_subscription_id")
    .eq("id", team_id)
    .single();

  if (team?.stripe_subscription_id) {
    await stripe.subscriptions.update(team.stripe_subscription_id, {
      cancel_at_period_end: true
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}

// ════════════════════════════════════════════════════════════════════════
// TRANZILA WEBHOOK (Israeli payments)
// ════════════════════════════════════════════════════════════════════════
// Tranzila sends POST to your URL after each charge.
// Set webhook URL in Tranzila admin panel.

async function handleTranzilaWebhook(req: Request): Promise<Response> {
  const body = await req.formData();
  const data = Object.fromEntries(body.entries()) as Record<string, string>;

  // Verify Tranzila signature (anti-fraud)
  // Documentation: https://docs.tranzila.com
  const isValid = verifyTranzilaSignature(data);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const status = data.Response;
  if (status === "000") {
    // Success
    const teamId = data.user_id;
    const amount = parseFloat(data.sum);
    const isMonthly = data.subscription === "true";

    if (isMonthly) {
      await supabase
        .from("teams")
        .update({
          plan: "basic", // Tranzila handles only Basic ₪30 plan
          subscription_status: "active",
          tranzila_token: data.TranzilaTK,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq("id", teamId);
    }

    // Create invoice
    await supabase.from("invoices").insert({
      team_id: teamId,
      invoice_number: `TZ-${data.ConfirmationCode}`,
      amount: amount / 1.17, // Strip VAT for net amount
      vat_amount: amount - (amount / 1.17),
      currency: "ILS",
      status: "paid",
      provider: "tranzila",
      provider_payment_id: data.ConfirmationCode,
      paid_at: new Date().toISOString(),
      recipient_business_id: data.business_id,
      recipient_business_name: data.business_name
    });
  } else {
    // Failure - trigger payment_failed flow
    const teamId = data.user_id;
    const { data: team } = await supabase
      .from("teams")
      .select("owner_id")
      .eq("id", teamId)
      .single();

    if (team) {
      await supabase.from("abandonment_events").insert({
        user_id: team.owner_id,
        abandonment_type: "payment_failed",
        recovery_status: "in_recovery",
        next_action_at: new Date().toISOString(),
        abandonment_data: { tranzila_response: status, error: data.message }
      });
    }
  }

  return new Response("OK");
}

function verifyTranzilaSignature(data: Record<string, string>): boolean {
  // PRODUCTION: implement proper Tranzila signature verification
  // using their HMAC-based scheme. See Tranzila docs.
  return true; // PLACEHOLDER
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

function mapPriceIdToPlan(priceId: string | undefined): string {
  if (!priceId) return "free";
  if (priceId === Deno.env.get("STRIPE_PRICE_BASIC_USD")) return "basic";
  if (priceId === Deno.env.get("STRIPE_PRICE_PRO_USD")) return "pro";
  if (priceId === Deno.env.get("STRIPE_PRICE_ENTERPRISE_USD")) return "enterprise";
  return "free";
}
