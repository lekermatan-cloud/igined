import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import documentRoutes from "./routes/documents";
import emailWorkerRoutes from "./routes/email-worker";
import signingRoutes from "./routes/signing";
import teamRoutes from "./routes/teams";
import referralRoutes from "./routes/referrals";
import dashboardRoutes from "./routes/dashboard";
import apiKeysRoutes from "./routes/api-keys";
import billingRoutes from "./routes/billing";
import { Env } from "./config";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

app.use("*", async (c, next) => {
  const env = c.env as Env;
  const allowedOrigins = env.CORS_ORIGINS?.split(",").map(o => o.trim()).filter(Boolean) || [];
  
  const corsOptions = {
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  };
  
  return cors(corsOptions)(c, next);
});

app.get("/", (c) => {
  return c.json({
    name: "Sigined API",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/documents", documentRoutes);
app.route("/email-worker", emailWorkerRoutes);
app.route("/signing", signingRoutes);
app.route("/teams", teamRoutes);
app.route("/referrals", referralRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/api-keys", apiKeysRoutes);
app.route("/billing", billingRoutes);

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  console.error("Error:", err);
  const status = err instanceof Response ? err.status : 500;
  return c.json(
    { error: err.message || "Internal server error" },
    status as 500
  );
});

export default app;