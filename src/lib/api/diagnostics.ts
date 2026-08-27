import { createClient } from "@/lib/supabase/client";
import type {
  ClassDiagnostics,
  DashboardData,
  SessionDiagnostics,
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

export async function fetchClassDiagnostics(classId: string, subjectId?: string | null): Promise<ClassDiagnostics> {
  return rpc<ClassDiagnostics>(
    "rpc_class_diagnostics",
    { p_class_id: classId, p_subject_id: subjectId ?? null },
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
