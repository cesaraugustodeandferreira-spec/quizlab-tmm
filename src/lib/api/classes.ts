import { createClient } from "@/lib/supabase/client";
import type { ClassRoom, ClassStudent } from "@/types";

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
  identifier: string;
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
      identifier: input.identifier || null,
    })
    .select()
    .single();
  if (error) throw new Error("Não foi possível criar a turma.");
  return data as ClassRoom;
}

export async function updateClass(id: string, input: ClassInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      name: input.name,
      grade_year: input.grade_year,
      identifier: input.identifier || null,
    })
    .eq("id", id);
  if (error) throw new Error("Não foi possível salvar a turma.");
}

export async function deleteClass(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir a turma.");
}

export async function listClassStudents(classId: string): Promise<ClassStudent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("class_students")
    .select("*")
    .eq("class_id", classId)
    .order("name");
  if (error) throw new Error("Não foi possível carregar os alunos.");
  return (data as ClassStudent[]) ?? [];
}

export async function addStudent(classId: string, name: string): Promise<ClassStudent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("class_students")
    .insert({ class_id: classId, name: name.trim() })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um aluno com esse nome na turma.");
    throw new Error("Não foi possível adicionar o aluno.");
  }
  return data as ClassStudent;
}

export async function renameStudent(studentId: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("class_students")
    .update({ name: name.trim() })
    .eq("id", studentId);
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um aluno com esse nome na turma.");
    throw new Error("Não foi possível renomear o aluno.");
  }
}

export async function removeStudent(studentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("class_students").delete().eq("id", studentId);
  if (error) throw new Error("Não foi possível remover o aluno.");
}
