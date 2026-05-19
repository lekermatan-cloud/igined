import { Hono } from "hono";
import Stripe from "stripe";
import { createServiceClient } from "../lib/supabase";
import { authMiddleware, requireAuth } from "../middleware/auth";
import { Env } from "../config";
import { z } from "zod";

const billing = new Hono<{ Bindings: Env }>();

function getStripe(env: Env): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
}

const checkoutSchema = z.object({
  plan: z.enum(["basic", "pro", "enterprise"]),
  currency: z.enum(["USD"]).default("USD"),
  return_url: z.string().optional(),
});

billing.post("/checkout", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const body = await c.req.json();

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  const supabase = createServiceClient(env);
  const stripe = getStripe(env);

  const { data: team } = await supabase
    .from("teams")
    .select("id, stripe_customer_id, owner_id, profiles!owner_id(email)")
    .eq("id", authCtx.teamId || "")
    .single();

  if (!team) {
    return c.json({ error: "Team not found" }, 404);
  }

  const priceIds: Record<string, string> = {
    basic_USD: env.STRIPE_PRICE_BASIC_USD || "",
    pro_USD: env.STRIPE_PRICE_PRO_USD || "",
    enterprise_USD: env.STRIPE_PRICE_ENTERPRISE_USD || "",
  };

  const priceId = priceIds[`${parsed.data.plan}_${parsed.data.currency}`];
  if (!priceId || priceId.includes("placeholder")) {
    return c.json({ error: "Stripe price not configured" }, 503);
  }

  const email = (team.profiles as any)?.email || authCtx.email || "";
  const appUrl = env.APP_URL || "http://localhost:5173";
  const returnUrl = parsed.data.return_url || `${appUrl}/dashboard?tab=billing`;

  let customerId = team.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { team_id: team.id, user_id: authCtx.userId },
    });
    customerId = customer.id;
    await supabase.from("teams").update({ stripe_customer_id: customerId }).eq("id", team.id);
  } else {
    try {
      await stripe.customers.update(customerId, { email });
    } catch (e) {
      // ignore if email update fails
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { team_id: team.id, user_id: authCtx.userId },
    },
    success_url: `${returnUrl}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}&payment=canceled`,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    metadata: {
      team_id: team.id,
      user_id: authCtx.userId,
      plan: parsed.data.plan,
    },
  });

  return c.json({ url: session.url, sessionId: session.id });
});

billing.post("/portal", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);

  if (!env.STRIPE_SECRET_KEY) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  const supabase = createServiceClient(env);
  const stripe = getStripe(env);

  const { data: team } = await supabase
    .from("teams")
    .select("id, stripe_customer_id")
    .eq("id", authCtx.teamId || "")
    .single();

  if (!team || !team.stripe_customer_id) {
    return c.json({ error: "No subscription found" }, 404);
  }

  const appUrl = env.APP_URL || "http://localhost:5173";
  const session = await stripe.billingPortal.sessions.create({
    customer: team.stripe_customer_id,
    return_url: `${appUrl}/dashboard?tab=billing`,
  });

  return c.json({ url: session.url });
});

billing.get("/invoices", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const supabase = createServiceClient(env);

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, status, provider, provider_invoice_id, paid_at, period_start, period_end, pdf_url, created_at")
    .eq("team_id", authCtx.teamId || "")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ invoices: invoices || [] });
});

billing.get("/subscription", authMiddleware, async (c) => {
  const env = c.env as Env;
  const authCtx = requireAuth(c);
  const supabase = createServiceClient(env);

  const { data: team, error } = await supabase
    .from("teams")
    .select("id, plan, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, trial_ends_at")
    .eq("id", authCtx.teamId || "")
    .single();

  if (error || !team) {
    return c.json({ error: "Team not found" }, 404);
  }

  let usage = { documents: 0, storage_mb: 0 };
  const { count: documents } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);
  usage.documents = documents || 0;

  return c.json({ subscription: team, usage });
});

billing.post("/webhook/stripe", async (c) => {
  const env = c.env as Env;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  const body = await c.req.text();
  const sig = c.req.header("stripe-signature");

  if (!sig) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const stripe = getStripe(env);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.json({ error: `Webhook Error: ${(err as Error).message}` }, 400);
  }

  const supabase = createServiceClient(env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const teamId = session.metadata?.team_id;
      if (teamId) {
        await supabase
          .from("teams")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status: "active",
          })
          .eq("id", teamId);
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id;
      let plan = "free";
      if (priceId === env.STRIPE_PRICE_BASIC_USD) plan = "basic";
      else if (priceId === env.STRIPE_PRICE_PRO_USD) plan = "pro";
      else if (priceId === env.STRIPE_PRICE_ENTERPRISE_USD) plan = "enterprise";

      await supabase
        .from("teams")
        .update({
          plan,
          subscription_status: sub.status,
          current_period_end: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("teams")
        .update({
          plan: "free",
          subscription_status: "canceled",
          stripe_subscription_id: null,
        })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("stripe_customer_id", invoice.customer as string)
        .single();

      if (team) {
        const existing = await supabase
          .from("invoices")
          .select("id")
          .eq("provider_invoice_id", invoice.id)
          .single();

        if (!existing.data) {
          await supabase.from("invoices").insert({
            team_id: team.id,
            invoice_number: invoice.number || invoice.id,
            amount: (invoice.amount_paid || 0) / 100,
            currency: (invoice.currency || "usd").toUpperCase(),
            status: "paid",
            provider: "stripe",
            provider_invoice_id: invoice.id,
            provider_payment_id: (invoice as any).payment_intent as string || null,
            paid_at: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            pdf_url: invoice.invoice_pdf,
          });
        }
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await supabase
        .from("teams")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", invoice.customer as string);
      break;
    }
  }

  return c.json({ received: true });
});

export default billing;