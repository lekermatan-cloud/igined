import { Hono } from "hono";
import { Env } from "../config";
import { EmailSender } from "../lib/email/sender";
import { MessageQueue } from "../lib/email/queue";
import { AbandonmentDetector } from "../lib/email/abandonment";

const emailWorker = new Hono<{ Bindings: Env }>();

emailWorker.post("/", async (c) => {
  const env = c.env as Env;
  const cronSecret = c.req.header("X-Cron-Secret");

  if (!env.CRON_SECRET || cronSecret !== env.CRON_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const startTime = Date.now();
  const stats = {
    abandonmentsDetected: 0,
    messagesScheduled: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const env = c.env as Env;

    await AbandonmentDetector.prototype.detectAbandonments.call(
      new AbandonmentDetector(env)
    );

    stats.messagesScheduled =
      await AbandonmentDetector.prototype.scheduleQueuedMessages.call(
        new AbandonmentDetector(env)
      );

    const queue = new MessageQueue(env);
    const sender = new EmailSender(env);

    const messages = await queue.fetchDueMessages(100);
    stats.processed = messages.length;

    for (const msg of messages) {
      try {
        const detector = new AbandonmentDetector(env);
        if (await detector.shouldSkip(msg)) {
          await queue.markSkipped(msg.id);
          stats.skipped++;
          continue;
        }

        if (msg.channel === "email" && msg.recipient_email) {
          const providerId = await sender.sendFromQueue({
            recipient_email: msg.recipient_email,
            subject: msg.subject || "",
            body_html: msg.body_html || "",
            body_text: msg.body_text || "",
            flow_id: msg.flow_id || undefined,
            language: msg.language || undefined,
          });

          await queue.markSent(msg.id, providerId);
          stats.sent++;
        }
      } catch (err) {
        await queue.markFailed(
          msg.id,
          err instanceof Error ? err.message : "Unknown error"
        );
        stats.failed++;
      }
    }

    return c.json({
      success: true,
      duration_ms: Date.now() - startTime,
      ...stats,
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      500
    );
  }
});

export default emailWorker;