import { supabase, isSupabaseConfigured, normalizeRow, currentUserLabel } from "./supabase-client.js";
import { AUTH_API_URL } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);
const state = { user: null, profile: null, page: "home", chat: [], exams: [] };
let signupMode = false;
let signupRequestInProgress = false;
let requestedProgram = localStorage.getItem("arresalah-program") || "General Qur'an Class";
let toastTimer;
function authRedirectUrl() { return `${window.location.origin}${window.location.pathname}`; }

function toast(text) { const el = $("toast"); el.textContent = text; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800); }
function authMessage(text, good = false) { $("authStatus").textContent = text; $("authStatus").style.color = good ? "#31775c" : "#a33d36"; }
function showVerificationScreen(email, message = "Check your inbox for a verification email with a six-digit code.") {
  $("portal").classList.add("hidden");
  $("authScreen").classList.remove("hidden");
  $("authFormScreen").classList.add("hidden");
  $("passwordRecoveryScreen").classList.add("hidden");
  $("verificationScreen").classList.remove("hidden");
  $("verificationEmail").textContent = email || "your email address";
  $("verificationStatus").textContent = message;
}
function niceError(error) {
  const message = error?.message || "We could not complete that request. Please try again.";
  if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)) return "Could not connect to Supabase. Check your internet connection and the project URL in frontend/supabase-config.js, then try again.";
  if (/invalid login credentials/i.test(message)) return "That email and password do not match.";
  if (/already registered/i.test(message)) return "An account already uses this email. Sign in instead.";
  if (/otp|email link.*(expired|invalid)|token.*(expired|invalid)|invalid.*token/i.test(message)) return "That verification code or link is invalid or expired. Request a new email and try again.";
  if (/password should be at least/i.test(message)) return "Choose a password with at least six characters.";
  if (/email not confirmed/i.test(message)) return "Verify your email, then sign in again.";
  return message;
}
function setAuthMode(signup) {
  signupMode = signup;
  $("studentDetails").classList.toggle("hidden", !signup);
  ["fullName", "studentPhone", "studentCountry", "newProgram", "studentType"].forEach((id) => { $(id).required = signup; });
  $("password").minLength = signup ? 8 : 6; $("password").autocomplete = signup ? "new-password" : "current-password"; $("passwordHint").classList.toggle("hidden", !signup); $("resetPassword").classList.toggle("hidden", signup);
  $("authTitle").textContent = signup ? "Create Your Account" : "Participants Login";
  $("authWelcome").textContent = signup ? "Welcome to Arresalah Institute" : "Welcome";
  $("submitAuth").textContent = signup ? "Create account" : "Login";
  $("createAccountLink").classList.toggle("hidden", signup); $("returnToLogin").classList.toggle("hidden", !signup); $("accountPrompt").textContent = signup ? "Already have an account?" : "New participant?";
  $("password").autocomplete = signup ? "new-password" : "current-password"; authMessage("");
}

$("createAccountLink").addEventListener("click", () => setAuthMode(true));
$("returnToLogin").addEventListener("click", () => setAuthMode(false));
function selectGender(gender) {
  if (!["female", "male"].includes(gender)) return;
  $("studentGender").value = gender;
  $("genderError").textContent = "";
  document.querySelectorAll("[data-gender]").forEach((button) => {
    const selected = button.dataset.gender === gender;
    button.setAttribute("aria-checked", String(selected));
    button.classList.toggle("selected", selected);
  });
}
document.querySelectorAll("[data-gender]").forEach((button) => button.addEventListener("click", () => selectGender(button.dataset.gender)));
document.querySelector('[role="radiogroup"]').addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const choices = [...document.querySelectorAll("[data-gender]")];
  const current = choices.findIndex((choice) => choice.dataset.gender === $("studentGender").value);
  const next = choices[(current + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? choices.length - 1 : 1)) % choices.length];
  selectGender(next.dataset.gender); next.focus();
});
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault(); authMessage("");
  if (!supabase) return authMessage("Supabase is not configured yet. Add the project URL and anon key in frontend/supabase-config.js.");
  try {
    const email = $("email").value.trim();
    if (signupMode) {
      if (!["female", "male"].includes($("studentGender").value)) { $("genderError").textContent = "Choose Female or Male to continue."; document.querySelector("[data-gender]").focus(); return; }
      const password = $("password").value;
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) throw new Error("Use 8 or more characters with uppercase and lowercase letters, a number, and a symbol.");
      const details = { name: $("fullName").value.trim(), phone: $("studentPhone").value.trim(), gender: $("studentGender").value, country: $("studentCountry").value.trim(), program: $("newProgram").value, student_type: $("studentType").value };
      requestedProgram = details.program; localStorage.setItem("arresalah-program", requestedProgram); localStorage.setItem("arresalah-student-details", JSON.stringify(details));
      localStorage.setItem("arresalah-pending-auth-flow", "signup");
      localStorage.setItem("arresalah-pending-email", email);
      signupRequestInProgress = true;
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: details.name, ...details }, emailRedirectTo: authRedirectUrl() } });
      signupRequestInProgress = false;
      if (error) throw error;
      if (!data.user) throw new Error("Supabase did not return a new account. Check the email address and try again.");
      if (data.session && (data.user.email_confirmed_at || data.user.confirmed_at)) {
        localStorage.removeItem("arresalah-pending-auth-flow");
        await enterPortal(data.user);
      } else if (data.session) {
        showVerificationScreen(email, "Supabase returned an active session, so it may not be requiring email confirmation. If no code arrives, enable email confirmations in Supabase Authentication settings.");
      } else {
        showVerificationScreen(email);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: $("password").value });
      if (error) throw error;
    }
  } catch (error) {
    signupRequestInProgress = false;
    if (signupMode) {
      localStorage.removeItem("arresalah-pending-auth-flow");
      localStorage.removeItem("arresalah-pending-email");
      $("verificationScreen").classList.add("hidden");
      $("portal").classList.add("hidden");
      $("authScreen").classList.remove("hidden");
      $("authFormScreen").classList.remove("hidden");
    }
    authMessage(niceError(error));
  }
});

$("resetPassword").addEventListener("click", async () => {
  if (!supabase) return authMessage("Connect this portal to Supabase in frontend/supabase-config.js first.");
  const email = $("email").value.trim();
  if (!email) { authMessage("Enter your email first, then request a password reset."); $("email").focus(); return; }
  const button = $("resetPassword");
  button.disabled = true;
  try {
    const apiBase = AUTH_API_URL.replace(/\/$/, "");
    const response = await fetch(`${apiBase}/api/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo: authRedirectUrl() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 405) throw new Error("The password reset API did not accept POST. Make sure backend/server.js is running at http://localhost:3000.");
      throw new Error(result.message || `Password reset request failed (HTTP ${response.status}). Check that the backend is running and its CORS origins include this page.`);
    }
    localStorage.setItem("arresalah-pending-auth-flow", "recovery");
    authMessage(result.message || "If an account uses this email, a password reset link has been sent. Check your inbox and spam folder.", true);
  } catch (error) {
    const message = error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error.message || "")
      ? `Cannot reach the password reset API at ${AUTH_API_URL || window.location.origin}. Start the backend on port 3000 and confirm AUTH_API_URL and CORS settings.`
      : error.message || "We could not send the reset email. Please try again later.";
    authMessage(message);
  } finally {
    button.disabled = false;
  }
});
$("emailVerificationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return $("verificationStatus").textContent = "Supabase is not configured yet.";
  const email = $("verificationEmail").textContent.trim() || localStorage.getItem("arresalah-pending-email") || "";
  const token = $("verificationCode").value.trim();
  if (!email) { $("verificationStatus").textContent = "Return to sign up and enter your email address."; return; }
  if (!/^\d{6}$/.test(token)) { $("verificationStatus").textContent = "Enter the six-digit code from your verification email."; $("verificationCode").focus(); return; }
  const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = "Verifying…";
  try {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  if (error) $("verificationStatus").textContent = niceError(error);
  else if (data.user) { localStorage.removeItem("arresalah-pending-auth-flow"); $("verificationStatus").textContent = "Email verified. Opening your student portal…"; }
  } catch (error) { $("verificationStatus").textContent = niceError(error); }
  finally { button.disabled = false; button.textContent = "Verify code"; }
});
$("passwordRecoveryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test($("newPassword").value)) {
    $("passwordRecoveryStatus").textContent = "Use 8 or more characters with uppercase and lowercase letters, a number, and a symbol."; return;
  }
  const { error } = await supabase.auth.updateUser({ password: $("newPassword").value });
  if (error) { $("passwordRecoveryStatus").textContent = niceError(error); return; }
  localStorage.removeItem("arresalah-pending-auth-flow");
  $("passwordRecoveryStatus").textContent = "Password updated. Your student portal is ready.";
  const { data } = await supabase.auth.getUser(); if (data.user) enterPortal(data.user);
});

$("checkVerification").addEventListener("click", async () => {
  if (!supabase) return $("verificationStatus").textContent = "Connect this portal to Supabase in frontend/supabase-config.js first.";
  const { data } = await supabase.auth.getUser();
  if (data.user?.email_confirmed_at || data.user?.confirmed_at) { $("verificationScreen").classList.add("hidden"); return enterPortal(data.user); }
  $("verificationScreen").classList.add("hidden"); $("authScreen").classList.remove("hidden"); $("authFormScreen").classList.remove("hidden"); setAuthMode(false);
  authMessage("After opening the confirmation link, sign in here to continue.", true);
});
$("resendVerification").addEventListener("click", async () => {
  if (!supabase) return $("verificationStatus").textContent = "Connect this portal to Supabase in frontend/supabase-config.js first.";
  const email = localStorage.getItem("arresalah-pending-email") || $("email").value.trim();
  if (!email) { $("verificationStatus").textContent = "Enter your email address on the sign-in screen first."; return; }
  const button = $("resendVerification"); button.disabled = true;
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: authRedirectUrl() } });
    if (error) throw error;
    localStorage.setItem("arresalah-pending-auth-flow", "signup");
    $("verificationStatus").textContent = "Another confirmation email has been sent. Check your inbox and spam folder.";
  } catch (error) { $("verificationStatus").textContent = niceError(error); }
  finally { button.disabled = false; }
});
$("verificationSignout").addEventListener("click", async () => { await supabase?.auth.signOut(); $("verificationScreen").classList.add("hidden"); $("authScreen").classList.remove("hidden"); $("authFormScreen").classList.remove("hidden"); });

function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function switchPage(name) {
  state.page = name; document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${name}`));
  document.querySelectorAll(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.page === name));
  const titles = { home: "Overview", materials: "Class materials", exams: "Exams", assistant: "Study assistant", grades: "Grades & feedback", reviews: "Student reviews", profile: "My profile" };
  $("topTitle").textContent = titles[name] || "Student portal"; $("sidebar").classList.remove("open");
  if (name === "assistant") $("chatInput").focus();
}
document.querySelectorAll(".nav-btn").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.page)));
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("signout").addEventListener("click", () => supabase.auth.signOut());
$("saveProfile").addEventListener("click", saveProfile);
$("profilePhoto").addEventListener("change", uploadProfilePhoto);

async function ensureProfile(user) {
  const { data: row, error } = await supabase.from("student_profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  const details = JSON.parse(localStorage.getItem("arresalah-student-details") || "{}");
  const name = row?.name || details.name || user.user_metadata?.full_name || currentUserLabel(user);
  const program = row?.program || details.program || user.user_metadata?.program || localStorage.getItem("arresalah-program") || requestedProgram;
  if (!row) {
    const { data, error: insertError } = await supabase.from("student_profiles").insert({ id: user.id, email: user.email, name, phone: details.phone || user.user_metadata?.phone, gender: details.gender || user.user_metadata?.gender, country: details.country || user.user_metadata?.country, student_type: details.student_type || user.user_metadata?.student_type, program }).select().single();
    if (insertError) throw insertError;
    localStorage.removeItem("arresalah-program"); localStorage.removeItem("arresalah-student-details"); return normalizeRow(data);
  }
  return normalizeRow(row);
}

async function enterPortal(user) {
  if (user.email && !user.email_confirmed_at && !user.confirmed_at && user.app_metadata?.provider !== "google") {
    showVerificationScreen(user.email); return;
  }
  state.user = user; $("authScreen").classList.add("hidden"); $("verificationScreen").classList.add("hidden"); $("portal").classList.remove("hidden");
  localStorage.removeItem("arresalah-pending-auth-flow");
  $("accountEmail").textContent = user.email || "";
  try { state.profile = await ensureProfile(user); showProfile(); await Promise.all([loadMaterials(), loadExams(), loadGrades(), loadReviews()]); subscribeReviews(); }
  catch (error) { toast("Your class information could not be loaded. Please contact the institute."); console.error("Student portal setup failed", error); }
}

if (!isSupabaseConfigured) authMessage("Connect this portal to Supabase by adding its project URL and anon key in frontend/supabase-config.js.");
else supabase.auth.onAuthStateChange((event, session) => {
  const signupEventHandledBySubmit = signupRequestInProgress && Boolean(session?.user);
  setTimeout(() => {
    if (signupEventHandledBySubmit) return;
    if (event === "PASSWORD_RECOVERY") {
      $("authScreen").classList.remove("hidden"); $("authFormScreen").classList.add("hidden"); $("verificationScreen").classList.add("hidden"); $("passwordRecoveryScreen").classList.remove("hidden");
    } else if (session?.user && localStorage.getItem("arresalah-pending-auth-flow") === "signup" && !session.user.email_confirmed_at && !session.user.confirmed_at) {
      showVerificationScreen(session.user.email || localStorage.getItem("arresalah-pending-email"), "Your account was created. Check your email for the six-digit verification code.");
    } else if (session?.user) {
      $("passwordRecoveryScreen").classList.add("hidden"); enterPortal(session.user);
    }
    else {
      state.user = null; $("portal").classList.add("hidden");
      const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`);
      const authError = params.get("error_description") || params.get("error_code");
      if (authError) {
        if (params.get("type") === "recovery" || localStorage.getItem("arresalah-pending-auth-flow") === "recovery") { localStorage.removeItem("arresalah-pending-auth-flow"); $("passwordRecoveryScreen").classList.add("hidden"); $("authScreen").classList.remove("hidden"); $("authFormScreen").classList.remove("hidden"); authMessage("That password reset link is invalid or expired. Request a new one using your email address."); }
        else if (!$("verificationScreen").classList.contains("hidden") || params.get("type") === "signup" || localStorage.getItem("arresalah-pending-auth-flow") === "signup") { $("authScreen").classList.remove("hidden"); $("authFormScreen").classList.add("hidden"); $("verificationScreen").classList.remove("hidden"); $("verificationEmail").textContent = localStorage.getItem("arresalah-pending-email") || "your email address"; $("verificationStatus").textContent = "That verification link is invalid or expired. Request a new code or link."; }
        else { $("authScreen").classList.remove("hidden"); $("authFormScreen").classList.remove("hidden"); authMessage("That verification link is invalid or expired. Request a new one and try again."); }
        window.history.replaceState({}, document.title, authRedirectUrl()); return;
      }
      if (!$("verificationScreen").classList.contains("hidden")) return;
      $("authScreen").classList.remove("hidden");
      $("authFormScreen").classList.remove("hidden");
    }
  }, 0);
});

function showProfile() {
  const name = state.profile?.name || currentUserLabel(state.user);
  $("accountName").textContent = name; $("avatar").textContent = name.trim().charAt(0).toUpperCase() || "S";
  if (state.profile?.profilePhotoPath) {
    supabase.storage.from("profile-photos").createSignedUrl(state.profile.profilePhotoPath, 3600).then(({ data }) => {
      if (data?.signedUrl) { const image = `<img src="${escapeHtml(data.signedUrl)}" alt="">`; $("avatar").innerHTML = image; $("profilePhotoPreview").innerHTML = image; }
    });
  } else $("profilePhotoPreview").textContent = "No picture uploaded yet.";
  $("welcomeName").textContent = name.trim() || "Student"; $("topWelcomeName").textContent = name.trim() || "Student"; $("profileName").value = name;
  $("profileEmail").value = state.user?.email || ""; $("profileProgram").value = state.profile?.program || "General Qur'an Class";
  if ($("profileStudentId")) $("profileStudentId").value = state.profile?.studentId || "Assigned after account setup";
}

async function saveProfile() {
  const name = $("profileName").value.trim(); if (!name) { toast("Please enter your name."); $("profileName").focus(); return; }
  const { error } = await supabase.from("student_profiles").update({ name, updated_at: new Date().toISOString() }).eq("id", state.user.id);
  if (error) return toast("We could not save your profile.");
  state.profile = { ...state.profile, name }; showProfile(); toast("Profile saved");
}

async function uploadProfilePhoto(event) {
  const file = event.currentTarget.files?.[0]; if (!file || !state.user) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { toast("Choose a JPG, PNG, or WebP image under 5 MB."); event.currentTarget.value = ""; return; }
  const path = `${state.user.id}/profile-${Date.now()}.${file.type.split("/")[1]}`;
  const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return toast("The picture could not be uploaded. Check the Supabase storage policies.");
  const { error } = await supabase.from("student_profiles").update({ profile_photo_path: path, updated_at: new Date().toISOString() }).eq("id", state.user.id);
  if (error) return toast("Picture uploaded, but the profile could not be updated.");
  state.profile = { ...state.profile, profilePhotoPath: path }; showProfile(); toast("Profile picture updated");
}

function emptyCard(title, copy) { return `<div class="card empty"><strong>${escapeHtml(title)}</strong>${escapeHtml(copy)}</div>`; }
function materialMarkup(item) {
  const kind = escapeHtml((item.type || "resource").toUpperCase());
  const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : "Recently shared";
  let safeLink = ""; try { const parsed = new URL(item.url); if (parsed.protocol === "https:") safeLink = parsed.href; } catch {}
  const link = item.storagePath ? `<button class="link" data-resource-path="${escapeHtml(item.storagePath)}" type="button">Open resource ↗</button>` : (safeLink ? `<a class="resource-link" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">Open resource ↗</a>` : "");
  return `<article class="card item"><div class="item-icon">${kind.slice(0, 1)}</div><div style="min-width:0;flex:1"><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.teacherName || "Your teacher")} · ${escapeHtml(date)}${item.note ? `<br>${escapeHtml(item.note)}` : ""}</div>${link}</div><span class="badge">${kind}</span></article>`;
}

async function loadMaterials() {
  const { data, error } = await supabase.from("materials").select("*").eq("class_name", state.profile.program).eq("published", true).order("created_at", { ascending: false });
  if (error) throw error;
  const items = data.map(normalizeRow); const markup = items.length ? items.map(materialMarkup).join("") : emptyCard("Nothing shared just yet", "Your teacher's class materials will appear here when they publish them.");
  $("materialsList").innerHTML = markup; $("homeMaterials").innerHTML = items.length ? items.slice(0, 3).map(materialMarkup).join("") : emptyCard("Waiting for your teacher", "New lesson materials will show up here.");
  document.querySelectorAll("[data-resource-path]").forEach((button) => button.addEventListener("click", async () => {
    const tab = window.open("about:blank", "_blank");
    const { data: link, error: linkError } = await supabase.storage.from("class-materials").createSignedUrl(button.dataset.resourcePath, 300);
    if (linkError || !link?.signedUrl) { if (tab) tab.close(); toast("This resource could not be opened. Please ask your teacher to share it again."); return; }
    if (tab) { tab.opener = null; tab.location = link.signedUrl; }
  }));
}

function examMarkup(item) {
  const closes = item.closesAt?.toDate ? `Closes ${item.closesAt.toDate().toLocaleDateString()}` : "Set by your teacher";
  return `<article class="card item"><div class="item-icon">☷</div><div style="min-width:0;flex:1"><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.className)} · ${Number(item.durationMinutes) || 0} minutes · ${escapeHtml(closes)}</div></div><button class="btn btn-primary" data-exam="${escapeHtml(item.id)}" style="width:auto;padding:9px 13px">Start</button></article>`;
}
async function loadExams() {
  const { data, error } = await supabase.from("exams").select("*").eq("class_name", state.profile.program).eq("published", true).order("created_at", { ascending: false });
  if (error) throw error;
  state.exams = data.map(normalizeRow).filter((item) => !item.closesAt?.toDate || item.closesAt.toDate() > new Date());
  const markup = state.exams.length ? state.exams.map(examMarkup).join("") : emptyCard("No exams are open", "Your teachers will post assessments here when they are ready.");
  $("examsList").innerHTML = markup; $("homeExams").innerHTML = state.exams.length ? state.exams.slice(0, 3).map(examMarkup).join("") : emptyCard("No upcoming exams", "Your teachers will add assessments here.");
  document.querySelectorAll("[data-exam]").forEach((button) => button.addEventListener("click", () => startExam(button.dataset.exam)));
}

function startExam(id) {
  const exam = state.exams.find((item) => item.id === id); if (!exam) return;
  const questions = Array.isArray(exam.questions) ? exam.questions : []; if (!questions.length) return toast("Your teacher has not added questions to this exam yet.");
  $("examRunner").classList.remove("hidden");
  $("examRunner").innerHTML = `<h2 class="section-heading">${escapeHtml(exam.title)}</h2><p class="section-copy">Confirm your details before beginning. The timer starts when you continue.</p><form id="examStartForm"><div class="field"><label for="examStudentName">Student name</label><input id="examStudentName" value="${escapeHtml(state.profile.name)}" required maxlength="100"></div><div class="field"><label for="examStudentId">Student ID</label><input id="examStudentId" required maxlength="40" placeholder="${escapeHtml(state.profile.studentId || "Your institute ID")}"></div><button class="btn btn-primary" type="submit" style="width:auto">Begin timed exam</button></form>`;
  $("examStartForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("examStudentId").value.trim().toUpperCase() !== String(state.profile.studentId || "").toUpperCase()) return toast("The Student ID does not match your profile.");
    const startedAt = Date.now(); const deadline = startedAt + Number(exam.durationMinutes) * 60 * 1000; let submitting = false;
    const questionMarkup = questions.map((question, index) => `<div class="exam-question"><strong>${index + 1}. ${escapeHtml(question.prompt)}</strong>${(question.type || "objective") === "objective" ? (question.options || []).map((option, optionIndex) => `<label class="option"><input type="radio" name="q${index}" value="${optionIndex}" required><span>${escapeHtml(option)}</span></label>`).join("") : `<label class="field"><span>Your answer</span><textarea name="q${index}" required maxlength="4000" rows="4" placeholder="Write your answer"></textarea></label>`}</div>`).join("");
    $("examRunner").innerHTML = `<h2 class="section-heading">${escapeHtml(exam.title)}</h2><p class="section-copy">Remaining time: <strong id="examClock"></strong> · Keep this page open. Leaving the exam page submits it automatically.</p><form id="examForm">${questionMarkup}<button class="btn btn-primary" type="submit" style="width:auto">Submit answers</button></form>`;
    $("examForm").addEventListener("copy", (copyEvent) => copyEvent.preventDefault());
    $("examForm").addEventListener("cut", (cutEvent) => cutEvent.preventDefault());
    $("examForm").addEventListener("paste", (pasteEvent) => pasteEvent.preventDefault());
    $("examForm").addEventListener("contextmenu", (contextEvent) => contextEvent.preventDefault());
    $("examForm").addEventListener("keydown", (keyEvent) => { if ((keyEvent.ctrlKey || keyEvent.metaKey) && ["c", "x", "v", "u"].includes(keyEvent.key.toLowerCase())) keyEvent.preventDefault(); });
    const timer = setInterval(() => { const remaining = Math.max(0, deadline - Date.now()); $("examClock").textContent = `${Math.floor(remaining / 60000)}:${String(Math.floor(remaining % 60000 / 1000)).padStart(2, "0")}`; if (!remaining) submitExam(true); }, 500);
    const submitExam = async (timeout = false) => {
      if (submitting) return; submitting = true; clearInterval(timer);
      const form = $("examForm"); const answers = questions.map((question, index) => { const value = new FormData(form).get(`q${index}`); return (question.type || "objective") === "objective" ? (value == null ? null : Number(value)) : String(value || "").trim(); });
      if (!timeout && form.reportValidity() === false) { submitting = false; return; }
      const { data: existing } = await supabase.from("exam_submissions").select("id").eq("student_uid", state.user.id).eq("exam_id", exam.id).maybeSingle();
      if (existing) { $("examRunner").innerHTML = emptyCard("This exam was already submitted", "Your teacher has received your answers."); return; }
      const { error } = await supabase.from("exam_submissions").insert({ exam_id: exam.id, teacher_uid: exam.teacherUid, student_uid: state.user.id, student_id: state.profile.studentId, student_name: state.profile.name, answers, status: "submitted" });
      if (error) { submitting = false; toast("We could not submit your answers. Please try again."); return; }
      $("examRunner").innerHTML = emptyCard(timeout ? "Time is up" : "Answers submitted", "Your teacher has received your work. Your result will appear when the teacher releases it."); toast("Exam submitted to your teacher");
    };
    $("examForm").addEventListener("submit", (submitEvent) => { submitEvent.preventDefault(); submitExam(false); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) submitExam(true); }, { once: true });
    window.addEventListener("blur", () => submitExam(true), { once: true });
  });
  $("examRunner").scrollIntoView({ behavior: "smooth", block: "start" });
  $("examForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const answers = questions.map((_, index) => Number(new FormData(event.currentTarget).get(`q${index}`)));
    const { data: existing } = await supabase.from("exam_submissions").select("id").eq("student_uid", state.user.id).eq("exam_id", exam.id).maybeSingle();
    if (existing) { $("examRunner").innerHTML = emptyCard("This exam was already submitted", "Your teacher has received your answers."); return; }
    const { error } = await supabase.from("exam_submissions").insert({ exam_id: exam.id, teacher_uid: exam.teacherUid, student_uid: state.user.id, student_name: state.profile.name, answers, status: "submitted" });
    if (error) { toast(error.message?.includes("duplicate") ? "This exam was already submitted." : "We could not submit your answers. Please try again."); return; }
    $("examRunner").innerHTML = emptyCard("Answers submitted", "Your teacher has received your work."); toast("Exam submitted to your teacher");
  }, { once: true });
}

function assistantMarkup(text) { return escapeHtml(text).split("\n").map((line) => { const safe = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>"); return /^[-*] /.test(safe) ? `<div class="answer-list-line">• ${safe.slice(2)}</div>` : safe; }).join("<br>"); }
function addChatMessage(role, content) {
  $("welcomeAi").classList.add("hidden"); const node = document.createElement("div"); node.className = role === "user" ? "message user" : "message assistant";
  if (role === "assistant") node.innerHTML = '<span class="assistant-mark">✦</span><div class="message-body"></div>';
  if (role === "user") node.textContent = content; else node.querySelector(".message-body").innerHTML = assistantMarkup(content);
  $("chatLog").append(node); $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
async function sendChat(text) {
  const prompt = (text || $("chatInput").value).trim(); if (!prompt || !state.user) return;
  $("chatInput").value = ""; $("suggestions").classList.add("hidden"); state.chat.push({ role: "user", content: prompt }); addChatMessage("user", prompt);
  const pending = document.createElement("div"); pending.className = "message assistant"; pending.textContent = "Thinking…"; $("chatLog").append(pending); $("sendChat").disabled = true;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/study-assistant", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` }, body: JSON.stringify({ messages: state.chat.slice(-12), className: state.profile?.program || "Qur'an studies" }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "The assistant is unavailable right now.");
    state.chat.push({ role: "assistant", content: result.reply }); pending.remove(); addChatMessage("assistant", result.reply);
  } catch (error) { pending.remove(); const message = error.message === "Failed to fetch" ? "I couldn't reach the study assistant. Please try again in a moment." : error.message; state.chat.push({ role: "assistant", content: message }); addChatMessage("assistant", message); }
  finally { $("sendChat").disabled = false; $("chatInput").focus(); }
}
$("chatForm").addEventListener("submit", (event) => { event.preventDefault(); sendChat(); });
$("chatInput").addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); } event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 130)}px`; });
document.querySelectorAll(".suggestions button").forEach((button) => button.addEventListener("click", () => sendChat(button.textContent)));

document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => {
  const input = $(button.dataset.togglePassword); input.type = input.type === "password" ? "text" : "password";
  button.textContent = input.type === "password" ? "Show" : "Hide";
}));

async function loadGrades() {
  const { data, error } = await supabase.from("exam_submissions").select("*").eq("student_uid", state.user.id).order("submitted_at", { ascending: false });
  if (error) throw error;
  if (!data.length) { $("gradesList").innerHTML = emptyCard("No exam marks yet", "Your marks appear here after you submit an exam."); return; }
  const ids = [...new Set(data.map((item) => item.exam_id))];
  const { data: exams } = await supabase.from("exams").select("id,title,teacher_name,results_released").in("id", ids);
  const byId = Object.fromEntries((exams || []).map((exam) => [exam.id, exam]));
  const released = data.filter((item) => byId[item.exam_id]?.results_released);
  const unreleasedCount = data.length - released.length;
  const cards = await Promise.all(released.map(async (item) => {
    const exam = byId[item.exam_id] || {};
    const { data: ranking } = await supabase.rpc("released_exam_ranking", { requested_exam: item.exam_id });
    const mine = (ranking || []).find((row) => row.student_id === state.profile.studentId);
    const teacher = item.teacher_score == null ? "Teacher review not required" : `Teacher mark: ${item.teacher_score} / ${item.max_score}`;
    return `<article class="card card-pad"><h2 class="section-heading">${escapeHtml(exam.title || "Exam")}</h2><p class="section-copy">Released score: <strong>${Number(item.teacher_score ?? item.auto_score)} / ${Number(item.max_score)}</strong><br>${escapeHtml(teacher)}${item.graded_by_name ? ` · Marked by ${escapeHtml(item.graded_by_name)}` : ""}<br>Class rank: <strong>${mine ? `${Number(mine.class_rank)}${ordinal(Number(mine.class_rank))}` : "Unavailable"}</strong> of ${(ranking || []).length}</p>${item.teacher_feedback ? `<p>${escapeHtml(item.teacher_feedback)}</p>` : ""}</article>`;
  }));
  $("gradesList").innerHTML = `${cards.join("")}${unreleasedCount ? emptyCard("Results pending", `${unreleasedCount} result${unreleasedCount === 1 ? " is" : "s are"} waiting for teacher release.`) : ""}` || emptyCard("No released results yet", "Your marks and class ranking appear here when your teacher releases them.");
}
function ordinal(value) { return value % 100 >= 11 && value % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th"); }

async function loadReviews() {
  const { data, error } = await supabase.from("student_reviews").select("student_name,rating,comment,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  $("studentReviews").innerHTML = data.length ? data.map((review) => `<article class="card review-card"><div class="review-stars">${"★".repeat(review.rating)}${"☆".repeat(5-review.rating)}</div><strong>${escapeHtml(review.student_name)}</strong><p>${escapeHtml(review.comment)}</p></article>`).join("") : emptyCard("No reviews yet", "Student reviews will appear here.");
}
$("reviewForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error } = await supabase.from("student_reviews").upsert({ student_uid: state.user.id, student_name: state.profile.name, rating: Number(document.querySelector('input[name="rating"]:checked')?.value), comment: $("reviewComment").value.trim(), updated_at: new Date().toISOString() }, { onConflict: "student_uid" });
  $("reviewStatus").textContent = error ? "Your review could not be saved. Please try again." : "Thank you. Your review is now live.";
  if (!error) { await loadReviews(); }
});
let reviewChannel;
function subscribeReviews() {
  if (reviewChannel) supabase.removeChannel(reviewChannel);
  reviewChannel = supabase.channel("student-reviews-live").on("postgres_changes", { event: "*", schema: "public", table: "student_reviews" }, loadReviews).subscribe();
}
