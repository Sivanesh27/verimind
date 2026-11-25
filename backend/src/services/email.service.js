import { env } from '../config/env.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Send a transactional email through Brevo. Without a key (local dev) the email is logged instead. */
export async function sendEmail({ to, subject, html }) {
  if (!env.brevoApiKey) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}`);
    return;
  }
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': env.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.mailFromEmail, name: env.mailFromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    console.error('[email] Brevo error', res.status, await res.text());
    throw new Error('Failed to send email');
  }
}

/** Fire-and-forget variant for notifications that must never break the request. */
export function sendEmailSafe(msg) {
  sendEmail(msg).catch((err) => console.error('[email] notification failed:', err.message));
}

function escapeHtml(s = '') {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s).replace(/[&<>"']/g, (c) => map[c]);
}

const layout = (body) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1f2937">
  <h2 style="color:#4f46e5;margin:0 0 16px">VeriMind</h2>
  ${body}
  <p style="font-size:12px;color:#6b7280;margin-top:32px">VeriMind — AI that knows when to verify.</p>
</div>`;

export const codeEmail = (code, purpose) =>
  layout(`<p>Your ${purpose === 'reset' ? 'password reset' : 'email verification'} code is:</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:700">${code}</p>
  <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`);

export const escalationEmail = ({ query, confidence, reasons, link }) =>
  layout(`<p>A query was escalated for human review.</p>
  <p><b>Query:</b> ${escapeHtml(query)}</p>
  <p><b>Confidence:</b> ${Math.round(confidence * 100)}%</p>
  <ul>${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
  <p><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open review queue</a></p>`);

export const resolutionEmail = ({ query, resolution, link }) =>
  layout(`<p>A human reviewer answered your escalated question.</p>
  <p><b>Your question:</b> ${escapeHtml(query)}</p>
  <p><b>Reviewer answer:</b> ${escapeHtml(resolution)}</p>
  <p><a href="${link}">View in VeriMind</a></p>`);
