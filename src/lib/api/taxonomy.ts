import { createClient } from "@/lib/supabase/client";
import type { Subject, Topic } from "@/types";

type SubjectListener = () => void;
const subjectListeners = new Set<SubjectListener>();

/** Inscreve-se para ser notificado quando a lista de disciplinas mudar (ex.: nova criada). */
export function subscribeSubjects(cb: SubjectListener): () => void {
  subjectListeners.add(cb);
  return () => {
    subjectListeners.delete(cb);
  };
}

function emitSubjectsChanged() {
  subjectListeners.forEach((cb) => cb());
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function listSubjects(): Promise<Subject[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("subjects").select("*").order("name");
  if (error) throw new Error("Não foi possível carregar as disciplinas.");
  return (data as Subject[]) ?? [];
}

export async function createSubject(rawName: string): Promise<Subject> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sessão expirada. Faça login novamente.");

  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) throw new Error("Informe um nome para a disciplina.");

  const { data, error } = await supabase
    .from("subjects")
    .insert({ name, teacher_id: user.user.id })
    .select("id, name, teacher_id")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Já existe uma disciplina com esse nome.");
    throw new Error("Não foi possível criar a disciplina.");
  }

  emitSubjectsChanged();
  return data as Subject;
}

export async function listTopics(subjectId?: string): Promise<Topic[]> {
  const supabase = createClient();
  let query = supabase.from("topics").select("*").order("name");
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os temas.");
  return (data as Topic[]) ?? [];
}

export async function ensureTopic(subjectId: string | null | undefined, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!subjectId || !trimmed) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ensure_topic", {
    p_subject_id: subjectId,
    p_name: trimmed,
  });
  if (error) throw new Error("Não foi possível salvar o tema.");
  return data as string;
}
