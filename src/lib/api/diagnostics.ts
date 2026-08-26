import { createClient } from "@/lib/supabase/client";
import type {
  ClassDiagnostics,
  DashboardData,
  SessionDiagnostics,
  StudentDiagnostics,
} from "@/types";

async function rpc<T>(name: string, args: Record<string, unknown>, fallbackMessage: string): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message.includes("permissão") ? error.message : fallbackMessage);
  return data as T;
}

export async function fetchDashboard(): Promise<DashboardData> {
  return rpc<DashboardData>("rpc_dashboard", {}, "Não foi possível carregar o painel.");
}

export async function fetchClassDiagnostics(classId: string): Promise<ClassDiagnostics> {
  return rpc<ClassDiagnostics>(
    "rpc_class_diagnostics",
    { p_class_id: classId },
    "Não foi possível carregar o diagnóstico da turma.",
  );
}

export async function fetchSessionDiagnostics(sessionId: string): Promise<SessionDiagnostics> {
  return rpc<SessionDiagnostics>(
    "rpc_session_diagnostics",
    { p_session_id: sessionId },
    "Não foi possível carregar o diagnóstico.",
  );
}

export async function fetchStudentDiagnostics(studentId: string): Promise<StudentDiagnostics> {
  return rpc<StudentDiagnostics>(
    "rpc_student_diagnostics",
    { p_student_id: studentId },
    "Não foi possível carregar o diagnóstico do aluno.",
  );
}

export interface LibraryItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  default_time_seconds: number;
  created_at: string;
  author: string | null;
  question_count: number;
}

export async function fetchLibrary(): Promise<LibraryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_library");
  if (error) throw new Error("Não foi possível carregar a biblioteca.");
  return (data as LibraryItem[]) ?? [];
}

export interface AppliedQuizItem {
  session_id: string;
  title: string;
  date: string | null;
  participants: number;
  avg_pct: number | null;
}

export async function fetchAppliedQuizzes(classId: string): Promise<AppliedQuizItem[]> {
  const diag = await rpc<ClassDiagnostics>(
    "rpc_class_diagnostics",
    { p_class_id: classId },
    "Não foi possível carregar os quizzes aplicados.",
  );
  return diag.history.map((h) => ({
    session_id: h.session_id,
    title: h.title,
    date: h.date,
    participants: h.participants,
    avg_pct: h.avg_pct,
  }));
}
