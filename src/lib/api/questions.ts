import { createClient } from "@/lib/supabase/client";
import type { QuestionInput, QuestionRow } from "@/types";

export interface QuestionFilters {
  search?: string;
  subject_id?: string;
  topic_id?: string;
  difficulty?: string;
}

function toDb(input: QuestionInput) {
  return {
    statement: input.statement.trim(),
    options: JSON.stringify(input.options),
    correct_index: input.correct_index,
    subject_id: input.subject_id,
    topic_id: input.topic_id,
    subtopic: input.subtopic.trim() || null,
    difficulty: input.difficulty,
    time_override_seconds: input.time_override_seconds,
    image_url: input.image_url.trim() || null,
  };
}

export async function listQuestions(filters: QuestionFilters = {}): Promise<QuestionRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.subject_id) query = query.eq("subject_id", filters.subject_id);
  if (filters.topic_id) query = query.eq("topic_id", filters.topic_id);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.search?.trim()) {
    query = query.ilike("statement", `%${filters.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar as questões.");
  return ((data ?? []) as unknown as (Omit<QuestionRow, "options"> & { options: unknown })[]).map(
    (q) => ({ ...q, options: q.options as string[] }),
  );
}

export async function getQuestionByIds(ids: string[]): Promise<QuestionRow[]> {
  if (!ids.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("questions").select("*").in("id", ids);
  if (error) throw new Error("Não foi possível carregar as questões.");
  return ((data ?? []) as unknown as (Omit<QuestionRow, "options"> & { options: unknown })[]).map(
    (q) => ({ ...q, options: q.options as string[] }),
  );
}

export async function createQuestion(input: QuestionInput): Promise<QuestionRow> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sessão expirada. Faça login novamente.");
  const { data, error } = await supabase
    .from("questions")
    .insert({ ...toDb(input), teacher_id: user.user.id })
    .select()
    .single();
  if (error) throw new Error("Não foi possível salvar a questão.");
  return { ...(data as unknown as Omit<QuestionRow, "options">), options: data.options as string[] };
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("questions").update(toDb(input)).eq("id", id);
  if (error) throw new Error("Não foi possível salvar a questão.");
}

export async function deleteQuestion(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir a questão.");
}

export async function duplicateQuestion(question: QuestionRow): Promise<QuestionRow> {
  return createQuestion({
    statement: question.statement,
    options: [question.options[0], question.options[1], question.options[2], question.options[3]],
    correct_index: question.correct_index,
    subject_id: question.subject_id,
    topic_id: question.topic_id,
    subtopic: question.subtopic ?? "",
    difficulty: question.difficulty,
    time_override_seconds: question.time_override_seconds,
    image_url: question.image_url ?? "",
  });
}
