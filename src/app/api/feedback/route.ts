import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const mensagem = typeof body?.mensagem === "string" ? body.mensagem.trim() : "";
    const url_contexto = typeof body?.url_contexto === "string" ? body.url_contexto.slice(0, 500) : null;

    if (mensagem.length < 3) {
      return NextResponse.json({ error: "A mensagem precisa ter pelo menos 3 caracteres." }, { status: 400 });
    }
    if (mensagem.length > 2000) {
      return NextResponse.json({ error: "A mensagem é muito longa (máximo 2000 caracteres)." }, { status: 400 });
    }

    const { error } = await supabase
      .from("feedback")
      .insert({
        professor_id: user.id,
        professor_email: user.email ?? "desconhecido",
        mensagem,
        url_contexto,
      });

    if (error) {
      console.error("[FEEDBACK] erro ao inserir:", error);
      return NextResponse.json({ error: "Não foi possível enviar seu relato. Tente novamente." }, { status: 500 });
    }

    console.log(`[FEEDBACK] recebido: email=${user.email}, url=${url_contexto}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[FEEDBACK] erro inesperado:", error);
    return NextResponse.json({ error: "Não foi possível enviar seu relato. Tente novamente." }, { status: 500 });
  }
}