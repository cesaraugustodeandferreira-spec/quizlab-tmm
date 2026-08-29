import { createClient } from "@/lib/supabase/client";
import { invalidateCache } from "@/lib/cache";
import type { ClassRoom } from "@/types";

export async function listClasses(): Promise<ClassRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as turmas.");
  return (data as ClassRoom[]) ?? [];
}

export interface ClassInput {
  name: string;
  grade_year: string;
}

export async function createClass(input: ClassInput): Promise<ClassRoom> {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sessão expirada. Faça login novamente.");
  const { data, error } = await supabase
    .from("classes")
    .insert({
      teacher_id: user.user.id,
      name: input.name,
      grade_year: input.grade_year,
    })
    .select()
    .single();
  if (error) throw new Error("Não foi possível criar a turma.");
  invalidateCache("turmas");
  return data as ClassRoom;
}

export async function updateClass(id: string, input: ClassInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      name: input.name,
      grade_year: input.grade_year,
    })
    .eq("id", id);
  if (error) throw new Error("Não foi possível salvar a turma.");
  invalidateCache("turmas");
}

export async function deleteClass(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("rpc_delete_class", { p_class_id: id });
  if (error) throw new Error("Não foi possível excluir a turma.");
  invalidateCache("turmas");
  invalidateCache("diagnosticos");
  invalidateCache("dashboard");
}
