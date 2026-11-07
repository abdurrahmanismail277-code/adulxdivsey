import { calculatePrice } from "../../services.js";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: { ...SECURITY_HEADERS, ...headers },
});

const allowedOrigins = new Set(["https://theapexxhouse.com", "https://www.theapexxhouse.com"]);
const originAllowed = (origin, env) => allowedOrigins.has(origin) || (env.ENVIRONMENT === "development" && ["http://localhost:8787", "http://127.0.0.1:8787"].includes(origin));
const verificationCorsHeaders = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  Vary: "Origin",
});

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const clean = (value, limit) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit) : "";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rateWindows = new Map();
const idempotentBookings = new Map();
const money = amount => `₦${Number(amount).toLocaleString("en-NG")}`;
const BANK = Object.freeze({ name: "Moniepoint MFB", accountName: "The Apex House", accountNumber: "9115595519" });
const OWNER_WHATSAPP = "2348038326349";
const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PAYMENT_PROOF_BYTES = 4 * 1024 * 1024;
const BOOKING_RETENTION_SECONDS = 90 * 24 * 60 * 60;

async function verifyRecaptchaToken(token, env) {
  if (!env.RECAPTCHA_SECRET_KEY) {
    console.error("reCAPTCHA verification is unavailable: RECAPTCHA_SECRET_KEY is missing.");
    return { success: false, status: 503, code: "CAPTCHA_CONFIG_ERROR", error: "CAPTCHA verification is temporarily unavailable. Please contact us on WhatsApp." };
  }
  const parameters = new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token });
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: parameters,
    });
    const verification = await response.json();
    console.info("Google reCAPTCHA siteverify response", verification);
    if (!response.ok) {
      return { success: false, status: 503, code: "CAPTCHA_SERVICE_ERROR", error: "Google could not verify the CAPTCHA right now. Please try again." };
    }
    const validHostnames = env.ENVIRONMENT === "development"
      ? new Set(["theapexxhouse.com", "www.theapexxhouse.com", "localhost", "127.0.0.1"])
      : new Set(["theapexxhouse.com", "www.theapexxhouse.com"]);
    if (verification.success === true && !validHostnames.has(verification.hostname)) {
      console.error("reCAPTCHA hostname mismatch", { hostname: verification.hostname, allowed: [...validHostnames] });
      return { success: false, status: 403, code: "CAPTCHA_HOSTNAME_MISMATCH", error: "CAPTCHA is not enabled for this website address. Please contact us on WhatsApp." };
    }
    if (verification.success === true) return { success: true };
    const errorCodes = Array.isArray(verification["error-codes"]) ? verification["error-codes"] : [];
    if (errorCodes.includes("invalid-input-secret")) {
      return { success: false, status: 503, code: "CAPTCHA_CONFIG_ERROR", error: "CAPTCHA verification is misconfigured. Please contact us on WhatsApp." };
    }
    if (errorCodes.includes("timeout-or-duplicate")) {
      return { success: false, status: 400, code: "CAPTCHA_EXPIRED", error: "Your CAPTCHA expired. Please complete it again and retry." };
    }
    return { success: false, status: 400, code: "CAPTCHA_FAILED", error: "CAPTCHA verification failed. Please complete it again and retry." };
  } catch (error) {
    console.error("Google reCAPTCHA siteverify request failed", error instanceof Error ? error.message : "Unknown error");
    return { success: false, status: 503, code: "CAPTCHA_SERVICE_ERROR", error: "Google could not verify the CAPTCHA right now. Please try again." };
  }
}

async function verifyRecaptcha(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !originAllowed(origin, env)) return json({ success: false, error: "Request origin is not allowed." }, 403);
  const corsHeaders = verificationCorsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405, corsHeaders);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: "Invalid verification request." }, 400, corsHeaders); }
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || token.length > 4096) return json({ success: false, error: "Please complete the reCAPTCHA check." }, 400, corsHeaders);
  const result = await verifyRecaptchaToken(token, env);
  return json(result.success ? { success: true } : { success: false, code: result.code, error: result.error }, result.success ? 200 : result.status, corsHeaders);
}

function bookingFields(input, quote, reference, narration, whatsappUrl) {
  const { service, offer } = quote;
  const amountKnown = input.mode !== "physical" && service.id !== "launch-hosting";
  const amountText = amountKnown ? money(quote.amount) : "To be confirmed, please contact us on WhatsApp for the final amount before you transfer";
  return {
    ...input,
    reference,
    narration,
    service: service.name,
    category: service.categoryLabel,
    package: offer.label,
    unit: offer.unit,
    amount: quote.amount,
    amountKnown,
    amountText,
    whatsappUrl,
    status: "pending_payment",
  };
}

function emailMarkup(booking, internal = false) {
  const rows = [
    ["Service", `${booking.category} / ${booking.service}`], ["Mode", booking.mode], ["Package", booking.package],
    ["Quantity", `${booking.quantity} ${booking.unit}`], ["Event", `${booking.eventName} (${booking.eventType})`],
    ["Preferred date and time", `${booking.eventDate}${booking.eventTime ? ` at ${booking.eventTime}` : ""}`],
    ["Second-choice date", booking.alternateDate || "Not provided"], ["Additional hours", booking.extraHours || 0],
    ["Country", `${booking.country} (${booking.countryISO})`],
    ["Time zone", booking.eventTimezone || "Not applicable"], ["Venue", booking.venue || "Not provided"],
    ["Platform", booking.platform || "Not provided"], ["Audience size", booking.audienceSize],
    ["Additional notes", booking.additionalNotes || "Not provided"], ["Brief", booking.brief || "Not provided"],
  ];
  if (internal) rows.splice(1, 0, ["Client", `${booking.name} / ${booking.email} / ${booking.whatsapp}`]);
  const detailRows = rows.map(([label, value]) => `<tr><th align="left" style="padding:8px 10px;color:#60718a;border-bottom:1px solid #e5edf7">${escapeHtml(label)}</th><td style="padding:8px 10px;color:#142d50;border-bottom:1px solid #e5edf7;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("");
  const payment = booking.amountKnown
    ? `<div style="margin-top:20px;padding:16px;border-radius:12px;background:#edf4ff"><h2 style="margin:0 0 10px;font-size:16px">Transfer details</h2><p style="margin:5px 0">Bank: <strong>${BANK.name}</strong></p><p style="margin:5px 0">Account name: <strong>${BANK.accountName}</strong></p><p style="margin:5px 0">Account number: <strong>${BANK.accountNumber}</strong></p><p style="margin:5px 0">Amount: <strong>${escapeHtml(money(booking.amount))}</strong></p><p style="margin:5px 0">Narration: <strong>${escapeHtml(booking.narration)}</strong></p></div>`
    : `<div style="margin-top:20px;padding:16px;border-radius:12px;background:#fff7e4;color:#463914"><strong>To be confirmed, please contact us on WhatsApp for the final amount before you transfer.</strong></div>`;
  const receipt = `<p style="margin:22px 0"><a href="${escapeHtml(booking.whatsappUrl)}" style="display:inline-block;padding:13px 18px;border-radius:8px;background:#0164ff;color:#fff;text-decoration:none;font-weight:bold">Send your receipt on WhatsApp</a></p>`;
  return `<div style="margin:0;background:#f3f6fb;padding:24px 10px;font-family:Arial,sans-serif;color:#142d50"><div style="max-width:600px;margin:auto;background:#fff;border-radius:14px;overflow:hidden"><div style="padding:24px;background:#021a40;color:#fff"><div style="color:#a9c9ff;font-size:12px;letter-spacing:2px">THE APEX HOUSE</div><h1 style="margin:8px 0 0;font-size:24px">${internal ? "New booking request" : "We received your booking"}</h1></div><div style="padding:24px"><p>Hello ${escapeHtml(booking.name)},</p><p>${internal ? "A new booking was submitted. Status: Pending payment." : "We received your booking. Your payment is pending until we receive and verify your transfer proof."}</p><div style="padding:15px;border:1px solid #c9ddfb;border-radius:10px;background:#f5f9ff"><div style="font-size:11px;color:#60718a">BOOKING REFERENCE / PAYMENT NARRATION</div><strong style="display:block;margin-top:5px;font-size:22px;color:#0164ff">${escapeHtml(booking.reference)}</strong></div><p style="margin:18px 0 8px">Amount: <strong>${escapeHtml(booking.amountText)}</strong></p><table role="presentation" style="width:100%;border-collapse:collapse">${detailRows}</table>${payment}${internal ? "" : receipt}<p style="margin-top:22px;color:#60718a;font-size:12px">The Apex House · +234 803 832 6349</p></div></div></div>`;
}

function emailText(booking, internal = false) {
  const details = `Reference / narration: ${booking.reference}\n${internal ? `Client: ${booking.name} <${booking.email}>\nWhatsApp: ${booking.whatsapp}\n` : ""}Service: ${booking.category} / ${booking.service}\nMode: ${booking.mode}\nPackage: ${booking.package}\nQuantity: ${booking.quantity} ${booking.unit}\nAdditional hours: ${booking.extraHours || 0}\nEvent: ${booking.eventName} (${booking.eventType})\nPreferred date: ${booking.eventDate}${booking.eventTime ? ` at ${booking.eventTime}` : ""}\nSecond-choice date: ${booking.alternateDate || "Not provided"}\nCountry: ${booking.country} (${booking.countryISO})\nTime zone: ${booking.eventTimezone || "Not applicable"}\nVenue: ${booking.venue || "Not provided"}\nPlatform: ${booking.platform || "Not provided"}\nAudience size: ${booking.audienceSize}\nAdditional notes: ${booking.additionalNotes || "Not provided"}\nBrief: ${booking.brief || "Not provided"}\nAmount: ${booking.amountText}`;
  const payment = booking.amountKnown ? `\n\nTransfer details\nBank: ${BANK.name}\nAccount name: ${BANK.accountName}\nAccount number: ${BANK.accountNumber}\nAmount: ${money(booking.amount)}\nNarration: ${booking.narration}` : "\n\nTo be confirmed, please contact us on WhatsApp for the final amount before you transfer.";
  return `${internal ? "New booking request · Pending payment" : `Hello ${booking.name}, we received your booking. Your payment is pending until we receive and verify your transfer proof.`}\n\n${details}${payment}${internal ? "" : `\n\nSend your receipt on WhatsApp: ${booking.whatsappUrl}`}`;
}

async function checkRateLimit(ip, env) {
  if (env.BOOKING_LIMITER && typeof env.BOOKING_LIMITER.limit === "function") {
    try {
      const { success } = await env.BOOKING_LIMITER.limit({ key: ip });
      return success;
    } catch {
      return false;
    }
  }
  const now = Date.now();
  const record = rateWindows.get(ip);
  if (!record || now - record.started > 60_000) {
    rateWindows.set(ip, { started: now, count: 1 });
    return true;
  }
  record.count++;
  return record.count <= 5;
}

const validReference = value => typeof value === "string" && /^APX-[A-F0-9]{24}$/.test(value);
const privatePaymentDetails = () => ({ bankName: BANK.name, accountName: BANK.accountName, accountNumber: BANK.accountNumber });

async function loadBooking(reference, env) {
  if (!validReference(reference)) return null;
  const index = await env.APEX_HOUSE_BOOKINGS.get(`booking-ref:${reference}`, { type: "json" });
  if (!index?.idempotencyKey) return null;
  const record = await env.APEX_HOUSE_BOOKINGS.get(`booking:${index.idempotencyKey}`, { type: "json" });
  return record ? { record, idempotencyKey: index.idempotencyKey } : null;
}

async function saveBooking(reference, idempotencyKey, record, env) {
  await env.APEX_HOUSE_BOOKINGS.put(`booking:${idempotencyKey}`, JSON.stringify(record), { expirationTtl: BOOKING_RETENTION_SECONDS });
  await env.APEX_HOUSE_BOOKINGS.put(`booking-ref:${reference}`, JSON.stringify({ idempotencyKey }), { expirationTtl: BOOKING_RETENTION_SECONDS });
}

async function markExpired(loaded, env) {
  const { record, idempotencyKey } = loaded;
  if (record.status === "pending_payment" && record.expiresAt && Date.now() >= Date.parse(record.expiresAt)) {
    record.status = "expired";
    record.booking.status = "expired";
    record.updatedAt = new Date().toISOString();
    record.response.status = "expired";
    record.response.booking.status = "expired";
    await saveBooking(record.booking.reference, idempotencyKey, record, env);
  }
  return record;
}

function emailHeaders(env) {
  return { from: env.RESEND_FROM_EMAIL || env.RESEND_FROM || "The Apex House <bookings@theapexxhouse.com>" };
}

async function sendResend(env, message) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...emailHeaders(env), ...message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
}

const isValidEmail = value => typeof value === "string" && value.length <= 254 && emailPattern.test(value);

async function retrieveBooking(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !originAllowed(origin, env)) return json({ error: "Request origin is not allowed." }, 403);
  const headers = verificationCorsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...headers } });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, headers);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!await checkRateLimit(`retrieve:${ip}`, env)) return json({ error: "Too many attempts. Please wait a minute and try again." }, 429, headers);
  let input;
  try { input = await request.json(); } catch { return json({ error: "Please send a valid booking reference and email." }, 400, headers); }
  const reference = typeof input?.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!validReference(reference) || !isValidEmail(email)) return json({ error: "Booking not found. Check the reference and email and try again." }, 404, headers);
  let loaded;
  try { loaded = await loadBooking(reference, env); } catch { return json({ error: "We could not retrieve the booking right now. Please try again." }, 503, headers); }
  if (!loaded || loaded.record.booking.email.toLowerCase() !== email) return json({ error: "Booking not found. Check the reference and email and try again." }, 404, headers);
  try {
    const record = await markExpired(loaded, env);
    return json({ ok: true, booking: record.booking, status: record.status, expiresAt: record.expiresAt, emailStatus: record.response.emailStatus || "failed", paymentDetails: privatePaymentDetails() }, 200, headers);
  } catch { return json({ error: "We could not update this booking status right now. Please try again." }, 503, headers); }
}

function proofFileType(bytes, contentType) {
  const starts = (...signature) => signature.every((byte, index) => bytes[index] === byte);
  if (contentType === "image/png" && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return contentType;
  if (contentType === "image/jpeg" && starts(0xff, 0xd8, 0xff)) return contentType;
  if (contentType === "image/webp" && starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return contentType;
  if (contentType === "application/pdf" && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return contentType;
  return "";
}

async function submitPaymentProof(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !originAllowed(origin, env)) return json({ error: "Request origin is not allowed." }, 403);
  const headers = verificationCorsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...headers } });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, headers);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!await checkRateLimit(`proof:${ip}`, env)) return json({ error: "Too many proof submissions. Please wait a minute and try again." }, 429, headers);
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_PAYMENT_PROOF_BYTES + 65_536) return json({ error: "The proof file must be 4 MB or smaller." }, 413, headers);

  let input;
  let proofFile = null;
  try {
    if (request.headers.get("Content-Type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      input = Object.fromEntries(["reference", "email", "method", "senderName", "transferTime"].map(key => [key, form.get(key)]));
      const file = form.get("receipt");
      if (file && typeof file.arrayBuffer === "function" && file.size > 0) proofFile = file;
    } else {
      input = await request.json();
    }
  } catch { return json({ error: "Please submit valid payment proof details." }, 400, headers); }

  const reference = typeof input?.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const method = input?.method === "whatsapp" ? "whatsapp" : "form";
  const senderName = clean(input?.senderName, 120);
  const transferTime = typeof input?.transferTime === "string" ? input.transferTime.trim() : "";
  if (!validReference(reference) || !isValidEmail(email)) return json({ error: "Booking not found. Check the reference and email and try again." }, 404, headers);
  if (method === "form" && !proofFile && (!senderName || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(transferTime) || Number.isNaN(Date.parse(transferTime)))) {
    return json({ error: "Upload a receipt or enter the sender name and transfer time." }, 400, headers);
  }

  let loaded;
  try { loaded = await loadBooking(reference, env); } catch { return json({ error: "We could not retrieve the booking right now. Please try again." }, 503, headers); }
  if (!loaded || loaded.record.booking.email.toLowerCase() !== email) return json({ error: "Booking not found. Check the reference and email and try again." }, 404, headers);
  let record;
  try { record = await markExpired(loaded, env); } catch { return json({ error: "We could not update this booking status right now." }, 503, headers); }
  if (record.status === "expired" || record.status === "cancelled") return json({ error: "This payment window has expired. Start a new booking to continue.", status: record.status }, 410, headers);
  if (record.status === "confirmed") return json({ error: "This booking is already confirmed.", status: record.status }, 409, headers);
  if (record.status === "awaiting_confirmation") return json({ ok: true, status: record.status, message: "Your proof is already awaiting confirmation." }, 200, headers);

  let fileMetadata = null;
  if (proofFile) {
    if (proofFile.size > MAX_PAYMENT_PROOF_BYTES) return json({ error: "The proof file must be 4 MB or smaller." }, 413, headers);
    const bytes = new Uint8Array(await proofFile.arrayBuffer());
    const contentType = proofFileType(bytes, proofFile.type);
    if (!contentType) return json({ error: "Use a JPEG, PNG, WebP, or PDF receipt file." }, 400, headers);
    fileMetadata = { contentType, size: bytes.byteLength, uploadedAt: new Date().toISOString() };
    try { await env.APEX_HOUSE_BOOKINGS.put(`payment-proof:${reference}`, bytes, { metadata: fileMetadata, expirationTtl: BOOKING_RETENTION_SECONDS }); }
    catch { return json({ error: "We could not save that proof file. Please try again or send it on WhatsApp." }, 503, headers); }
  }

  record.status = "awaiting_confirmation";
  record.updatedAt = new Date().toISOString();
  record.proof = { method, senderName: method === "whatsapp" ? "" : senderName, transferTime: method === "whatsapp" ? "" : transferTime, file: fileMetadata };
  record.booking.status = record.status;
  record.response.status = record.status;
  record.response.booking.status = record.status;
  try { await saveBooking(reference, loaded.idempotencyKey, record, env); }
  catch { return json({ error: "We saved the proof but could not update the booking status. Please contact us on WhatsApp.", status: "awaiting_confirmation" }, 503, headers); }

  let emailStatus = "sent";
  const proofDescription = method === "whatsapp"
    ? "The customer selected WhatsApp and confirmed that they sent proof there."
    : `Transfer sender: ${escapeHtml(senderName || "Not provided")}<br>Transfer time: ${escapeHtml(transferTime || "Not provided")}<br>Receipt file: ${fileMetadata ? `${fileMetadata.contentType}, ${fileMetadata.size} bytes` : "No file attached"}`;
  const message = `We received your booking, and we are verifying your payment. Your status is Awaiting confirmation. We will email you again only after we verify the transfer.\nReference: ${reference}`;
  try {
    if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) throw new Error("Email settings are not configured.");
    await Promise.all([
      sendResend(env, { to: [record.booking.email], subject: `Payment proof received · ${reference}`, text: `Hello ${record.booking.name},\n\n${message}`, html: `<p>Hello ${escapeHtml(record.booking.name)},</p><p>We received your booking, and we are verifying your payment.</p><p>Reference: <strong>${reference}</strong></p><p>Your status is <strong>Awaiting confirmation</strong>. We will email you again only after we verify the transfer.</p>` }),
      sendResend(env, { to: [env.NOTIFY_EMAIL], reply_to: record.booking.email, subject: `Payment proof submitted · ${reference}`, text: `Payment proof submitted for ${reference}.\nClient: ${record.booking.name} <${record.booking.email}>\nMethod: ${method}\nSender: ${senderName || "Not provided"}\nTransfer time: ${transferTime || "Not provided"}\nFile: ${fileMetadata ? `${fileMetadata.contentType}, ${fileMetadata.size} bytes` : "None"}\nRetrieve file via authenticated POST /api/admin/proof with the reference.`, html: `<p>Payment proof submitted for <strong>${reference}</strong>.</p><p>Client: ${escapeHtml(record.booking.name)} &lt;${escapeHtml(record.booking.email)}&gt;</p><p>${proofDescription}</p><p>Current status: <strong>Awaiting confirmation</strong>. Review the transfer in the bank account before using the protected admin status endpoint to confirm it.</p>` }),
    ]);
  } catch (error) {
    emailStatus = "failed";
    console.error("Payment proof saved, but email delivery failed", { reference, error: error instanceof Error ? error.message : "Unknown error" });
  }
  return json({ ok: true, status: record.status, emailStatus, message: "Payment awaiting confirmation" }, 201, headers);
}

function authorizedAdmin(request, env) {
  const secret = typeof env.BOOKING_ADMIN_TOKEN === "string" ? env.BOOKING_ADMIN_TOKEN : "";
  const authorization = request.headers.get("Authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || provided.length !== secret.length) return false;
  let difference = 0;
  for (let index = 0; index < secret.length; index++) difference |= secret.charCodeAt(index) ^ provided.charCodeAt(index);
  return difference === 0;
}

async function updateAdminStatus(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!authorizedAdmin(request, env)) return json({ error: "Admin authorization required." }, 401);
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid status update." }, 400); }
  const reference = typeof input?.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const status = input?.status;
  if (!validReference(reference) || !["confirmed", "cancelled"].includes(status)) return json({ error: "Use a valid reference and status of confirmed or cancelled." }, 400);
  let loaded;
  try { loaded = await loadBooking(reference, env); } catch { return json({ error: "Booking storage is unavailable." }, 503); }
  if (!loaded) return json({ error: "Booking not found." }, 404);
  const { record, idempotencyKey } = loaded;
  if (["confirmed", "cancelled", "expired"].includes(record.status)) return json({ error: `This booking is already ${record.status}.`, status: record.status }, 409);
  if (status === "confirmed" && record.status !== "awaiting_confirmation") return json({ error: "Payment proof must be submitted before confirming this booking.", status: record.status }, 409);
  record.status = status;
  record.updatedAt = new Date().toISOString();
  record.booking.status = status;
  record.response.status = status;
  record.response.booking.status = status;
  try { await saveBooking(reference, idempotencyKey, record, env); }
  catch { return json({ error: "We could not save the status change." }, 503); }

  let emailStatus = "not_sent";
  if (status === "confirmed") {
    try {
      await sendResend(env, {
        to: [record.booking.email],
        subject: `Booking confirmed · ${reference}`,
        text: `Hello ${record.booking.name},\n\nWe verified your transfer. Your booking is confirmed.\nReference: ${reference}\nService: ${record.booking.category} / ${record.booking.service}\n\nThe Apex House team`,
        html: `<p>Hello ${escapeHtml(record.booking.name)},</p><p>We verified your transfer. Your booking is confirmed.</p><p>Reference: <strong>${reference}</strong></p><p>Service: ${escapeHtml(record.booking.category)} / ${escapeHtml(record.booking.service)}</p><p>The Apex House team</p>`,
      });
      emailStatus = "sent";
    } catch (error) {
      emailStatus = "failed";
      console.error("Booking confirmed, but confirmation email delivery failed", { reference, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return json({ ok: true, reference, status, emailStatus });
}

async function getAdminProof(request, env) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  if (!authorizedAdmin(request, env)) return json({ error: "Admin authorization required." }, 401);
  const reference = new URL(request.url).searchParams.get("reference")?.toUpperCase() || "";
  if (!validReference(reference)) return json({ error: "A valid reference is required." }, 400);
  const object = await env.APEX_HOUSE_BOOKINGS.get(`payment-proof:${reference}`);
  if (!object) return json({ error: "No uploaded proof file exists for this reference." }, 404);
  const contentType = object.customMetadata?.contentType || "application/octet-stream";
  return new Response(object.body, { status: 200, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store", "Content-Type": contentType, "Content-Disposition": `attachment; filename="payment-proof-${reference}.${contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}"` } });
}

async function submitBooking(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !originAllowed(origin, env)) return json({ error: "Request origin is not allowed." }, 403);
  const corsHeaders = verificationCorsHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, corsHeaders);
  const idempotencyKey = request.headers.get("Idempotency-Key") || "";
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) return json({ error: "Please retry your booking." }, 400, corsHeaders);
  if (!env.APEX_HOUSE_BOOKINGS) return json({ code: "BOOKING_STORAGE_UNAVAILABLE", error: "Booking storage is temporarily unavailable. Please retry or contact us on WhatsApp." }, 503, corsHeaders);
  let savedRecord;
  try {
    savedRecord = await env.APEX_HOUSE_BOOKINGS.get(`booking:${idempotencyKey}`, { type: "json" });
  } catch (error) {
    console.error("Booking storage read failed", error instanceof Error ? error.message : "Unknown error");
    return json({ code: "BOOKING_STORAGE_UNAVAILABLE", error: "We could not check your saved booking. Please retry or contact us on WhatsApp." }, 503, corsHeaders);
  }
  if (savedRecord?.response) return json(savedRecord.response, 201, corsHeaders);
  const cached = idempotentBookings.get(idempotencyKey);
  if (cached?.expires > Date.now() && cached.status === 0) return json({ error: "Your booking is still being processed. Please retry in a moment." }, 409, corsHeaders);
  if (cached?.expires > Date.now()) return json(cached.body, cached.status, corsHeaders);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!await checkRateLimit(ip, env)) return json({ error: "Too many booking attempts. Please wait a minute and try again." }, 429, corsHeaders);
  let input;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16_384) return json({ error: "Booking details are too large." }, 413, corsHeaders);
    input = JSON.parse(raw);
  } catch { return json({ error: "Please send valid booking details." }, 400, corsHeaders); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Please send valid booking details." }, 400, corsHeaders);
  if (clean(input.website, 100)) return json({ error: "We could not verify this request." }, 400, corsHeaders);
  const token = typeof input.token === "string" ? input.token : "";
  if (!token || token.length > 4096) return json({ error: "Please complete the reCAPTCHA check." }, 400, corsHeaders);
  const captcha = await verifyRecaptchaToken(token, env);
  if (!captcha.success) return json({ code: captcha.code, error: captcha.error }, captcha.status, corsHeaders);

  const booking = {
    name: clean(input.name, 120), email: clean(input.email, 254).toLowerCase(), whatsapp: clean(input.whatsapp, 20),
    country: clean(input.country, 80), countryISO: clean(input.countryISO, 2), serviceId: clean(input.serviceId, 80),
    offerId: clean(input.offerId, 80), mode: clean(input.mode, 20), quantity: Number(input.quantity), extraHours: Number(input.extraHours || 0),
    eventName: clean(input.eventName, 120), eventType: clean(input.eventType, 80), eventDate: clean(input.eventDate, 10),
    eventTime: clean(input.eventTime, 5), alternateDate: clean(input.alternateDate, 10), eventTimezone: clean(input.eventTimezone, 80), venue: clean(input.venue, 200),
    platform: clean(input.platform, 120), audienceSize: clean(input.audienceSize, 10), additionalNotes: clean(input.additionalNotes, 800), brief: clean(input.brief, 1200),
  };
  if (!booking.name || !emailPattern.test(booking.email) || !/^\+234\d{10}$/.test(booking.whatsapp) || booking.countryISO !== "NG" || booking.country !== "Nigeria") return json({ error: "Please check your name, email, WhatsApp number, and country." }, 400, corsHeaders);
  const parsedDate = new Date(`${booking.eventDate}T00:00:00Z`);
  if (!booking.eventName || !booking.eventType || !/^\d{4}-\d{2}-\d{2}$/.test(booking.eventDate) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== booking.eventDate || !/^\d{1,7}$/.test(booking.audienceSize) || Number(booking.audienceSize) < 1 || input.consent !== "true") return json({ error: "Please complete all required booking details." }, 400, corsHeaders);
  if (!['virtual', 'physical'].includes(booking.mode) || (booking.mode === "physical" && !booking.venue)) return json({ error: "Please check your booking mode and venue." }, 400, corsHeaders);
  const quote = calculatePrice(booking.serviceId, booking.mode, booking.offerId, booking.quantity, booking.extraHours);
  if (!quote) return json({ error: "That service or package is unavailable. Please review your selection." }, 400, corsHeaders);
  if (booking.mode === "virtual" && booking.eventTimezone !== "Africa/Lagos") return json({ error: "Please select Nigeria time (WAT) for your virtual event." }, 400, corsHeaders);

  const random = new Uint8Array(12);
  crypto.getRandomValues(random);
  const reference = `APX-${[...random].map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  const whatsappMessage = `Hello Apex House, I have paid for booking ${reference} (${quote.service.name}). My name is ${booking.name}. Receipt attached.`;
  const whatsappUrl = `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(whatsappMessage)}`;
  const complete = bookingFields(booking, quote, reference, reference, whatsappUrl);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString();
  complete.expiresAt = expiresAt;
  const sender = env.RESEND_FROM_EMAIL || env.RESEND_FROM || "The Apex House <bookings@theapexxhouse.com>";
  const clientMessage = { from: sender, to: [booking.email], subject: `Booking received · ${reference}`, html: emailMarkup(complete), text: emailText(complete) };
  const ownerMessage = { from: sender, to: [env.NOTIFY_EMAIL], reply_to: booking.email, subject: `New booking · ${reference} · ${booking.name}`, html: emailMarkup(complete, true), text: emailText(complete, true) };
  const result = { ok: true, reference, amount: quote.amount, amountKnown: complete.amountKnown, service: complete.service, package: complete.package, unit: complete.unit, whatsappUrl, status: "pending_payment", expiresAt, paymentDetails: privatePaymentDetails(), booking: complete, emailStatus: "pending" };
  const bookingRecord = { createdAt, updatedAt: createdAt, expiresAt, status: "pending_payment", booking: complete, response: result };
  try {
    await saveBooking(reference, idempotencyKey, bookingRecord, env);
  } catch (error) {
    console.error("Booking storage write failed", { reference, error: error instanceof Error ? error.message : "Unknown error" });
    return json({ code: "BOOKING_STORAGE_FAILED", error: "We could not save your booking, so payment instructions are not available yet. Please retry or contact us on WhatsApp." }, 503, corsHeaders);
  }

  idempotentBookings.set(idempotencyKey, { body: result, status: 0, expires: Date.now() + 10 * 60_000 });
  const emailConfigMissing = ["RESEND_API_KEY", "NOTIFY_EMAIL"].filter(name => !env[name]);
  if (emailConfigMissing.length) {
    emailStatusFailed(reference, `Missing Worker email configuration: ${emailConfigMissing.join(", ")}`);
  } else {
    const emailResults = await Promise.allSettled([sendResend(env, clientMessage), sendResend(env, ownerMessage)]);
    const failures = emailResults.filter(item => item.status === "rejected");
    if (failures.length) emailStatusFailed(reference, failures.map(item => item.reason instanceof Error ? item.reason.message : "Unknown Resend error"));
    else result.emailStatus = "sent";
  }

  if (result.emailStatus === "pending") result.emailStatus = "failed";
  bookingRecord.response = result;
  try {
    await saveBooking(reference, idempotencyKey, bookingRecord, env);
  } catch (error) {
    console.error("Booking email status could not be saved", { reference, error: error instanceof Error ? error.message : "Unknown error" });
  }
  idempotentBookings.set(idempotencyKey, { body: result, status: 201, expires: Date.now() + 24 * 60 * 60_000 });
  return json(result, 201, corsHeaders);
}

function emailStatusFailed(reference, error) {
  console.error("Booking saved, but confirmation email delivery failed", { reference, error });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/recaptcha/verify") return verifyRecaptcha(request, env);
    if (pathname === "/api/book") return submitBooking(request, env);
    if (pathname === "/api/booking/retrieve") return retrieveBooking(request, env);
    if (pathname === "/api/booking/proof") return submitPaymentProof(request, env);
    if (pathname === "/api/admin/booking/status") return updateAdminStatus(request, env);
    if (pathname === "/api/admin/proof") return getAdminProof(request, env);
    if (pathname.startsWith("/api/")) return json({ error: "API route not found." }, 404);

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    const staticAsset = /\.(?:css|js|mjs|json|svg|png|jpe?g|webp|avif|ico|woff2?)$/i.test(pathname);
    const versionedAsset = staticAsset && url.searchParams.has("v");
    const isHtml = /\.html?$/.test(pathname) || pathname === "/";

    const textMime = isHtml ? "text/html" : /\.css$/i.test(pathname) ? "text/css" : "text/javascript";
    if (isHtml || /\.(?:css|js|mjs)$/i.test(pathname)) {
      const contentType = headers.get("Content-Type") || textMime;
      headers.set("Content-Type", /;\s*charset=/i.test(contentType) ? contentType : `${contentType}; charset=utf-8`);
    }

    if (isHtml) {
      headers.set("Content-Security-Policy", "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self' https:; frame-ancestors 'self'; upgrade-insecure-requests");
      if (["theapexxhouse.com", "www.theapexxhouse.com"].includes(url.hostname)) headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    if (versionedAsset) headers.set("Cache-Control", "public, max-age=31536000, immutable");
    else if (isHtml) headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
