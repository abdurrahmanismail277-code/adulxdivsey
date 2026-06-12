const AUTH_API_BASE =
  window.AUTH_API_BASE ||
  (window.location.protocol === "file:" ? "http://localhost:3000/api/auth" : "/api/auth");

async function sendAuthRequest(path, payload) {
  try {
    const res = await fetch(`${AUTH_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success !== false,
      msg: data.msg || data.message || (res.ok ? "Success." : "Request failed."),
      user: data.user
    };
  } catch (err) {
    return {
      success: false,
      msg: "Backend is not reachable. Start the server and try again."
    };
  }
}

function registerUser(username, email, password) {
  return sendAuthRequest("/register", { username, email, password });
}

function loginUser(email, password) {
  return sendAuthRequest("/login", { email, password });
}

document.addEventListener("DOMContentLoaded", () => {
  const registerButton = document.getElementById("createAccountBtn");
  if (!registerButton) return;

  registerButton.addEventListener("click", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const message = document.getElementById("message");

    const result = await registerUser(username, email, password);
    message.textContent = result.msg;

    if (result.success) {
      window.location.href = "login.html";
    }
  });
});
