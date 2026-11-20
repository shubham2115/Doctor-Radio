/**
 * Email delivery. SMTP transport is wired in a later phase; until SMTP_URL is configured the
 * reset link is logged server-side (development only) so the flow is testable end to end.
 */
export async function sendPasswordResetEmail(to: string, link: string) {
  if (!process.env.SMTP_URL) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] password reset for ${to}: ${link}`);
    else console.error("[email] SMTP_URL is not configured; password reset email not sent");
    return;
  }
  // TODO(phase 6): nodemailer transport using SMTP_URL / EMAIL_FROM.
  console.warn("[email] SMTP transport not implemented yet");
}
