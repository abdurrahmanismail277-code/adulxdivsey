import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

export const isSupabaseConfigured = /^https:\/\//.test(SUPABASE_URL) && !SUPABASE_URL.includes("YOUR_PROJECT") && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes("YOUR_ANON_KEY");
export const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export function normalizeRow(row = {}) {
  const aliases = {
    teacher_uid: "teacherUid", teacher_name: "teacherName", class_name: "className",
    storage_path: "storagePath", file_name: "fileName", created_at: "createdAt",
    closes_at: "closesAt", duration_minutes: "durationMinutes", student_uid: "studentUid",
    student_name: "studentName", exam_id: "examId", submitted_at: "submittedAt",
    profile_photo_path: "profilePhotoPath", updated_at: "updatedAt", student_id: "studentId",
    auto_score: "autoScore", max_score: "maxScore", teacher_score: "teacherScore",
    teacher_feedback: "teacherFeedback", graded_by_name: "gradedByName", graded_at: "gradedAt",
    teacher_photo_path: "teacherPhotoPath"
  };
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const alias = aliases[key] || key;
    if (["createdAt", "closesAt", "submittedAt", "updatedAt", "gradedAt"].includes(alias) && value) {
      const date = new Date(value);
      result[alias] = { toDate: () => date, seconds: Math.floor(date.getTime() / 1000) };
    } else result[alias] = value;
  }
  return result;
}

export function currentUserLabel(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Student";
}

export function currentUserClasses(user) {
  const meta = user?.app_metadata || {};
  return Array.isArray(meta.classes) ? meta.classes : [];
}

export function isAdmin(user) { return user?.app_metadata?.role === "admin"; }
