import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface CreateQuizRequest {
  title: string;
  description: string;
  subject_id: string;
  topic_id: string | null;
  default_time_seconds: number;
  show_ranking: boolean;
  show_score: boolean;
  show_correct_answers: boolean;
  is_shared: boolean;
  questions: {
    statement: string;
    options: [string, string, string, string];
    correct_index: number;
    subject_id: string;
    topic_id: string | null;
    subtopic: string;
    difficulty: "facil" | "media" | "dificil";
    time_override_seconds: number | null;
    image_url: string;
  }[];
}

function isValidUuid(v: string | null | undefined): boolean {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function humanizeSlug(slug: string): string {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Geral";
}

function logError(context: string, error: any) {
  console.error(`[AI SAVE] ${context}:`, JSON.stringify({
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
    name: error?.name,
  }, null, 2));
}

/**
 * Busca subjects do banco em lote.
 * A tabela subjects tem UNIQUE GLOBAL em name — checa todos os professores + globais.
 */
async function batchResolveSubjects(
  supabase: any,
  rawIds: (string | null)[],
  teacherId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uuidsToCheck = new Set<string>();
  const namesToCheck = new Map<string, string>(); // normalizedName -> rawId

  for (const raw of rawIds) {
    if (!raw || result.has(raw)) continue;
    if (isValidUuid(raw)) {
      uuidsToCheck.add(raw);
    } else {
      const normalized = (raw.length < 60 ? humanizeSlug(raw) : raw.slice(0, 60)).toLowerCase().trim();
      if (!namesToCheck.has(normalized)) namesToCheck.set(normalized, raw);
    }
  }

  console.log(`[AI SAVE] batchResolveSubjects input: ${rawIds.length} rawIds, ${uuidsToCheck.size} uuids, ${namesToCheck.size} names`);

  // 1. Batch check existing UUIDs
  if (uuidsToCheck.size > 0) {
    const { data, error } = await supabase.from("subjects").select("id").in("id", [...uuidsToCheck]);
    if (error) logError("batchResolveSubjects:select_uuids", error);
    if (data) {
      for (const row of data) result.set(row.id, row.id);
    }
    // Find UUIDs that weren't found — they may be hallucinated by the AI
    const unresolvedUuids = [...uuidsToCheck].filter((id) => !result.has(id));
    if (unresolvedUuids.length > 0) {
      console.log(`[AI SAVE] batchResolveSubjects: ${unresolvedUuids.length} UUIDs not found in DB, will try name fallback`);
      for (const id of unresolvedUuids) {
        // Try to find by ID with name — if the AI hallucinated a UUID, we can't recover by name
        // because we don't have the name. Add a placeholder so we can report it clearly.
        // The caller will need to handle this.
        console.log(`[AI SAVE] batchResolveSubjects: unresolved UUID "${id}" — no name available for fallback`);
      }
    }
    console.log(`[AI SAVE] batchResolveSubjects uuid lookup: found ${data?.length ?? 0}/${uuidsToCheck.size}`);
  }

  // 2. Batch check existing names (GLOBAL — any teacher or null teacher_id)
  if (namesToCheck.size > 0) {
    const { data, error } = await supabase.from("subjects").select("id, name");
    if (error) logError("batchResolveSubjects:select_names", error);
    if (data) {
      for (const row of data) {
        const normalizedName = row.name.toLowerCase().trim();
        const rawId = namesToCheck.get(normalizedName);
        if (rawId) result.set(rawId, row.id);
      }
    }
    const unmatchedNames = [...namesToCheck].filter(([n]) => !data?.some((r: any) => r.name.toLowerCase().trim() === n));
    if (unmatchedNames.length > 0) {
      console.log(`[AI SAVE] batchResolveSubjects: ${unmatchedNames.length} names not found, will create:`, unmatchedNames.map(([n, raw]) => `"${raw}" (normalized: "${n}")`));
    }
  }

  // 3. Create missing subjects (sequentially, with error handling per item)
  for (const [normalized, raw] of namesToCheck) {
    if (result.has(raw)) continue;
    const name = raw.length < 60 ? humanizeSlug(raw) : raw.slice(0, 60);
    console.log(`[AI SAVE] batchResolveSubjects creating: "${name}" (raw="${raw}")`);
    const { data: created, error: createErr } = await supabase
      .from("subjects")
      .insert({ teacher_id: teacherId, name })
      .select("id")
      .single();
    if (createErr) {
      if (createErr.code === "23505") {
        console.log(`[AI SAVE] batchResolveSubjects unique violation for "${name}", searching existing...`);
        const { data: existing } = await supabase.from("subjects").select("id").ilike("name", name).single();
        if (existing) {
          console.log(`[AI SAVE] batchResolveSubjects found existing after 23505: ${existing.id}`);
          result.set(raw, existing.id);
          continue;
        }
        console.log(`[AI SAVE] batchResolveSubjects 23505 but no existing found for "${name}"`);
      }
      logError(`batchResolveSubjects:create:${name}`, createErr);
    }
    if (created) {
      console.log(`[AI SAVE] batchResolveSubjects created: "${name}" -> ${created.id}`);
      result.set(raw, created.id);
    }
  }

  // Report any unresolved entries
  const unresolved = rawIds.filter((raw) => raw && !result.has(raw));
  if (unresolved.length > 0) {
    console.error(`[AI SAVE] batchResolveSubjects UNRESOLVED:`, unresolved);
  }

  return result;
}

/**
 * Busca topics do banco em lote.
 * topics tem UNIQUE(subject_id, name) — checa por subject+nome.
 */
async function batchResolveTopics(
  supabase: any,
  entries: { key: string; subjectId: string | null; topicName: string; rawTopicId: string | null }[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uuidsToCheck = new Set<string>();
  const toCreate: { key: string; subjectId: string; name: string }[] = [];

  // Deduplicate entries by key
  const uniqueEntries = new Map<string, (typeof entries)[0]>();
  for (const e of entries) {
    if (!uniqueEntries.has(e.key)) uniqueEntries.set(e.key, e);
  }

  for (const e of uniqueEntries.values()) {
    if (result.has(e.key)) continue;
    if (e.rawTopicId && isValidUuid(e.rawTopicId)) {
      uuidsToCheck.add(e.rawTopicId);
    } else if (e.subjectId && e.topicName) {
      toCreate.push({ key: e.key, subjectId: e.subjectId, name: e.topicName.slice(0, 80) });
    }
  }

  // 1. Batch check existing UUIDs
  if (uuidsToCheck.size > 0) {
    const { data, error } = await supabase.from("topics").select("id").in("id", [...uuidsToCheck]);
    if (error) logError("batchResolveTopics:select_uuids", error);
    if (data) {
      for (const row of data) {
        for (const e of uniqueEntries.values()) {
          if (e.rawTopicId === row.id) result.set(e.key, row.id);
        }
      }
    }
  }

  // 2. Batch check existing names by subject
  const subjectIds = [...new Set(toCreate.filter((t) => !result.has(t.key)).map((t) => t.subjectId))];
  if (subjectIds.length > 0) {
    const { data, error } = await supabase.from("topics").select("id, name, subject_id").in("subject_id", subjectIds);
    if (error) logError("batchResolveTopics:select_names", error);
    if (data) {
      // Build lookup: subjectId|normalizedName -> topicId
      const existingMap = new Map<string, string>();
      for (const row of data) {
        existingMap.set(`${row.subject_id}|${row.name.toLowerCase().trim()}`, row.id);
      }
      for (const t of toCreate) {
        if (result.has(t.key)) continue;
        const lookupKey = `${t.subjectId}|${t.name.toLowerCase().trim()}`;
        const existingId = existingMap.get(lookupKey);
        if (existingId) result.set(t.key, existingId);
      }
    }
  }

  // 3. Create missing topics (deduplicated by subjectId+name)
  const toCreateDeduped = new Map<string, { key: string; subjectId: string; name: string }>();
  for (const t of toCreate) {
    if (result.has(t.key)) continue;
    const dedupeKey = `${t.subjectId}|${t.name.toLowerCase().trim()}`;
    if (!toCreateDeduped.has(dedupeKey)) toCreateDeduped.set(dedupeKey, t);
  }

  for (const t of toCreateDeduped.values()) {
    const { data: created, error: createErr } = await supabase
      .from("topics")
      .insert({ subject_id: t.subjectId, name: t.name })
      .select("id")
      .single();
    if (createErr) {
      // Unique violation = concurrent insert or race; find existing
      if (createErr.code === "23505") {
        const { data: existing } = await supabase
          .from("topics")
          .select("id")
          .eq("subject_id", t.subjectId)
          .ilike("name", t.name)
          .single();
        if (existing) {
          result.set(t.key, existing.id);
          continue;
        }
      }
      logError(`batchResolveTopics:create:${t.name}`, createErr);
    }
    if (created) {
      // Map ALL entries that share this subject+name to the created ID
      const lookupKey = `${t.subjectId}|${t.name.toLowerCase().trim()}`;
      for (const e of uniqueEntries.values()) {
        if (e.subjectId === t.subjectId && e.topicName?.toLowerCase().trim() === t.name.toLowerCase().trim()) {
          result.set(e.key, created.id);
        }
      }
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Safety net: ensure profile exists (trigger may have failed during signup)
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!profile) {
      console.log(`[AI SAVE] ${requestId} profile missing for user ${user.id}, creating...`);
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || "Professor",
        email: user.email,
        school: user.user_metadata?.school || null,
        role: "professor",
      });
      if (profileErr) {
        logError(`${requestId} profileCreate`, profileErr);
        return NextResponse.json({ error: "Erro ao criar perfil do professor" }, { status: 500 });
      }
    }

    const body: CreateQuizRequest = await request.json();
    const { questions, ...quizData } = body;

    console.log(`[AI SAVE] ${requestId} start: user=${user.id}, questions=${questions.length}, title="${quizData.title}"`);

    // Service-role client bypasses RLS for batch subject/topic resolution
    // (RLS restricts visibility to own + global subjects, but we need to see all for resolution)
    const svcClient = createServiceClient();

    // --- Batch resolve subjects ---
    const allSubjectRawIds = [
      quizData.subject_id,
      ...questions.map((q) => q.subject_id),
    ];
    const subjectMap = await batchResolveSubjects(svcClient, allSubjectRawIds, user.id);
    const finalQuizSubjectId = subjectMap.get(quizData.subject_id) ?? null;

    console.log(`[AI SAVE] ${requestId} subjects resolved: ${subjectMap.size} entries, quiz subject=${finalQuizSubjectId}`);

    // --- Batch resolve topics ---
    const topicEntries = [
      {
        key: `quiz|${quizData.topic_id}|${quizData.subject_id}`,
        subjectId: finalQuizSubjectId,
        topicName: "",
        rawTopicId: quizData.topic_id,
      },
      ...questions.map((q) => {
        const resolvedSubject = subjectMap.get(q.subject_id) ?? finalQuizSubjectId;
        return {
          key: `q|${q.topic_id}|${q.subtopic}|${resolvedSubject}`,
          subjectId: resolvedSubject,
          topicName: q.subtopic || "",
          rawTopicId: q.topic_id,
        };
      }),
    ];
    const topicMap = await batchResolveTopics(svcClient, topicEntries);
    const finalQuizTopicId = topicMap.get(`quiz|${quizData.topic_id}|${quizData.subject_id}`) ?? null;

    console.log(`[AI SAVE] ${requestId} topics resolved: ${topicMap.size} entries, quiz topic=${finalQuizTopicId}`);

    // --- Normalize questions ---
    const normalizedQuestions = questions.map((q) => {
      const qSubjectId = subjectMap.get(q.subject_id) ?? finalQuizSubjectId;
      const resolvedSubject = qSubjectId ?? finalQuizSubjectId;
      const qTopicId = topicMap.get(`q|${q.topic_id}|${q.subtopic}|${resolvedSubject}`) ?? null;
      return {
        ...q,
        subject_id: qSubjectId,
        topic_id: qTopicId,
        difficulty: (q.difficulty || "media").toLowerCase() as "facil" | "media" | "dificil",
        time_override_seconds: q.time_override_seconds ?? quizData.default_time_seconds ?? 30,
      };
    });

    // Check for null subject_id (would cause FK violation)
    const nullSubjects = normalizedQuestions.filter((q) => !q.subject_id);
    if (nullSubjects.length > 0) {
      const nullDetails = nullSubjects.map((q) => ({
        statement: q.statement?.slice(0, 80),
        original_subject_id: questions[normalizedQuestions.indexOf(q)]?.subject_id,
      }));
      console.error(`[AI SAVE] ${requestId} FAIL: ${nullSubjects.length} questions have null subject_id after resolution:`, nullDetails);
      return NextResponse.json({ error: `Erro interno: disciplina não resolvida para ${nullSubjects.length} questão(ões). Tente novamente.`, details: nullDetails }, { status: 500 });
    }

    // 1. Criar o quiz
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        title: quizData.title,
        description: quizData.description,
        subject_id: finalQuizSubjectId,
        topic_id: finalQuizTopicId,
        default_time_seconds: quizData.default_time_seconds,
        show_ranking: quizData.show_ranking,
        show_score: quizData.show_score,
        show_correct_answers: quizData.show_correct_answers,
        is_shared: quizData.is_shared,
        teacher_id: user.id,
        status: "rascunho",
      })
      .select("id")
      .single();

    if (quizError || !quiz) {
      logError(`${requestId} quizInsert`, quizError);
      return NextResponse.json({ error: "Erro ao criar quiz", details: quizError }, { status: 500 });
    }

    const quizId = quiz.id;
    console.log(`[AI SAVE] ${requestId} quiz created: ${quizId}`);

    // 2. Criar questões em lote (alternativas já embaralhadas no endpoint de geração)
    const questionsToInsert = normalizedQuestions.map((q) => {
      return {
        teacher_id: user.id,
        subject_id: q.subject_id,
        topic_id: q.topic_id,
        subtopic: q.subtopic,
        statement: q.statement,
        options: q.options,
        correct_index: q.correct_index,
        difficulty: q.difficulty,
        time_override_seconds: q.time_override_seconds,
        image_url: q.image_url ?? null,
      };
    });
    console.log(`[AI SAVE] ${requestId} questions to insert: correct_index distribution:`, questionsToInsert.map(q => q.correct_index));

    const { data: createdQuestions, error: questionsError } = await supabase
      .from("questions")
      .insert(questionsToInsert)
      .select("id");

    if (questionsError || !createdQuestions) {
      logError(`${requestId} questionsInsert`, questionsError);
      await supabase.from("quizzes").delete().eq("id", quizId);
      return NextResponse.json({ error: "Erro ao criar questões", details: questionsError }, { status: 500 });
    }

    console.log(`[AI SAVE] ${requestId} questions created: ${createdQuestions.length}`);

    // 3. Vincular questões ao quiz
    const quizQuestions = createdQuestions.map((q, index) => ({
      quiz_id: quizId,
      question_id: q.id,
      position: index + 1,
    }));

    const { error: linkError } = await supabase
      .from("quiz_questions")
      .insert(quizQuestions);

    if (linkError) {
      logError(`${requestId} linkInsert`, linkError);
      await supabase.from("questions").delete().in("id", createdQuestions.map((q) => q.id));
      await supabase.from("quizzes").delete().eq("id", quizId);
      return NextResponse.json({ error: "Erro ao vincular questões ao quiz", details: linkError }, { status: 500 });
    }

    console.log(`[AI SAVE] ${requestId} SUCCESS: quizId=${quizId}, questions=${createdQuestions.length}`);
    return NextResponse.json({ id: quizId, isAiGenerated: true });
  } catch (error) {
    logError(`${requestId} unhandled`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("id");
    if (!quizId) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id, subject_id, topic_id")
      .eq("id", quizId)
      .eq("teacher_id", user.id)
      .single();

    if (!quiz) return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });

    const { data: qqRows } = await supabase
      .from("quiz_questions")
      .select("question_id")
      .eq("quiz_id", quizId);

    const questionIds = qqRows?.map((r) => r.question_id) ?? [];

    let questionSubjects: string[] = [];
    let questionTopics: string[] = [];
    if (questionIds.length > 0) {
      const { data: qData } = await supabase
        .from("questions")
        .select("subject_id, topic_id")
        .in("id", questionIds);
      if (qData) {
        questionSubjects = [...new Set(qData.map((q) => q.subject_id).filter(Boolean))];
        questionTopics = [...new Set(qData.map((q) => q.topic_id).filter(Boolean))];
      }
    }

    await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);
    if (questionIds.length > 0) {
      await supabase.from("questions").delete().in("id", questionIds);
    }
    await supabase.from("quizzes").delete().eq("id", quizId);

    // Clean orphaned subjects (only if not used elsewhere)
    for (const sid of questionSubjects) {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("subject_id", sid);
      if (count === 0 && sid !== quiz.subject_id) {
        await supabase.from("subjects").delete().eq("id", sid);
      }
    }
    if (quiz.subject_id) {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("subject_id", quiz.subject_id);
      if (count === 0) {
        const { count: quizCount } = await supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("subject_id", quiz.subject_id);
        if (quizCount === 0) await supabase.from("subjects").delete().eq("id", quiz.subject_id);
      }
    }

    // Clean orphaned topics
    for (const tid of questionTopics) {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", tid);
      if (count === 0 && tid !== quiz.topic_id) {
        await supabase.from("topics").delete().eq("id", tid);
      }
    }
    if (quiz.topic_id) {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", quiz.topic_id);
      if (count === 0) {
        const { count: quizCount } = await supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("topic_id", quiz.topic_id);
        if (quizCount === 0) await supabase.from("topics").delete().eq("id", quiz.topic_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("delete", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}
