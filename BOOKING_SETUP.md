# Booking and payment flow

The booking page sends the reviewed booking to the `apex-house-site` Cloudflare Worker. The Worker verifies reCAPTCHA, recalculates the price, creates a cryptographically random reference, and stores the booking in the `APEX_HOUSE_BOOKINGS` KV namespace. The browser receives bank details only after the Worker accepts the booking. Booking records, reference indexes, and uploaded proof files expire from KV after 90 days.

## Required Worker configuration

The root `wrangler.toml` binds `APEX_HOUSE_BOOKINGS`. Configure these Worker variables/secrets in Cloudflare:

- `RECAPTCHA_SECRET_KEY` — secret for the v2 checkbox site key configured in `assets/js/booking.js`.
- `RESEND_API_KEY` — Resend API key.
- `RESEND_FROM_EMAIL` (or `RESEND_FROM`) — verified sender address in Resend.
- `NOTIFY_EMAIL` — owner notification recipient.
- `BOOKING_ADMIN_TOKEN` — long, random bearer token used only by authorized staff for payment status changes and proof retrieval.

Set the admin token as a Worker secret, never in the repository or browser code:

```powershell
npx wrangler secret put BOOKING_ADMIN_TOKEN
```

Use a password manager to generate/store a high entropy token and share it only with staff who verify bank transfers. The Worker API accepts it in the `Authorization: Bearer <token>` header.

In Google reCAPTCHA Admin Console, confirm the public site key and `RECAPTCHA_SECRET_KEY` belong to the same v2 checkbox key pair and allow `theapexxhouse.com` and `www.theapexxhouse.com`.

## Payment lifecycle

1. A successful booking starts as `pending_payment` and has a 24-hour payment window. This is a booking request, not a confirmed booking.
2. The customer submits a receipt (JPEG, PNG, WebP, or PDF up to 4 MB) or says they sent it on WhatsApp. The Worker marks it `awaiting_confirmation`; this does not confirm payment.
3. Staff must verify the transfer in the bank account before changing status to `confirmed`. Confirmation sends the customer a confirmation email. Staff can also set `cancelled`.
4. A pending booking changes to `expired` when retrieved or submitted after the payment deadline. No background scheduler is required.

Payment proof files are stored as private KV values and can only be retrieved with the admin token. They are not placed in a public asset folder. Staff can retrieve an uploaded file with:

```powershell
$headers = @{ Authorization = "Bearer $env:BOOKING_ADMIN_TOKEN" }
Invoke-WebRequest -Headers $headers -Uri "https://theapexxhouse.com/api/admin/proof?reference=APX-REFERENCE" -OutFile "payment-proof.pdf"
```

After reviewing the transfer, staff can confirm the booking:

```powershell
$headers = @{ Authorization = "Bearer $env:BOOKING_ADMIN_TOKEN" }
$body = @{ reference = "APX-REFERENCE"; status = "confirmed" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Body $body -Uri "https://theapexxhouse.com/api/admin/booking/status"
```

Use `"cancelled"` for the status if the booking should be cancelled. Confirmation is accepted only after proof reaches `awaiting_confirmation`. Protect the token and downloaded receipts, and delete local receipt downloads after review.

## Security and operations notes

- The Worker remains the authority for prices, references, account details, booking status, and confirmation. The client does not store booking form PII in local storage; it keeps only the reference and current step in session storage so the customer can recover the booking with their email.
- Retrieval and proof submission require the high-entropy reference and matching email, and have a Worker rate limit. The configured optional `BOOKING_LIMITER` binding is used when available; otherwise the Worker falls back to a per-isolate in-memory limit, which is not a global production rate limiter.
- A Resend failure does not discard a saved booking. The page reports the email issue, and staff can still verify the booking in KV.
- For fixed-price virtual services, the server supplies the exact amount. Physical services and Launch Hosting require staff to confirm a final quote before transfer.
- If an online payment gateway is added later, only a verified, signed server webhook should mark a booking paid; never trust a browser success redirect.
