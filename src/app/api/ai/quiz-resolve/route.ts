import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ResolveQuizRequest {
  subject_id: string;
  topic_id: string | null;
  default_time_seconds: number;
  questions: {
    subject_id: string;
    topic_id: string | null;
    subtopic: string;
  }[];
}

function isValidUuid(v: string | null | undefined): boolean {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function humanizeSlug(slug: string): string {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "Geral";
}

function logError(context: string, error: any) {
  console.error(`[AI RESOLVE] ${context}:`, JSON.stringify({
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  }, null, 2));
}

/**
 * Read-only subject resolution: returns map of rawId -> { id | null, needsCreate: boolean, createName? }
 */
async function resolveSubjects(
  supabase: any,
  rawIds: (string | null)[],
  teacherId: string,
): Promise<Map<string, { id: string | null; needsCreate: boolean; createName?: string }>> {
  const result = new Map<string, { id: string | null; needsCreate: boolean; createName?: string }>();
  const uuidsToCheck = new Set<string>();
  const namesToCheck = new Map<string, string>();

  for (const raw of rawIds) {
    if (!raw || result.has(raw)) continue;
    if (isValidUuid(raw)) {
      uuidsToCheck.add(raw);
    } else {
      const normalized = (raw.length < 60 ? humanizeSlug(raw) : raw.slice(0, 60)).toLowerCase().trim();
      if (!namesToCheck.has(normalized)) namesToCheck.set(normalized, raw);
    }
  }

  // 1. Batch check existing UUIDs
  if (uuidsToCheck.size > 0) {
    const { data, error } = await supabase.from("subjects").select("id").in("id", [...uuidsToCheck]);
    if (error) logError("resolveSubjects:select_uuids", error);
    if (data) {
      for (const row of data) result.set(row.id, { id: row.id, needsCreate: false });
    }
  }

  // 2. Batch check existing names (teacher-owned + global)
  if (namesToCheck.size > 0) {
    const { data, error } = await supabase.from("subjects").select("id, name, teacher_id");
    if (error) logError("resolveSubjects:select_names", error);
    if (data) {
      for (const row of data) {
        const normalizedName = row.name.toLowerCase().trim();
        const rawId = namesToCheck.get(normalizedName);
        if (rawId) {
          // Prefer teacher-owned over global
          if (!result.has(rawId) || row.teacher_id === teacherId) {
            result.set(rawId, { id: row.id, needsCreate: false });
          }
        }
      }
    }
  }

  // 3. Mark unresolved names as needing creation
  for (const [normalized, raw] of namesToCheck) {
    if (!result.has(raw)) {
      const createName = raw.length < 60 ? humanizeSlug(raw) : raw.slice(0, 60);
      result.set(raw, { id: null, needsCreate: true, createName });
    }
  }

  // Mark unresolved UUIDs as needing creation (hallucinated by AI)
  const unresolvedUuids = [...uuidsToCheck].filter((id) => !result.has(id));
  for (const id of unresolvedUuids) {
    result.set(id, { id: null, needsCreate: true, createName: undefined });
  }

  return result;
}

/**
 * Read-only topic resolution: returns map of key -> { id | null, needsCreate: boolean, createName?, subjectId? }
 */
async function resolveTopics(
  supabase: any,
  entries: { key: string; subjectId: string | null; topicName: string; rawTopicId: string | null }[],
): Promise<Map<string, { id: string | null; needsCreate: boolean; createName?: string; subjectId?: string }>> {
  const result = new Map<string, { id: string | null; needsCreate: boolean; createName?: string; subjectId?: string }>();
  const uuidsToCheck = new Set<string>();
  const toLookup: { key: string; subjectId: string; topicName: string }[] = [];

  const uniqueEntries = new Map<string, (typeof entries)[0]>();
  for (const e of entries) {
    if (!uniqueEntries.has(e.key)) uniqueEntries.set(e.key, e);
  }

  for (const e of uniqueEntries.values()) {
    if (result.has(e.key)) continue;
    if (e.rawTopicId && isValidUuid(e.rawTopicId)) {
      uuidsToCheck.add(e.rawTopicId);
    } else if (e.subjectId && e.topicName) {
      toLookup.push({ key: e.key, subjectId: e.subjectId, topicName: e.topicName.slice(0, 80) });
    }
  }

  // 1. Batch check existing UUIDs
  if (uuidsToCheck.size > 0) {
    const { data, error } = await supabase.from("topics").select("id").in("id", [...uuidsToCheck]);
    if (error) logError("resolveTopics:select_uuids", error);
    if (data) {
      for (const row of data) {
        for (const e of uniqueEntries.values()) {
          if (e.rawTopicId === row.id) result.set(e.key, { id: row.id, needsCreate: false });
        }
      }
    }
  }

  // 2. Batch check existing names by subject
  const subjectIds = [...new Set(toLookup.filter((t) => !result.has(t.key)).map((t) => t.subjectId))];
  if (subjectIds.length > 0) {
    const { data, error } = await supabase.from("topics").select("id, name, subject_id").in("subject_id", subjectIds);
    if (error) logError("resolveTopics:select_names", error);
    if (data) {
      const existingMap = new Map<string, string>();
      for (const row of data) {
        existingMap.set(`${row.subject_id}|${row.name.toLowerCase().trim()}`, row.id);
      }
      for (const t of toLookup) {
        if (result.has(t.key)) continue;
        const lookupKey = `${t.subjectId}|${t.topicName.toLowerCase().trim()}`;
        const existingId = existingMap.get(lookupKey);
        if (existingId) result.set(t.key, { id: existingId, needsCreate: false });
      }
    }
  }

  // 3. Mark unresolved topics as needing creation
  for (const t of toLookup) {
    if (!result.has(t.key)) {
      result.set(t.key, { id: null, needsCreate: true, createName: t.topicName, subjectId: t.subjectId });
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  const requestId = `resolve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body: ResolveQuizRequest = await request.json();
    const { questions, ...quizData } = body;

    console.log(`[AI RESOLVE] ${requestId} start: user=${user.id}, questions=${questions.length}`);

    // --- Resolve subjects (read-only) ---
    const allSubjectRawIds = [
      quizData.subject_id,
      ...questions.map((q) => q.subject_id),
    ];
    const subjectMap = await resolveSubjects(supabase, allSubjectRawIds, user.id);
    const finalQuizSubjectId = subjectMap.get(quizData.subject_id)?.id ?? null;

    // --- Resolve topics (read-only) ---
    const topicEntries = [
      {
        key: `quiz|${quizData.topic_id}|${quizData.subject_id}`,
        subjectId: finalQuizSubjectId,
        topicName: "",
        rawTopicId: quizData.topic_id,
      },
      ...questions.map((q) => {
        const resolvedSubject = subjectMap.get(q.subject_id)?.id ?? finalQuizSubjectId;
        return {
          key: `q|${q.topic_id}|${q.subtopic}|${resolvedSubject}`,
          subjectId: resolvedSubject,
          topicName: q.subtopic || "",
          rawTopicId: q.topic_id,
        };
      }),
    ];
    const topicMap = await resolveTopics(supabase, topicEntries);

    // Build subject resolution summary
    const subjectsToCreate: { raw: string; name: string }[] = [];
    const subjectIdMap: Record<string, string> = {};
    for (const [raw, info] of subjectMap) {
      if (info.needsCreate && info.createName) {
        subjectsToCreate.push({ raw, name: info.createName });
      } else if (info.id) {
        subjectIdMap[raw] = info.id;
      }
    }

    // Build topic resolution summary
    const topicsToCreate: { key: string; name: string; subjectId: string }[] = [];
    const topicIdMap: Record<string, string> = {};
    for (const [key, info] of topicMap) {
      if (info.needsCreate && info.createName && info.subjectId) {
        topicsToCreate.push({ key, name: info.createName, subjectId: info.subjectId });
      } else if (info.id) {
        topicIdMap[key] = info.id;
      }
    }

    console.log(`[AI RESOLVE] ${requestId} done: ${subjectIdMap.length} existing subjects, ${subjectsToCreate.length} to create, ${topicIdMap.length} existing topics, ${topicsToCreate.length} to create`);

    return NextResponse.json({
      subjectIdMap,
      subjectsToCreate,
      topicIdMap,
      topicsToCreate,
      finalQuizSubjectId,
    });
  } catch (error) {
    logError(`${requestId} unhandled`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}
