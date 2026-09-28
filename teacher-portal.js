import { supabase, isSupabaseConfigured, normalizeRow, isAdmin } from "./supabase-client.js";

const $ = (id) => document.getElementById(id);
const classes = ["General Qur'an Class", "Personalized Qur'an Class", "General Qur'an + Arabiyah", "Personalized Qur'an + Arabiyah", "Arabiyah Program"];
let teacher = null; let profile = null; let allowedClasses = []; let toastTimer; let activeExamId = null;
function toast(text) { $("toast").textContent = text; $("toast").classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800); }
function setStatus(text) { $("authStatus").textContent = text; }
function escapeHtml(text = "") { return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function togglePassword(id) { const input = $(id); const button = document.querySelector(`[data-toggle-password="${id}"]`); input.type = input.type === "password" ? "text" : "password"; button.textContent = input.type === "password" ? "Show" : "Hide"; }
document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => togglePassword(button.dataset.togglePassword)));

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault(); setStatus("");
  if (!supabase) return setStatus("Connect this portal to Supabase in frontend/supabase-config.js first.");
  const { error } = await supabase.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  if (error) setStatus(error.message || "Sign-in failed. Check your details and try again.");
});
$("signout").addEventListener("click", () => supabase?.auth.signOut());

function setClassOptions() {
  allowedClasses = [...classes];
  for (const id of ["materialClass", "examClass"]) {
    $(id).innerHTML = allowedClasses.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    $(id).disabled = false;
  }
}
async function loadTeacherProfile(user) {
  const { data, error } = await supabase.from("teacher_profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data;
}
async function showTeacherApp() {
  $("authScreen").classList.add("hidden"); $("teacherSetup").classList.add("hidden"); $("teacherApp").classList.remove("hidden");
  $("teacherName").textContent = profile.name; $("teacherEmail").textContent = teacher.email || "";
  $("profileName").value = profile.name; $("profilePhone").value = profile.phone; $("profileGender").value = profile.gender; $("teacherWelcome").textContent = `Welcome ${profile.name}`;
  await refreshTeacherPhoto(); await Promise.all([loadMaterials(), loadExams()]);
}
async function refreshTeacherPhoto() {
  if (!profile.photo_path) { $("teacherAvatar").removeAttribute("src"); $("profilePhotoPreview").removeAttribute("src"); return; }
  const { data } = await supabase.storage.from("teacher-photos").createSignedUrl(profile.photo_path, 3600);
  if (data?.signedUrl) { $("teacherAvatar").src = data.signedUrl; $("profilePhotoPreview").src = data.signedUrl; }
}
function showSetup() { $("authScreen").classList.add("hidden"); $("teacherApp").classList.add("hidden"); $("teacherSetup").classList.remove("hidden"); $("setupName").value = teacher.user_metadata?.full_name || teacher.user_metadata?.name || ""; }

async function activateUser(user) {
  teacher = user;
  const role = user.app_metadata?.role;
  if (role !== "teacher" && role !== "admin") {
    await supabase.auth.signOut(); $("authScreen").classList.remove("hidden"); $("teacherApp").classList.add("hidden");
    setStatus("This account has not been approved for teacher access. Contact the institute administrator."); return;
  }
  try {
    setClassOptions(); profile = await loadTeacherProfile(user);
    if (!profile?.name || !profile.phone || !profile.gender) { showSetup(); return; }
    await showTeacherApp();
  } catch (error) { $("authScreen").classList.remove("hidden"); $("teacherApp").classList.add("hidden"); setStatus(error.message || "We could not load your teacher workspace."); }
}
if (!isSupabaseConfigured) setStatus("Connect this portal to Supabase by adding its project URL and anon key in frontend/supabase-config.js.");
else supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => session?.user ? activateUser(session.user) : ($("teacherApp").classList.add("hidden"), $("teacherSetup").classList.add("hidden"), $("authScreen").classList.remove("hidden")), 0));

async function uploadTeacherPhoto(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choose a JPG, PNG, or WebP photo under 5 MB.");
  const path = `${teacher.id}/teacher-${Date.now()}.${file.type.split("/")[1]}`;
  const { error } = await supabase.storage.from("teacher-photos").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
$("teacherSetupForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("completeTeacherSetup"); button.disabled = true; $("setupStatus").textContent = "Saving your profile…";
  try {
    const photoFile = $("setupPhoto").files[0];
    const photoPath = photoFile ? await uploadTeacherPhoto(photoFile) : null;
    const values = { id: teacher.id, name: $("setupName").value.trim(), phone: $("setupPhone").value.trim(), gender: $("setupGender").value, photo_path: photoPath, updated_at: new Date().toISOString() };
    if (!values.name || !values.phone || !values.gender) throw new Error("Enter your name, phone number, and gender.");
    const { data, error } = await supabase.from("teacher_profiles").upsert(values).select().single(); if (error) throw error;
    profile = data; await showTeacherApp();
  } catch (error) { $("setupStatus").textContent = error.message || "We could not save your profile."; }
  finally { button.disabled = false; }
});

document.querySelectorAll(".nav").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".nav").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${button.dataset.page}`));
  $("topTitle").textContent = ({ materials: "Class materials", exams: "Exams & grading", profile: "My profile" })[button.dataset.page];
}));
$("resourceType").addEventListener("change", () => {
  const isLink = $("resourceType").value === "link"; $("urlField").classList.toggle("hidden", !isLink); $("fileField").classList.toggle("hidden", isLink);
  $("resourceFile").required = !isLink; $("resourceUrl").required = isLink;
});
$("materialForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("publishMaterial"); button.disabled = true; button.textContent = "Publishing…"; let uploadedPath = "";
  try {
    const type = $("resourceType").value; let url = ""; let fileName = "";
    if (!allowedClasses.includes($("materialClass").value)) throw new Error("You do not have permission to publish to this class.");
    if (type === "link") { const parsed = new URL($("resourceUrl").value); if (parsed.protocol !== "https:") throw new Error("Please use a secure https:// resource link."); url = parsed.href; }
    else {
      const file = $("resourceFile").files[0]; if (!file) throw new Error("Choose a file to share with your class."); if (file.size > 20 * 1024 * 1024) throw new Error("Files must be 20 MB or smaller.");
      fileName = file.name; uploadedPath = `${teacher.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("class-materials").upload(uploadedPath, file, { contentType: file.type || "application/octet-stream" }); if (error) throw error;
    }
    const { error } = await supabase.from("materials").insert({ teacher_uid: teacher.id, teacher_name: profile.name, class_name: $("materialClass").value, title: $("materialTitle").value.trim(), type, url, storage_path: uploadedPath, file_name: fileName, note: $("materialNote").value.trim(), published: true }); if (error) throw error;
    event.currentTarget.reset(); $("urlField").classList.add("hidden"); $("fileField").classList.remove("hidden"); $("resourceFile").required = true; $("resourceUrl").required = false; toast("Resource published to your class"); await loadMaterials();
  } catch (error) { if (uploadedPath) await supabase.storage.from("class-materials").remove([uploadedPath]); toast(error.message || "We could not publish the resource."); }
  finally { button.disabled = false; button.textContent = "Publish to class"; }
});
async function loadMaterials() {
  const query = supabase.from("materials").select("*").order("created_at", { ascending: false }); if (!isAdmin(teacher)) query.eq("teacher_uid", teacher.id);
  const { data, error } = await query; if (error) { $("myMaterials").innerHTML = '<div class="card empty">Resources could not be loaded. Please refresh and try again.</div>'; return; }
  const items = data.map(normalizeRow); $("myMaterials").innerHTML = items.length ? items.map((item) => `<article class="card resource"><div class="resource-icon">▤</div><div class="grow"><div class="resource-title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.className)} · ${escapeHtml(item.type)} · ${escapeHtml(item.teacherName || "Teacher")}</div></div><button class="btn outline" data-delete-material="${escapeHtml(item.id)}" data-path="${escapeHtml(item.storagePath || "")}">Remove</button></article>`).join("") : '<div class="card empty">You have not published any resources yet.</div>';
  document.querySelectorAll("[data-delete-material]").forEach((button) => button.addEventListener("click", () => removeMaterial(button.dataset.deleteMaterial, button.dataset.path)));
}
async function removeMaterial(id, path) {
  if (!window.confirm("Remove this resource from the class?")) return; const { error } = await supabase.from("materials").delete().eq("id", id); if (error) return toast("You cannot remove this resource.");
  if (path) await supabase.storage.from("class-materials").remove([path]); toast("Resource removed"); await loadMaterials();
}

function addQuestion() {
  const number = $("questions").children.length + 1; const row = document.createElement("div"); row.className = "qrow";
  row.innerHTML = `<strong>Question ${number}</strong><div class="field"><label>Question type</label><select class="question-type"><option value="objective">Objective (multiple choice)</option><option value="theory">Theory (written answer)</option><option value="fill_blank">Fill in the gap</option></select></div><div class="field"><label>Question</label><input class="question-prompt" type="text" maxlength="500" required placeholder="Write the question"></div><div class="choices">${["A", "B", "C", "D"].map((letter, index) => `<div class="field"><label>Option ${letter}${index > 1 ? " (optional)" : ""}</label><input class="question-option" type="text" maxlength="250" ${index < 2 ? "required" : ""}><label class="correct-choice"><input class="correct-answer" type="radio" name="correct_${number}" value="${index}" ${index === 0 ? "required" : ""}> Correct answer</label></div>`).join("")}</div><div class="field"><label>Accepted answer / marking guide</label><textarea class="question-key" maxlength="1500" placeholder="Add the expected answer or grading guidance"></textarea></div><div class="field"><label>Points</label><input class="question-points" type="number" min="1" max="100" value="1" required></div><button type="button" class="btn outline remove-question">Remove question</button>`;
  const updateType = () => { const objective = row.querySelector(".question-type").value === "objective"; row.querySelector(".choices").classList.toggle("hidden", !objective); row.querySelector(".question-key").required = !objective; row.querySelectorAll(".question-option").forEach((input, index) => input.required = objective && index < 2); row.querySelectorAll(".correct-answer").forEach((radio) => radio.required = objective); };
  row.querySelector(".question-type").addEventListener("change", updateType); updateType();
  row.querySelector(".remove-question").addEventListener("click", () => { row.remove(); renumberQuestions(); }); $("questions").append(row);
}
function renumberQuestions() { [...$("questions").children].forEach((row, index) => { const strong = row.querySelector("strong"); strong.textContent = `Question ${index + 1}`; row.querySelectorAll(".correct-answer").forEach((radio) => { radio.name = `correct_${index + 1}`; radio.required = true; }); }); }
$("addQuestion").addEventListener("click", addQuestion); addQuestion();
$("examForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("publishExam"); button.disabled = true; button.textContent = "Publishing…"; let examId = null;
  try {
    if (!allowedClasses.includes($("examClass").value)) throw new Error("You do not have permission to set an exam for this class.");
    const questions = [...$("questions").children].map((row) => {
      const type = row.querySelector(".question-type").value;
      const options = [...row.querySelectorAll(".question-option")].map((input) => input.value.trim()).filter(Boolean);
      if (!row.querySelector(".question-prompt").value.trim()) throw new Error("Add a prompt for every question.");
      if (type === "objective") { const selectedCorrect = row.querySelector(".correct-answer:checked"); if (options.length < 2 || !selectedCorrect) throw new Error("Objective questions need options and one correct answer."); const correctText = row.querySelectorAll(".question-option")[Number(selectedCorrect.value)].value.trim(); return { question: { type, prompt: row.querySelector(".question-prompt").value.trim(), options, points: Number(row.querySelector(".question-points").value) }, correct: options.indexOf(correctText) }; }
      const answer = row.querySelector(".question-key").value.trim(); if (!answer) throw new Error("Add an accepted answer or marking guide for written questions.");
      return { question: { type, prompt: row.querySelector(".question-prompt").value.trim(), options: [], points: Number(row.querySelector(".question-points").value) }, correct: answer };
    });
    const closesAt = $("examCloses").value ? new Date($("examCloses").value).toISOString() : null;
    const { data: exam, error } = await supabase.from("exams").insert({ teacher_uid: teacher.id, teacher_name: profile.name, class_name: $("examClass").value, title: $("examTitle").value.trim(), duration_minutes: Number($("examDuration").value), closes_at: closesAt, questions: questions.map((item) => item.question), published: false }).select().single();
    if (error) throw error; examId = exam.id;
    const { error: keyError } = await supabase.from("exam_answer_keys").insert({ exam_id: exam.id, teacher_uid: teacher.id, correct_answers: questions.map((item) => item.correct) }); if (keyError) throw keyError;
    const { error: publishError } = await supabase.from("exams").update({ published: true }).eq("id", exam.id); if (publishError) throw publishError;
    event.currentTarget.reset(); $("questions").innerHTML = ""; addQuestion(); toast("Exam published to your class"); await loadExams();
  } catch (error) { if (examId) { await supabase.from("exams").delete().eq("id", examId); } toast(error.message || "We could not publish this exam."); }
  finally { button.disabled = false; button.textContent = "Publish exam"; }
});
async function loadExams() {
  const query = supabase.from("exams").select("*").order("created_at", { ascending: false }); if (!isAdmin(teacher)) query.eq("teacher_uid", teacher.id);
  const { data, error } = await query; if (error) { $("myExams").innerHTML = '<div class="card empty">Exams could not be loaded. Please refresh and try again.</div>'; return; }
  const items = data.map(normalizeRow); $("myExams").innerHTML = items.length ? items.map((item) => `<article class="card exam"><div class="resource-icon">☷</div><div class="grow"><div class="resource-title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.className)} · ${item.questions?.length || 0} questions · ${Number(item.durationMinutes)} minutes · ${escapeHtml(item.teacherName)} · Results ${item.results_released ? "released" : "not released"}</div></div><button class="btn outline" data-submissions="${escapeHtml(item.id)}">Review submissions</button><button class="btn primary" data-release="${escapeHtml(item.id)}" data-value="${item.results_released ? "false" : "true"}">${item.results_released ? "Hide results" : "Release results"}</button></article>`).join("") : '<div class="card empty">You have not published any exams yet.</div>';
  document.querySelectorAll("[data-submissions]").forEach((button) => button.addEventListener("click", () => loadSubmissions(button.dataset.submissions)));
  document.querySelectorAll("[data-release]").forEach((button) => button.addEventListener("click", async () => { if (button.dataset.value === "true") { const exam = items.find((item) => item.id === button.dataset.release); if (exam.questions.some((question) => question.type === "theory" || question.type === "fill_blank")) { const { data: submissions } = await supabase.from("exam_submissions").select("teacher_score").eq("exam_id", exam.id); if ((submissions || []).some((submission) => submission.teacher_score == null)) return toast("Grade every written response before releasing results."); } } const { error } = await supabase.from("exams").update({ results_released: button.dataset.value === "true" }).eq("id", button.dataset.release); if (error) return toast("Results could not be updated."); toast(button.dataset.value === "true" ? "Results released to students" : "Results hidden from students"); await loadExams(); }));
}
async function loadSubmissions(examId) {
  activeExamId = examId; $("submissions").innerHTML = '<div class="card empty">Loading submissions…</div>';
  const { data, error } = await supabase.from("exam_submissions").select("*").eq("exam_id", examId).order("submitted_at", { ascending: false });
  if (error) { $("submissions").innerHTML = '<div class="card empty">Submissions are unavailable. Check your teacher access.</div>'; return; }
  const exam = (await supabase.from("exams").select("*").eq("id", examId).single()).data; const answerKey = (await supabase.from("exam_answer_keys").select("correct_answers").eq("exam_id", examId).single()).data; const examData = { ...normalizeRow(exam), correctAnswers: answerKey?.correct_answers || [] };
  const items = data.map(normalizeRow);
  $("submissions").innerHTML = `<h2 style="font:700 16px Manrope;margin:25px 0 12px">Student submissions · ${escapeHtml(profile.name)}</h2>${items.length ? items.map((item) => `<article class="card panel"><strong>${escapeHtml(item.studentName || "Student")}</strong><p class="meta">Student ID ${escapeHtml(item.studentId || "—")} · Submitted ${escapeHtml(item.submittedAt?.toDate ? item.submittedAt.toDate().toLocaleString() : "just now")}</p><p class="meta"><strong>Automatically marked objective score: ${Number(item.autoScore)} / ${Number(item.maxScore)}</strong></p>${(item.answers || []).map((answer, index) => { const question = examData.questions[index] || {}; const response = (question.type || "objective") === "objective" ? (question.options?.[Number(answer)] || "No answer") : String(answer || "No answer"); const key = examData.correctAnswers[index]; const guide = typeof key === "number" ? "" : String(key || ""); return `<div class="answer-row"><strong>${index + 1}. ${escapeHtml(question.prompt || "Question")} (${escapeHtml(question.type || "objective")})</strong><div class="meta">Student answer: ${escapeHtml(response)}${guide ? `<br>Marking guide: ${escapeHtml(guide)}` : ""}</div></div>`; }).join("")}<div class="grade-grid"><div class="field"><label for="feedback-${escapeHtml(item.id)}">Teacher feedback</label><textarea id="feedback-${escapeHtml(item.id)}" maxlength="1500" placeholder="Write feedback for the student">${escapeHtml(item.teacherFeedback || "")}</textarea><div class="meta">${item.gradedByName ? `Last reviewed by ${escapeHtml(item.gradedByName)}` : "Your name will be shown with this feedback."}</div></div><div class="field"><label for="score-${escapeHtml(item.id)}">Final teacher score (max ${Number(item.maxScore)})</label><input id="score-${escapeHtml(item.id)}" type="number" min="0" max="${Number(item.maxScore)}" step="0.5" value="${item.teacherScore ?? ""}" placeholder="Required for theory"><button type="button" class="btn primary" data-save-grade="${escapeHtml(item.id)}" style="margin-top:8px;width:100%">Save grade &amp; feedback</button></div></div></article>`).join("") : '<div class="card empty">No student submissions yet.</div>'}`;
  document.querySelectorAll("[data-save-grade]").forEach((button) => button.addEventListener("click", () => saveGrade(button.dataset.saveGrade)));
}
async function saveGrade(id) {
  const rawScore = $(`score-${id}`).value; const score = rawScore === "" ? null : Number(rawScore); const feedback = $(`feedback-${id}`).value.trim();
  if (rawScore !== "" && (!Number.isFinite(score) || score < 0)) return toast("Enter a valid teacher score.");
  const { error } = await supabase.from("exam_submissions").update({ teacher_score: score, teacher_feedback: feedback }).eq("id", id);
  if (error) return toast(error.message || "We could not save this grade."); toast("Grade and feedback saved with your teacher profile"); await loadSubmissions(activeExamId);
}

$("teacherProfileForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const name = $("profileName").value.trim(); const phone = $("profilePhone").value.trim(); let photoPath = profile.photo_path;
  try { const photo = $("profilePhoto").files[0]; if (photo) photoPath = await uploadTeacherPhoto(photo); }
  catch (error) { $("profileStatus").textContent = error.message; return; }
  const gender = $("profileGender").value; if (!gender) return $("profileStatus").textContent = "Choose your gender.";
  const { data, error } = await supabase.from("teacher_profiles").update({ name, phone, gender, photo_path: photoPath, updated_at: new Date().toISOString() }).eq("id", teacher.id).select().single();
  if (error) { $("profileStatus").textContent = "We could not save the profile. Please try again."; return; }
  profile = data; $("profileStatus").textContent = "Profile saved. Your name will appear on your new exam grades and feedback."; await refreshTeacherPhoto(); $("teacherName").textContent = profile.name; $("teacherWelcome").textContent = `Welcome ${profile.name}`;
});
$("refreshMaterials").addEventListener("click", loadMaterials); $("refreshExams").addEventListener("click", loadExams);
