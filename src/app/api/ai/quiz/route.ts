import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const DAILY_LIMIT = parseInt(process.env.AI_QUIZ_DAILY_LIMIT ?? "12", 10);

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ChatMessage { role: "user" | "assistant"; content: string; }
interface QuizGenerationRequest { messages: ChatMessage[]; teacherId: string; existingSubjects: { id: string; name: string }[]; existingTopics: { id: string; name: string; subject_id: string }[]; }
interface GeneratedQuiz { title: string; description: string; subject_id: string; topic_id: string | null; default_time_seconds: number; questions: GeneratedQuestion[]; }
interface GeneratedQuestion { statement: string; options: [string, string, string, string]; correct_index: number; subject_id: string; topic_id: string | null; subtopic: string; difficulty: "facil" | "media" | "dificil"; time_override_seconds: number | null; image_url: string; }

function buildSystemPrompt(existingSubjects: { id: string; name: string }[], existingTopics: { id: string; name: string; subject_id: string }[]): string {
  const subjectsList = existingSubjects.map((s) => `- ${s.name} (id: ${s.id})`).join("\n");
  const topicsList = existingTopics.map((t) => `- ${t.name} (id: ${t.id}, subject: ${t.subject_id})`).join("\n");
  return `Você é um assistente especializado em criar quizzes educacionais de alta qualidade para professores brasileiros.
REGRAS CRÍTICAS:
1. SEMPRE responda APENAS com JSON válido no formato especificado. NÃO inclua texto fora do JSON.
2. Cada questão DEVE ter exatamente 4 alternativas, exatamente 1 correta (índice 0-3).
3. Para cálculo/matemática, VERIFIQUE se a alternativa correta está matematicamente correta.
4. TEMAS: Cada questão DEVE ter tema específico (ex: "Frações", "Equações do 1º grau"). NUNCA genérico como "Matemática".
5. Dificuldade: apenas "facil", "media" ou "dificil".
6. Tempo: null ou 5-600 segundos.
7. Máximo 30 questões.
8. Se não conseguir gerar questão válida, descarte-a e informe.

DISCIPLINAS EXISTENTES:
${subjectsList}
TEMAS EXISTENTES:
${topicsList}
FORMATO SAIDA JSON:
{"quiz":{"title":"string","description":"string","subject_id":"uuid","topic_id":"uuid ou null","default_time_seconds":30,"questions":[{"statement":"Enunciado","options":["A","B","C","D"],"correct_index":0,"subject_id":"uuid","topic_id":"uuid ou null","subtopic":"Tema específico","difficulty":"facil|media|dificil","time_override_seconds":null,"image_url":""}]},"warnings":["aviso opcional"]}`;
}

function shuffleOptions(options: [string, string, string, string], correctIndex: number): { options: [string, string, string, string]; correctIndex: number } {
  const pairs: [string, number][] = options.map((opt, i) => [opt, i === correctIndex ? 1 : 0]);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const shuffled = pairs.map((p) => p[0]) as [string, string, string, string];
  const newCorrect = pairs.findIndex((p) => p[1] === 1);
  return { options: shuffled, correctIndex: newCorrect };
}

function parseJSONResponse(text: string): { quiz: GeneratedQuiz; warnings: string[] } | null {
  try {
    const cleaned = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.quiz || !parsed.quiz.questions || !Array.isArray(parsed.quiz.questions)) return null;
    return { quiz: parsed.quiz, warnings: parsed.warnings ?? [] };
  } catch { return null; }
}

async function validateQuestion(question: GeneratedQuestion): Promise<{ valid: boolean; error?: string }> {
  if (!question.statement || question.statement.trim().length < 5) return { valid: false, error: "Enunciado muito curto ou vazio" };
  if (!question.options || question.options.length !== 4) return { valid: false, error: "Deve ter exatamente 4 alternativas" };
  if (question.options.some((opt) => !opt || opt.trim().length === 0)) return { valid: false, error: "Alternativa vazia" };
  if (question.correct_index < 0 || question.correct_index > 3) return { valid: false, error: "Índice de correta inválido" };
  if (!["facil", "media", "dificil"].includes(question.difficulty)) return { valid: false, error: "Dificuldade inválida" };
  if (question.topic_id === "") question.topic_id = null;
  if (!question.subtopic || question.subtopic.trim().length === 0) return { valid: false, error: "Tema/subtópico vazio" };
  return { valid: true };
}

async function callGemini(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // [PASSO 1] schema compatível com Gemini: apenas type/properties/required/enum/items - sem nullable/minimum/maximum/minItems/maxItems
  const responseSchema = {
    type: "OBJECT",
    properties: {
      quiz: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          subject_id: { type: "STRING" },
          topic_id: { type: "STRING" },
          default_time_seconds: { type: "INTEGER" },
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                statement: { type: "STRING" },
                options: { type: "ARRAY", items: { type: "STRING" } },
                correct_index: { type: "INTEGER" },
                subject_id: { type: "STRING" },
                topic_id: { type: "STRING" },
                subtopic: { type: "STRING" },
                difficulty: { type: "STRING", enum: ["facil", "media", "dificil"] },
                time_override_seconds: { type: "INTEGER" },
                image_url: { type: "STRING" },
              },
              required: ["statement","options","correct_index","subject_id","subtopic","difficulty","image_url"],
            },
          },
        },
        required: ["title","description","subject_id","default_time_seconds","questions"],
      },
      warnings: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["quiz","warnings"],
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: responseSchema as any,
    },
  });
  return (response as any).text ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const body: QuizGenerationRequest = await request.json();
    const { messages, existingSubjects, existingTopics } = body;
    if (!messages || messages.length === 0) return NextResponse.json({ error: "Mensagens vazias" }, { status: 400 });

    // Limite diário: só conta gerações efetivas (antes da chamada já verifica para não consumir cota do Gemini à toa)
    const today = getTodayDateStr();
    const { data: usageRow } = await supabase.from("ai_generation_usage").select("count").eq("professor_id", user.id).eq("usage_date", today).maybeSingle();
    const currentCount = usageRow?.count ?? 0;
    if (currentCount >= DAILY_LIMIT) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
      const hoursLeft = Math.ceil((tomorrow.getTime() - Date.now()) / 3600000);
      return NextResponse.json({ error: `Você atingiu o limite de ${DAILY_LIMIT} quizzes gerados por IA hoje. O limite renova em ${hoursLeft}h (à meia-noite). Você ainda pode criar quizzes manualmente.`, limit: DAILY_LIMIT, used: currentCount }, { status: 429 });
    }

    const systemPrompt = buildSystemPrompt(existingSubjects, existingTopics);
    const responseText = await callGemini(messages, systemPrompt);
    const parsed = parseJSONResponse(responseText);
    if (!parsed) return NextResponse.json({ error: "Resposta da IA inválida. Tente novamente." }, { status: 500 });
    const validatedQuestions: GeneratedQuestion[] = [];
    const warnings: string[] = [];
    for (let i = 0; i < parsed.quiz.questions.length; i++) {
      const q = parsed.quiz.questions[i];
      const validation = await validateQuestion(q);
      if (validation.valid) validatedQuestions.push(q);
      else warnings.push(`Questão ${i + 1} descartada: ${validation.error}`);
    }
    if (validatedQuestions.length === 0) return NextResponse.json({ error: "Nenhuma questão válida foi gerada. Tente reformular o pedido." }, { status: 400 });

    // Shuffle alternativas para evitar viés de posição
    const shuffledQuestions = validatedQuestions.map((q) => {
      const { options, correctIndex } = shuffleOptions(q.options, q.correct_index);
      return { ...q, options, correct_index: correctIndex };
    });
    console.log(`[AI SHUFFLE] Generated ${shuffledQuestions.length} questions, correct_index distribution:`, shuffledQuestions.map(q => q.correct_index));

    // Incrementa contador apenas em geração efetiva
    const newCount = currentCount + 1;
    const { error: usageError } = await supabase.from("ai_generation_usage").upsert({ professor_id: user.id, usage_date: today, count: newCount }, { onConflict: "professor_id,usage_date" });
    if (usageError) console.error("[AI USAGE] erro ao incrementar", usageError);
    else console.log(`[AI USAGE] ${user.id} ${today} ${newCount}/${DAILY_LIMIT}`);
    return NextResponse.json({ quiz: { ...parsed.quiz, questions: shuffledQuestions }, warnings, generatedCount: shuffledQuestions.length, requestedCount: parsed.quiz.questions.length, usage: { used: newCount, limit: DAILY_LIMIT } });
  } catch (error) {
    console.error("Erro na geração de quiz por IA:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate limit")) return NextResponse.json({ error: "Muitas gerações agora. Tente novamente em alguns minutos." }, { status: 429 });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const today = getTodayDateStr();
    const { data: row } = await supabase.from("ai_generation_usage").select("count").eq("professor_id", user.id).eq("usage_date", today).maybeSingle();
    return NextResponse.json({ used: row?.count ?? 0, limit: DAILY_LIMIT, date: today });
  } catch (e) {
    return NextResponse.json({ used: 0, limit: DAILY_LIMIT });
  }
}
