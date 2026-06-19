// Envío de correo con varios proveedores, eligiendo el primero configurado:
//   1) Resend  (RESEND_API_KEY)            — vía HTTP, sin dependencias.
//   2) SMTP    (SMTP_HOST, SMTP_USER, …)   — vía nodemailer (require perezoso).
//   3) Sin proveedor: registra el contenido en el log del servidor (modo dev),
//      para no romper el flujo cuando aún no hay correo configurado.
//
// Devuelve { delivered: boolean, provider: string }.

const FROM = process.env.MAIL_FROM || 'Control Doc <onboarding@resend.dev>';

async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend respondió ${res.status}: ${detail}`);
  }
}

async function sendViaSmtp({ to, subject, html, text }) {
  // Require perezoso: nodemailer solo es necesario si se usa SMTP.
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '') === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({ from: FROM, to, subject, html, text });
}

async function sendMail({ to, subject, html, text }) {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to, subject, html, text });
    return { delivered: true, provider: 'resend' };
  }
  if (process.env.SMTP_HOST) {
    await sendViaSmtp({ to, subject, html, text });
    return { delivered: true, provider: 'smtp' };
  }
  console.warn(
    `[mailer] Sin proveedor de correo configurado. No se envió "${subject}" a ${to}.\n` +
    `         Contenido (texto):\n${text}`
  );
  return { delivered: false, provider: 'none' };
}

module.exports = { sendMail };
