import { createClient } from "@/lib/supabase/client";
import type { Subject, Topic } from "@/types";

export async function listSubjects(): Promise<Subject[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("subjects").select("*").order("name");
  if (error) throw new Error("Não foi possível carregar as disciplinas.");
  return (data as Subject[]) ?? [];
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
