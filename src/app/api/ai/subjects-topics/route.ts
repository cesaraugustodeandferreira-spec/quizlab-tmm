import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Buscar disciplinas do professor
    const { data: subjects, error: subjectsError } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("teacher_id", user.id)
      .order("name");

    if (subjectsError) {
      return NextResponse.json({ error: subjectsError.message }, { status: 500 });
    }

    // Buscar temas do professor
    const subjectIds = subjects?.map((s) => s.id) ?? [];
    let topics: { id: string; name: string; subject_id: string }[] = [];

    if (subjectIds.length > 0) {
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select("id, name, subject_id")
        .in("subject_id", subjectIds)
        .order("name");

      if (!topicsError && topicsData) {
        topics = topicsData;
      }
    }

    return NextResponse.json({ subjects: subjects ?? [], topics });
  } catch (error) {
    console.error("Erro ao buscar disciplinas/temas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}