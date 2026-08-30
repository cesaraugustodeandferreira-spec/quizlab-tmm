"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { IconSparkles, IconX, IconSend, IconLoader, IconCheck, IconAlertCircle, IconTrash } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface AIQuizMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?: "text" | "status" | "result" | "error";
  timestamp: number;
}

interface GeneratedQuizData {
  title: string;
  description: string;
  subject_id: string;
  topic_id: string | null;
  default_time_seconds: number;
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

interface SubjectsTopics {
  subjects: { id: string; name: string }[];
  topics: { id: string; name: string; subject_id: string }[];
}

const markdownComponents: any = {
  p: (props: any) => <p className="mb-2 text-sm leading-relaxed last:mb-0">{props.children}</p>,
  strong: (props: any) => <strong className="font-semibold">{props.children}</strong>,
  em: (props: any) => <em className="italic">{props.children}</em>,
  ul: (props: any) => <ul className="my-2 list-disc space-y-1 pl-5 text-sm">{props.children}</ul>,
  ol: (props: any) => <ol className="my-2 list-decimal space-y-1 pl-5 text-sm">{props.children}</ol>,
  li: (props: any) => <li className="text-sm leading-relaxed">{props.children}</li>,
};

export function AIQuizModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<AIQuizMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subjectsTopics, setSubjectsTopics] = useState<{ subjects: { id: string; name: string }[]; topics: { id: string; name: string; subject_id: string }[] } | null>(null);
  const [generatedQuiz, setGeneratedQuiz] = useState<GeneratedQuizData | null>(null);
  const [generationStage, setGenerationStage] = useState<"idle" | "generating" | "validating" | "complete" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedQuizId, setSavedQuizId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number; globalUsed: number; globalLimit: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveAbortRef = useRef<AbortController | null>(null);
  const timeoutWarningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phraseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const loadingPhrases = [
    "Começando...",
    "Escrevendo as questões...",
    "Conferindo as contas e embaralhando as respostas...",
    "Organizando disciplinas e temas...",
    "Fazendo os ajustes finais...",
    "Só mais um segundo...",
    "Quase lá...",
  ];

  const startPhraseLoop = useCallback(() => {
    setPhraseIndex(0);
    phraseIntervalRef.current = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2500);
  }, [loadingPhrases.length]);

  const stopPhraseLoop = useCallback(() => {
    if (phraseIntervalRef.current) {
      clearInterval(phraseIntervalRef.current);
      phraseIntervalRef.current = null;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
      stopPhraseLoop();
    };
  }, [stopPhraseLoop]);

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/ai/quiz");
      if (res.ok) {
        const data = await res.json();
        setUsage({ used: data.used, limit: data.limit, globalUsed: data.globalUsed ?? 0, globalLimit: data.globalLimit ?? 18 });
      }
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setGeneratedQuiz(null);
    setGenerationStage("idle");
    setSaveStatus("idle");
    setSavedQuizId(null);
    setError(null);
    fetchSubjectsTopics();
    fetchUsage();
    const welcomeMsg: AIQuizMessage = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: `Olá! Eu posso criar um quiz completo a partir da sua descrição.

**Como funciona:** você me diz o que precisa e eu gero o quiz com questões, alternativas, gabarito, temas por questão e níveis de dificuldade.

**Exemplos de como pedir:**
- "Crie um quiz de matemática pro 7º ano com 15 questões sobre frações, dificuldade média, 30 segundos por questão"
- "Quiz de história sobre Revolução Francesa, 10 questões, misturar fácil e médio"
- "Crie um quiz de português com 20 questões: 10 de concordância verbal, 10 de regência, dificuldade média"

**O que eu preciso saber (o mínimo):**
1. Disciplina
2. Tema/assunto principal
3. Quantidade de questões

O resto (dificuldade, tempo, distribuição) eu preencho com padrões razoáveis se você não especificar.

Como posso ajudar?`,
      type: "text",
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
  }, [open]);

  const fetchSubjectsTopics = async () => {
    try {
      const res = await fetch("/api/ai/subjects-topics");
      if (res.ok) {
        const data = await res.json();
        setSubjectsTopics(data);
      }
    } catch {
      // Silencioso - não bloqueia o chat
    }
  };

  const autoSaveQuiz = useCallback(async (quiz: GeneratedQuizData) => {
    setSaveStatus("saving");

    // Mostrar aviso após 8s se ainda estiver salvando
    timeoutWarningRef.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `save-warning-${Date.now()}`,
          role: "assistant",
          content: "Ainda organizando as questões, só mais um instante...",
          type: "status",
          timestamp: Date.now(),
        },
      ]);
    }, 8000);

    try {
      const res = await fetch("/api/ai/quiz-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quiz.title,
          description: quiz.description,
          subject_id: quiz.subject_id,
          topic_id: quiz.topic_id,
          default_time_seconds: quiz.default_time_seconds,
          show_ranking: true,
          show_score: true,
          show_correct_answers: false,
          is_shared: false,
          questions: quiz.questions.map((q) => ({
            statement: q.statement,
            options: q.options,
            correct_index: q.correct_index,
            subject_id: q.subject_id,
            topic_id: q.topic_id,
            subtopic: q.subtopic,
            difficulty: q.difficulty,
            time_override_seconds: q.time_override_seconds,
            image_url: q.image_url,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const detail = errData?.details;
        const detailStr = detail
          ? ` [code=${detail.code || "?"}, detail=${detail.details || "?"}, hint=${detail.hint || "?"}]`
          : "";
        console.error(`[AI SAVE] frontend error: status=${res.status}, error=${errData?.error}${detailStr}`);
        throw new Error(errData?.error ?? "Erro ao salvar quiz");
      }

      const data = await res.json();
      setSavedQuizId(data.id);
      setSaveStatus("done");
    } catch (err) {
      setSaveStatus("error");
      const msg = err instanceof Error ? err.message : "Erro ao salvar o quiz gerado.";
      setMessages((prev) => [
        ...prev,
        {
          id: `save-error-${Date.now()}`,
          role: "assistant",
          content: `Não consegui salvar o quiz gerado. ${msg}\n\nQuer tentar novamente?`,
          type: "error",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      if (timeoutWarningRef.current) {
        clearTimeout(timeoutWarningRef.current);
        timeoutWarningRef.current = null;
      }
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setError(null);

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: userMessage, type: "text", timestamp: Date.now() }]);
    setLoading(true);
    setGenerationStage("generating");
    startPhraseLoop();

    try {
      const userMsg: AIQuizMessage = { id: `user-${Date.now()}`, role: "user", content: userMessage, type: "text", timestamp: Date.now() };
      const currentMessages = [...messages, userMsg];
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages.map((m) => ({ role: m.role, content: m.content })),
          teacherId: "",
          existingSubjects: subjectsTopics?.subjects ?? [],
          existingTopics: subjectsTopics?.topics ?? [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errData = data as any;
        if (errData?.limit) {
          setUsage({
            used: errData.used ?? usage?.used ?? 0,
            limit: errData.limit,
            globalUsed: errData.globalUsed ?? usage?.globalUsed ?? 0,
            globalLimit: errData.globalLimit ?? usage?.globalLimit ?? 18,
          });
        }
        throw new Error(data.error ?? "Erro ao gerar quiz");
      }

      setGenerationStage("validating");
      await new Promise((r) => setTimeout(r, 500));

      const { quiz, warnings, generatedCount, requestedCount } = data;
      if (data.usage) setUsage({ used: data.usage.used, limit: data.usage.limit, globalUsed: data.usage.globalUsed ?? 0, globalLimit: data.usage.globalLimit ?? 18 });
      else fetchUsage();

      if (quiz.questions.length === 0) {
        throw new Error("Nenhuma questão válida foi gerada");
      }

      const quizData: GeneratedQuizData = {
        title: quiz.title,
        description: quiz.description,
        subject_id: quiz.subject_id,
        topic_id: quiz.topic_id,
        default_time_seconds: quiz.default_time_seconds,
        questions: quiz.questions,
      };

      setGeneratedQuiz(quizData);

      let successContent = `Quiz criado com sucesso! **${generatedCount} de ${requestedCount} questões** foram geradas e validadas.`;
      if (warnings.length > 0) {
        successContent += "\n\n⚠️ Avisos:\n" + warnings.map((w: string) => `- ${w}`).join("\n");
      }
      successContent += "\n\nO quiz está sendo preparado para revisão...";

      setMessages((prev) => [
        ...prev,
        { id: `success-${Date.now()}`, role: "assistant", content: successContent, type: "result", timestamp: Date.now() },
      ]);
      stopPhraseLoop();
      setGenerationStage("complete");

      // Dispara salvamento em background imediatamente
      autoSaveQuiz(quizData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMsg);
      stopPhraseLoop();
      setGenerationStage("error");
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: "assistant", content: `Não consegui gerar o quiz: ${errorMsg}. Quer tentar de novo?`, type: "error", timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    setError(null);
    setGenerationStage("idle");
    handleSend();
  };

  const handleRetrySave = () => {
    if (!generatedQuiz) return;
    setSaveStatus("idle");
    autoSaveQuiz(generatedQuiz);
  };

  const handleCloseRequest = () => {
    if (generationStage === "generating" || generationStage === "validating") {
      if (confirm("A geração está em andamento. Se fechar agora, o progresso será perdido. Deseja realmente cancelar?")) {
        onClose();
      }
    } else if (saveStatus === "saving") {
      if (confirm("O quiz está sendo salvo. Se fechar agora, o quiz pode não ser salvo. Deseja realmente fechar?")) {
        onClose();
      }
    } else if (saveStatus === "done" && savedQuizId) {
      if (confirm("Um quiz foi salvo como rascunho. Deseja fechar sem revisão? O quiz permanecerá na lista de quizzes.")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleReview = async () => {
    if (!savedQuizId) {
      setError("Quiz ainda não foi salvo. Aguarde ou tente salvar novamente.");
      return;
    }
    try {
      await router.push(`/professor/quizzes/${savedQuizId}`);
      onClose();
    } catch {
      setError("Não foi possível abrir o quiz para revisão. Tente novamente.");
    }
  };

  const handleDiscard = async () => {
    if (!savedQuizId) return;
    if (!confirm("Descartar quiz? As questões geradas serão perdidas e não poderão ser recuperadas.")) return;

    try {
      const res = await fetch(`/api/ai/quiz-create?id=${savedQuizId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir quiz");
      toast("Quiz descartado.", "ok");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao descartar quiz", "bad");
    }
  };

  if (!open) return null;

  const isSaving = saveStatus === "saving";
  const isSaved = saveStatus === "done";
  const saveFailed = saveStatus === "error";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Criar quiz com IA"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleCloseRequest}
    >
      <div
        className="animate-fade-in fixed inset-0 bg-black/55"
        onClick={() => {}}
      />
      <div
        className="acrylic animate-scale-in relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <IconSparkles size={20} />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Criar quiz com IA</h2>
              <p className="text-xs text-mute">Descreva o quiz que você quer e eu gero para você</p>
              {usage && (
                <p className="mt-0.5 text-[11px] font-medium text-faint">
                  {usage.used}/{usage.limit} gerações hoje · {usage.globalUsed}/{usage.globalLimit} da plataforma
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleCloseRequest}
            disabled={generationStage === "generating" || generationStage === "validating"}
            aria-label="Fechar"
            className="-mr-2 -mt-1 rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 animate-fade-in",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-3 rounded-2xl",
                    msg.role === "user"
                      ? "bg-accent/15 text-ink rounded-tr-sm"
                      : "bg-surface-2 text-ink rounded-tl-sm"
                  )}
                >
                  {msg.type === "status" && (
                    <div className="flex items-center gap-2 text-sm text-mute">
                      <IconLoader size={16} className="animate-spin" />
                      <span>{msg.content}</span>
                    </div>
                  )}
                  {msg.type === "result" && (
                    <div className="flex items-start gap-2 text-sm text-ok">
                      <IconCheck size={16} className="mt-0.5 shrink-0" />
                      <div className="text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold">
                        <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {msg.type === "error" && (
                    <div className="flex items-start gap-2 text-sm text-bad">
                      <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  )}
                  {msg.type === "text" && (
                    <>
                      {msg.role === "assistant" ? (
                        <div className="text-sm leading-relaxed">
                          <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {(generationStage === "generating" || generationStage === "validating") && (
            <div className="px-6 py-3">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <IconSparkles size={16} />
                </span>
                <div className="flex flex-col gap-1">
                  <div className="rounded-2xl rounded-tl-md bg-[#16171B] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent [animation-delay:0ms]" />
                      <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                      <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                    </div>
                  </div>
                  <span
                    key={phraseIndex}
                    className="block text-xs text-faint animate-[fadeIn_150ms_ease-out]"
                  >
                    {loadingPhrases[phraseIndex]}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-line px-6 py-4 bg-surface/30">
            {error && (
              <div className="mb-3 flex items-center gap-2 text-sm text-bad bg-bad-deep px-3 py-2 rounded-xl">
                <IconAlertCircle size={16} />
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={handleRetry}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {usage && usage.used >= usage.limit && !error && (
              <div className="mb-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 px-3 py-2 rounded-xl">
                <IconAlertCircle size={16} />
                <span>Limite individual de {usage.limit} atingido. Renova amanhã. Crie quizzes manualmente enquanto isso.</span>
              </div>
            )}
            {usage && usage.globalUsed >= usage.globalLimit && !error && (
              <div className="mb-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 px-3 py-2 rounded-xl">
                <IconAlertCircle size={16} />
                <span>Cota diária da plataforma atingida. Renova amanhã. Crie quizzes manualmente enquanto isso.</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={loading ? "Gerando..." : "Descreva o quiz que você quer..."}
                disabled={loading}
                rows={1}
                className={cn(
                  "flex-1 min-h-[48px] max-h-40 px-4 py-3 text-sm bg-surface rounded-xl border border-line-strong focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors",
                  loading && "opacity-60 cursor-not-allowed"
                )}
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim() || (!!usage && (usage.used >= usage.limit || usage.globalUsed >= usage.globalLimit))}
                aria-label="Enviar"
                className="shrink-0"
              >
                <IconSend size={18} />
              </Button>
            </div>
          </div>
        </div>

        {/* Barra de ações inferior: Revisar / Descartar / Retry Save */}
        {generationStage === "complete" && (
          <div className="border-t border-line px-6 py-4 bg-surface/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-mute">
                {isSaving
                  ? "Preparando revisão..."
                  : isSaved
                    ? "Quiz pronto para revisão"
                    : saveFailed
                      ? "Falha ao salvar"
                      : ""}
              </span>
              <div className="flex gap-2">
                {saveFailed && (
                  <Button variant="outline" size="sm" onClick={handleRetrySave}>
                    Tentar salvar novamente
                  </Button>
                )}
                {isSaved && (
                  <Button variant="outline" size="sm" onClick={handleDiscard} className="text-bad hover:text-bad hover:bg-bad-deep">
                    <IconTrash size={14} className="mr-1.5" />
                    Descartar
                  </Button>
                )}
                <Button
                  onClick={handleReview}
                  className="bg-accent"
                  disabled={!isSaved}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <IconLoader size={16} className="animate-spin" />
                      Preparando...
                    </span>
                  ) : (
                    "Revisar e continuar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
