import { createClient } from "@/lib/supabase/client";
import { invalidateCache } from "@/lib/cache";
import type { QuizInput, QuizRow, QuestionRow, Subject } from "@/types";

export interface QuizWithMeta extends QuizRow {
  subject_name: string | null;
  question_count: number;
}

interface RawQuiz extends Omit<QuizWithMeta, "subject_name" | "question_count"> {
  subjects: { name: string }[] | { name: string } | null;
  quiz_questions: { count: number }[] | null;
}

function normalize(raw: RawQuiz): QuizWithMeta {
  const subj = Array.isArray(raw.subjects) ? raw.subjects[0] : raw.subjects;
  return {
    ...raw,
    subject_name: subj?.name ?? null,
    question_count: raw.quiz_questions?.[0]?.count ?? 0,
  };
}

const QUIZ_SELECT = `*, subjects(name), quiz_questions(count)`;

export async function listQuizzes(status?: "rascunho" | "publicado"): Promise<QuizWithMeta[]> {
  const supabase = createClient();
  let query = supabase.from("quizzes").select(QUIZ_SELECT).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os quizzes.");
  return ((data ?? []) as unknown as RawQuiz[]).map(normalize);
}

export interface QuizDetail extends QuizRow {
  subject: Subject | null;
  questions: (QuestionRow & { position: number })[];
}

export async function getQuiz(quizId: string): Promise<QuizDetail> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      `*,
       subjects(*),
       quiz_questions(position, questions(*))`,
    )
    .eq("id", quizId)
    .maybeSingle();
  if (error || !data) throw new Error("Quiz não encontrado.");

  const raw = data as unknown as Omit<QuizDetail, "subject" | "questions"> & {
    subjects: Subject | Subject[] | null;
    quiz_questions: { position: number; questions: unknown }[];
  };

  const links = [...raw.quiz_questions].sort((a, b) => a.position - b.position);
  const questions = links
    .filter((l) => l.questions)
    .map((l) => {
      const q = l.questions as Omit<QuestionRow, "options"> & { options: unknown };
      return { ...(q as unknown as QuestionRow), options: q.options as string[], position: l.position };
    });

  return {
    ...raw,
    subject: Array.isArray(raw.subjects) ? raw.subjects[0] : raw.subjects,
    questions,
  };
}

export interface CreateQuizPayload extends QuizInput {}

export async function createQuiz(input: CreateQuizPayload): Promise<string> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sessão expirada. Faça login novamente.");
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      teacher_id: user.user.id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      subject_id: input.subject_id || null,
      topic_id: input.topic_id,
      default_time_seconds: input.default_time_seconds,
      show_ranking: input.show_ranking,
      show_score: input.show_score,
      show_correct_answers: input.show_correct_answers,
      is_shared: input.is_shared ?? false,
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error) throw new Error("Não foi possível criar o quiz.");
  invalidateCache("quizzes");
  invalidateCache("biblioteca");
  return (data as { id: string }).id;
}

export async function updateQuiz(quizId: string, input: QuizInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("quizzes")
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      subject_id: input.subject_id || null,
      topic_id: input.topic_id,
      default_time_seconds: input.default_time_seconds,
      show_ranking: input.show_ranking,
      show_score: input.show_score,
      show_correct_answers: input.show_correct_answers,
      is_shared: input.is_shared,
    })
    .eq("id", quizId);
  if (error) throw new Error("Não foi possível salvar o quiz.");
  invalidateCache("quizzes");
}

export async function setQuizStatus(quizId: string, status: "rascunho" | "publicado"): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("quizzes").update({ status }).eq("id", quizId);
  if (error) throw new Error(`Não foi possível ${status === "publicado" ? "publicar" : "salvar"} o quiz.`);
  invalidateCache("quizzes");
}

export async function publishToLibrary(quizId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("quizzes").update({ is_shared: true, status: "publicado" }).eq("id", quizId);
  if (error) throw new Error("Não foi possível publicar na Biblioteca.");
  invalidateCache("quizzes");
  invalidateCache("biblioteca");
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) throw new Error("Não foi possível excluir o quiz.");
  invalidateCache("quizzes");
  invalidateCache("biblioteca");
  invalidateCache("dashboard");
}

export async function addQuestionToQuiz(quizId: string, questionId: string): Promise<void> {
  const supabase = createClient();
  const { count, error: countError } = await supabase
    .from("quiz_questions")
    .select("*", { count: "exact", head: true })
    .eq("quiz_id", quizId);
  if (countError) throw new Error("Não foi possível adicionar a questão.");
  const { error } = await supabase
    .from("quiz_questions")
    .insert({ quiz_id: quizId, question_id: questionId, position: (count ?? 0) + 1 });
  if (error) {
    if (error.code === "23505") throw new Error("Esta questão já está no quiz.");
    throw new Error("Não foi possível adicionar a questão.");
  }
  invalidateCache("quizzes");
}

export async function removeQuestionFromQuiz(quizId: string, questionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("quiz_id", quizId)
    .eq("question_id", questionId);
  if (error) throw new Error("Não foi possível remover a questão.");

  const { data, error: selError } = await supabase
    .from("quiz_questions")
    .select("question_id")
    .eq("quiz_id", quizId)
    .order("position");
  if (selError) throw new Error("Não foi possível reordenar as questões.");
  const ids = (data as { question_id: string }[]).map((r) => r.question_id);
  if (ids.length) await reorderQuestions(quizId, ids);
}

export async function reorderQuestions(quizId: string, orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_quiz_question_order", {
    p_quiz_id: quizId,
    p_ids: orderedIds,
  });
  if (error) throw new Error("Não foi possível reordenar as questões.");
  invalidateCache("quizzes");
}

export async function duplicateQuizRpc(quizId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("duplicate_quiz", { p_quiz_id: quizId });
  if (error) throw new Error(error.message.includes("não está disponível")
    ? error.message
    : "Não foi possível duplicar o quiz.");
  invalidateCache("quizzes");
  invalidateCache("biblioteca");
  return data as string;
}
