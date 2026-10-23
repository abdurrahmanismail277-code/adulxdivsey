async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY || "0x4AAAAAAFhH8zpbpUJDua5MBzVXSCCnHH0";

  if (!secret) {
    return { ok: false, status: 503, message: "Verification is temporarily unavailable. Please try again later." };
  }
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, status: 400, message: "Please complete the security check and try again." };
  }

  const body = new URLSearchParams({ secret, response: token.trim() });
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.success === true) return { ok: true };
    return { ok: false, status: 403, message: "The security check could not be verified. Please try again." };
  } catch (error) {
    console.error("[turnstile] Verification request failed:", error.message);
    return { ok: false, status: 503, message: "Security verification is temporarily unavailable. Please try again." };
  }
}

module.exports = { verifyTurnstile };
