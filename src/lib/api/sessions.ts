import { createClient } from "@/lib/supabase/client";
import type { SessionRow, SessionStudentRow, AnswerRow } from "@/types";

export async function createSession(quizId: string, classId: string): Promise<SessionRow> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sessão expirada. Faça login novamente.");
  const { data, error } = await supabase
    .from("quiz_sessions")
    .insert({ quiz_id: quizId, class_id: classId, teacher_id: user.user.id })
    .select()
    .single();
  if (error) throw new Error("Não foi possível criar a sala.");
  return data as unknown as SessionRow;
}

export interface SessionDetail extends SessionRow {
  quiz_title: string;
  class_name: string;
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*, quizzes(title), classes(name)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) throw new Error("Sala não encontrada.");
  const raw = data as unknown as Omit<SessionDetail, "quiz_title" | "class_name"> & {
    quizzes: { title: string } | { title: string }[];
    classes: { name: string } | { name: string }[];
  };
  const quiz = Array.isArray(raw.quizzes) ? raw.quizzes[0] : raw.quizzes;
  const cls = Array.isArray(raw.classes) ? raw.classes[0] : raw.classes;
  return { ...raw, quiz_title: quiz?.title ?? "Quiz", class_name: cls?.name ?? "Turma" };
}

export async function listSessionStudents(sessionId: string): Promise<SessionStudentRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_students")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at");
  if (error) throw new Error("Não foi possível carregar os participantes.");
  return (data as SessionStudentRow[]) ?? [];
}

export async function listSessionAnswers(sessionId: string): Promise<AnswerRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("answers")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw new Error("Não foi possível carregar as respostas.");
  return (data as AnswerRow[]) ?? [];
}

export async function hostStart(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("host_start_quiz", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

export async function hostCloseQuestion(sessionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("host_close_question", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return data as { correct_index: number; counts: { index: number; count: number }[] };
}

export async function hostAdvance(sessionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("host_advance", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return data as { finished: boolean; current_index?: number };
}

export async function hostCancelRoom(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("host_cancel_room", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}

export async function hostFinishQuiz(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("host_finish_quiz", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
}
