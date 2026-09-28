import { supabase, isSupabaseConfigured, normalizeRow, isAdmin, currentUserLabel } from "./supabase-client.js";

const $ = (id) => document.getElementById(id);
let toastTimer; let datasets = { materials: [], exams: [], submissions: [] };
function escapeHtml(text = "") { return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function toast(text) { $("toast").textContent = text; $("toast").classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600); }
function status(text) { $("authStatus").textContent = text; }

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault(); status("");
  if (!supabase) return status("Connect this portal to Supabase in frontend/supabase-config.js first.");
  const { error } = await supabase.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  if (error) status(error.message || "Sign-in failed. Check your details and try again.");
});
$("signout").addEventListener("click", () => supabase?.auth.signOut());

async function activateAdmin(user) {
  if (!isAdmin(user)) {
    await supabase.auth.signOut(); $("authScreen").classList.remove("hidden"); $("adminApp").classList.add("hidden"); status("This account has not been approved for administrator access."); return;
  }
  const { data: savedProfile, error: profileError } = await supabase.from("admin_profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileError) { status("Run the updated Supabase schema to enable the administrator profile."); return; }
  if (!savedProfile) {
    $("authScreen").classList.add("hidden"); $("adminApp").classList.add("hidden"); $("adminProfileSetup").classList.remove("hidden");
    $("adminProfileName").value = user.user_metadata?.full_name || user.user_metadata?.name || ""; return;
  }
  const displayName = savedProfile.name || currentUserLabel(user); $("adminName").textContent = displayName; $("adminEmail").textContent = user.email || ""; $("welcomeName").textContent = displayName;
  $("authScreen").classList.add("hidden"); $("adminProfileSetup").classList.add("hidden"); $("adminApp").classList.remove("hidden"); await loadWorkspace();
}
$("adminProfileForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const { data: sessionData } = await supabase.auth.getSession(); const user = sessionData.session?.user;
  if (!user) return;
  const values = { id: user.id, name: $("adminProfileName").value.trim(), gender: $("adminGender").value, updated_at: new Date().toISOString() };
  if (!values.name || !values.gender) return $("adminProfileStatus").textContent = "Enter your name and choose your gender.";
  const { error } = await supabase.from("admin_profiles").upsert(values);
  if (error) { $("adminProfileStatus").textContent = error.message; return; }
  activateAdmin(user);
});
if (!isSupabaseConfigured) status("Connect this portal to Supabase by adding its project URL and anon key in frontend/supabase-config.js.");
else supabase.auth.onAuthStateChange((_event, session) => {
  setTimeout(() => {
    if (session?.user) activateAdmin(session.user);
    else { $("authScreen").classList.remove("hidden"); $("adminApp").classList.add("hidden"); }
  }, 0);
});

function switchPage(name) {
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${name}`));
  document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button.dataset.page === name));
  const titles = { overview: "Overview", materials: "Class materials", exams: "Teacher-set exams", submissions: "Exam submissions" }; $("topTitle").textContent = titles[name] || "Admin portal";
}
document.querySelectorAll(".nav button").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.page)));
document.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => switchPage(button.dataset.goto)));

async function loadWorkspace() {
  try {
    const results = await Promise.all([supabase.from("materials").select("*"), supabase.from("exams").select("*"), supabase.from("exam_submissions").select("*")]);
    const problem = results.find((result) => result.error); if (problem) throw problem.error;
    datasets.materials = results[0].data.map(normalizeRow); datasets.exams = results[1].data.map(normalizeRow); datasets.submissions = results[2].data.map(normalizeRow);
    $("materialCount").textContent = datasets.materials.length; $("examCount").textContent = datasets.exams.length; $("submissionCount").textContent = datasets.submissions.length;
    renderMaterials(); renderExams(); renderSubmissions();
  } catch (error) {
    console.error("Admin data could not be loaded", error);
    for (const id of ["recentMaterials", "allMaterials", "recentExams", "allExams", "allSubmissions"]) $(id).innerHTML = '<div class="card empty">Portal information could not be loaded. Check the Supabase tables and policies, then try again.</div>';
  }
}
function dateLabel(value) { return value?.toDate ? value.toDate().toLocaleDateString() : "Recently shared"; }
function safeLink(value) { try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } }
function materialCard(item) {
  const href = safeLink(item.url); const resource = item.storagePath ? `<button class="btn" data-open-file="${escapeHtml(item.storagePath)}">Open file</button>` : (href ? `<a class="btn" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Open link</a>` : "");
  return `<article class="card item"><div class="icon">▤</div><div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.className)} · ${escapeHtml(item.type)} · ${escapeHtml(item.teacherName || "Teacher")} · ${escapeHtml(dateLabel(item.createdAt))}</div>${item.note ? `<div class="meta">${escapeHtml(item.note)}</div>` : ""}</div>${resource}<button class="btn" data-remove-material="${escapeHtml(item.id)}" data-storage-path="${escapeHtml(item.storagePath || "")}">Remove</button></article>`;
}
function renderMaterials() {
  const sorted = [...datasets.materials].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  $("allMaterials").innerHTML = sorted.length ? sorted.map(materialCard).join("") : '<div class="card empty">Teachers have not published class materials yet.</div>';
  $("recentMaterials").innerHTML = sorted.length ? sorted.slice(0, 3).map(materialCard).join("") : '<div class="card empty">No resources shared yet.</div>';
  document.querySelectorAll("[data-open-file]").forEach((button) => button.addEventListener("click", async () => {
    const tab = window.open("about:blank", "_blank"); const { data, error } = await supabase.storage.from("class-materials").createSignedUrl(button.dataset.openFile, 300);
    if (error || !data?.signedUrl) { if (tab) tab.close(); toast("That file could not be opened."); return; } if (tab) { tab.opener = null; tab.location = data.signedUrl; }
  }));
  document.querySelectorAll("[data-remove-material]").forEach((button) => button.addEventListener("click", () => removeMaterial(button.dataset.removeMaterial, button.dataset.storagePath)));
}
async function removeMaterial(id, path) {
  if (!window.confirm("Remove this resource from the student portal?")) return;
  const { error } = await supabase.from("materials").delete().eq("id", id); if (error) return toast("This resource could not be removed.");
  if (path) await supabase.storage.from("class-materials").remove([path]);
  datasets.materials = datasets.materials.filter((item) => item.id !== id); renderMaterials(); $("materialCount").textContent = datasets.materials.length; toast("Resource removed");
}
function renderExams() {
  const sorted = [...datasets.exams].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const makeCard = (item) => `<article class="card item"><div class="icon">☷</div><div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.className)} · ${item.questions?.length || 0} questions · ${Number(item.durationMinutes)} minutes · ${escapeHtml(item.teacherName || "Teacher")}</div></div><span class="badge">Published</span></article>`;
  $("allExams").innerHTML = sorted.length ? sorted.map(makeCard).join("") : '<div class="card empty">Teachers have not published any exams yet.</div>';
  $("recentExams").innerHTML = sorted.length ? sorted.slice(0, 3).map(makeCard).join("") : '<div class="card empty">No exams have been set yet.</div>';
}
function renderSubmissions() {
  const exams = new Map(datasets.exams.map((exam) => [exam.id, exam])); const sorted = [...datasets.submissions].sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
  $("allSubmissions").innerHTML = sorted.length ? sorted.map((submission) => {
    const exam = exams.get(submission.examId);
    return `<article class="card submission"><h3>${escapeHtml(submission.studentName || "Student")} · ${escapeHtml(submission.studentId || "")}</h3><div class="meta">${escapeHtml(exam?.title || "Assessment")} · ${escapeHtml(exam?.className || "Class")} · ${escapeHtml(dateLabel(submission.submittedAt))}</div><p><strong>Automatic mark:</strong> ${Number(submission.autoScore)} / ${Number(submission.maxScore)}<br><strong>Teacher mark:</strong> ${submission.teacherScore == null ? "Pending" : Number(submission.teacherScore) + " / " + Number(submission.maxScore)} ${submission.gradedByName ? "· " + escapeHtml(submission.gradedByName) : ""}</p>${submission.teacherFeedback ? "<p>" + escapeHtml(submission.teacherFeedback) + "</p>" : ""}${(submission.answers || []).map((choice, index) => `<div class="answer"><strong>Question ${index + 1}:</strong> option ${Number(choice) + 1}</div>`).join("")}</article>`;
  }).join("") : '<div class="card empty">No student work has been submitted yet.</div>';
}
