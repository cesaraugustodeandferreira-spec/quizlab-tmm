"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { QuestionBankModal } from "@/components/teacher/QuestionBankModal";
import { QuestionFormModal } from "@/components/teacher/QuestionFormModal";
import { StartSessionModal } from "@/components/teacher/StartSessionModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Skeleton, Progress } from "@/components/ui/Progress";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { listSubjects, listTopics } from "@/lib/api/taxonomy";
import { addQuestionToQuiz, getQuiz, removeQuestionFromQuiz, reorderQuestions, setQuizStatus, updateQuiz, type QuizDetail } from "@/lib/api/quizzes";
import { DIFFICULTY_LABELS } from "@/lib/scoring";
import { LETTERS } from "@/lib/utils";
import type { QuestionInput, QuestionRow, Subject, Topic } from "@/types";
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy as CopyIcon,
  IconDatabase,
  IconPlayerPlay,
  IconPlus,
  IconDeviceFloppy,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function QuizEditorPage() {
  const params = useParams<{ id: string }>();
  const quizId = Array.isArray(params.id) ? params.id[0] : params.id;
  const toast = useToast();

  const quiz = useAsync(() => getQuiz(quizId), [quizId]);
  const detail: QuizDetail | null = quiz.data;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [defaultTime, setDefaultTime] = useState(20);
  const [showRanking, setShowRanking] = useState(true);
  const [showScore, setShowScore] = useState(true);
  const [showCorrect, setShowCorrect] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const [questionModal, setQuestionModal] = useState<{ open: boolean; editing: QuestionRow | null }>({ open: false, editing: null });
  const [bankOpen, setBankOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    listTopics(subjectId).then(setTopics).catch(() => setTopics([]));
  }, [subjectId]);

  useEffect(() => {
    if (!detail) return;
    setTitle(detail.title === "Quiz sem título" ? "" : detail.title);
    setDescription(detail.description ?? "");
    setSubjectId(detail.subject_id ?? null);
    setTopicId(detail.topic_id ?? null);
    setDefaultTime(detail.default_time_seconds);
    setShowRanking(detail.show_ranking);
    setShowScore(detail.show_score);
    setShowCorrect(detail.show_correct_answers);
    setIsShared(detail.is_shared);
  }, [detail]);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Quizzes", href: "/professor/quizzes" },
      { label: title || "Editor" },
    ],
    pill: detail?.subject?.name ?? null,
  });

  async function persistMeta(extra?: Partial<{ status: "rascunho" | "publicado" }>): Promise<boolean> {
    if (!title.trim()) {
      toast("Dê um nome ao quiz antes de salvar.", "bad");
      return false;
    }
    setSavingMeta(true);
    try {
      let effectiveTopicId = topicId;
      if (effectiveTopicId && !topics.some((t) => t.id === effectiveTopicId)) {
        effectiveTopicId = null;
      }
      await updateQuiz(quizId, {
        title,
        description,
        subject_id: subjectId ?? "",
        topic_id: effectiveTopicId,
        default_time_seconds: defaultTime,
        show_ranking: showRanking,
        show_score: showScore,
        show_correct_answers: showCorrect,
      });
      if (extra?.status) await setQuizStatus(quizId, extra.status);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar.", "bad");
      return false;
    } finally {
      setSavingMeta(false);
    }
  }

  async function handlePublish() {
    if (!title.trim()) {
      toast("Dê um nome ao quiz antes de publicar.", "bad");
      return;
    }
    if (!subjectId) {
      toast("Selecione a disciplina antes de publicar.", "bad");
      return;
    }
    if (!detail?.questions.length) {
      toast("Adicione pelo menos uma questão antes de publicar.", "bad");
      return;
    }
    const ok = await persistMeta({ status: "publicado" });
    if (ok) {
      toast("Quiz publicado! Já pode ser aplicado a uma turma.", "ok");
      void quiz.reload();
    }
  }

  async function handleAddFromBank(selected: QuestionRow[]) {
    try {
      for (const q of selected) await addQuestionToQuiz(quizId, q.id);
      toast(`${selected.length} questão(ões) adicionada(s).`, "ok");
      void quiz.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao adicionar questões.", "bad");
    }
  }

  async function handleDuplicateQuestion(q: QuestionRow & { position: number }) {
    try {
      const { createQuestion } = await import("@/lib/api/questions");
      const copy = await createQuestion({
        statement: q.statement,
        options: [...q.options] as QuestionInput["options"],
        correct_index: q.correct_index,
        subject_id: q.subject_id,
        topic_id: q.topic_id,
        subtopic: q.subtopic ?? "",
        difficulty: q.difficulty,
        time_override_seconds: q.time_override_seconds,
        image_url: q.image_url ?? "",
      });
      await addQuestionToQuiz(quizId, copy.id);
      toast("Questão duplicada no quiz.", "ok");
      void quiz.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao duplicar.", "bad");
    }
  }

  async function handleRemove(qid: string) {
    try {
      await removeQuestionFromQuiz(quizId, qid);
      void quiz.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao remover questão.", "bad");
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    if (!detail) return;
    const qs = [...detail.questions];
    const target = index + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[index], qs[target]] = [qs[target], qs[index]];
    try {
      await reorderQuestions(quizId, qs.map((q) => q.id));
      void quiz.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao reordenar.", "bad");
    }
  }

  if (quiz.loading || (!quiz.data && !quiz.error)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (quiz.error || !detail) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-bad">{quiz.error}</p>
        <div className="pb-2 text-center">
          <Button variant="outline" onClick={() => void quiz.reload()}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  const published = detail.status === "publicado";
  const totalQs = detail.questions.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display truncate text-2xl font-bold text-ink">{detail.title}</h1>
            <Badge tone={published ? "ok" : "warn"}>{published ? "Publicado" : "Rascunho"}</Badge>
            {published && isShared && <Badge tone="accent">Na biblioteca</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-mute">
            {totalQs} {totalQs === 1 ? "questão" : "questões"} · tempo padrão {defaultTime}s por questão
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {published && totalQs > 0 && (
            <Button variant="outline" icon={<IconPlayerPlay size={17} />} onClick={() => setStartOpen(true)}>
              Iniciar
            </Button>
          )}
          {!published && (
            <>
              <Button
                variant="outline"
                icon={<IconDeviceFloppy size={17} />}
                loading={savingMeta}
                onClick={async () => (await persistMeta()) && toast("Rascunho salvo.", "ok")}
              >
                Salvar rascunho
              </Button>
              <Button loading={savingMeta} onClick={() => void handlePublish()}>
                Publicar quiz
              </Button>
            </>
          )}
          {published && (
            <Button
              variant="outline"
              icon={<IconDeviceFloppy size={17} />}
              loading={savingMeta}
              onClick={async () => (await persistMeta()) && toast("Alterações salvas.", "ok")}
            >
              Salvar alterações
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
        <Card className="h-fit space-y-4">
          <CardTitle>Configurações do quiz</CardTitle>
          <Field label="Nome do quiz" htmlFor="quiz-title" required>
            <Input id="quiz-title" placeholder="Ex.: Revisão de Frações" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="quiz-desc">
            <Textarea id="quiz-desc" placeholder="Contexto para você e para os alunos…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Disciplina" htmlFor="quiz-subject">
              <Select
                id="quiz-subject"
                value={subjectId ?? ""}
                onChange={(e) => {
                  setSubjectId(e.target.value || null);
                  setTopicId(null);
                }}
              >
                <option value="">Selecione…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tema principal" htmlFor="quiz-topic">
              <Select
                id="quiz-topic"
                value={topicId ?? ""}
                onChange={(e) => setTopicId(e.target.value || null)}
                disabled={!topics.length}
              >
                <option value="">Sem tema</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={`Tempo padrão por questão: ${defaultTime}s`} htmlFor="quiz-time">
            <input
              id="quiz-time"
              type="range"
              min={10}
              max={120}
              step={5}
              value={defaultTime}
              onChange={(e) => setDefaultTime(Number(e.target.value))}
              className="w-full cursor-pointer accent-[#2563eb]"
            />
          </Field>

          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-xs font-semibold tracking-wide text-faint uppercase">O que o aluno vê no resultado</p>
            <Toggle checked={showScore} onChange={setShowScore} label="Mostrar pontuação" hint="Pontos ganhos com bônus de velocidade." />
            <Toggle checked={showRanking} onChange={setShowRanking} label="Mostrar ranking" hint="Top jogadores ao final do quiz." />
            <Toggle checked={showCorrect} onChange={setShowCorrect} label="Mostrar gabarito" hint="Respostas corretas após o fim." />
            <Toggle
              checked={isShared}
              onChange={async (v) => {
                setIsShared(v);
                const ok = await persistMeta();
                if (!ok) setIsShared(!v);
                else toast(v ? "Quiz compartilhado na Biblioteca." : "Quiz removido da Biblioteca.", "ok");
              }}
              label="Compartilhar na Biblioteca"
              hint="Outros professores poderão usar este quiz."
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle right={<span className="tnum text-sm font-semibold text-ink">{totalQs}</span>}>Questões</CardTitle>

            {totalQs > 0 && published && (
              <Progress value={Math.min(totalQs, 20)} max={20} className="mb-4" label={`${totalQs} questões`} />
            )}

            {!totalQs ? (
              <EmptyState
                icon={<IconDatabase size={34} stroke={1.4} />}
                title="Nenhuma questão neste quiz"
                description="Crie uma nova questão ou puxe do seu Banco de Questões."
              />
            ) : (
              <ol className="space-y-2.5">
                {detail.questions.map((q, i) => (
                  <li key={q.id} className="group rounded-xl border border-line bg-surface-2/40 p-3.5 transition-colors hover:border-line-strong">
                    <div className="flex items-start gap-3">
                      <span className="tnum mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-mute">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-snug text-ink">{q.statement}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge tone="neutral">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                          <Badge tone="neutral">
                            Correta: {LETTERS[q.correct_index]}
                          </Badge>
                          {q.time_override_seconds && <Badge tone="accent">{q.time_override_seconds}s</Badge>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <IconBtn label="Mover para cima" disabled={i === 0} onClick={() => void handleMove(i, -1)}>
                          <IconArrowUp size={15} />
                        </IconBtn>
                        <IconBtn label="Mover para baixo" disabled={i === totalQs - 1} onClick={() => void handleMove(i, 1)}>
                          <IconArrowDown size={15} />
                        </IconBtn>
                        <IconBtn label="Editar questão" onClick={() => setQuestionModal({ open: true, editing: q })}>
                          ✎
                        </IconBtn>
                        <IconBtn label="Duplicar questão" onClick={() => void handleDuplicateQuestion(q)}>
                          <CopyIcon size={15} />
                        </IconBtn>
                        <IconBtn label="Remover do quiz" danger onClick={() => void handleRemove(q.id)}>
                          <IconTrash size={15} />
                        </IconBtn>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button size="sm" icon={<IconPlus size={16} />} onClick={() => setQuestionModal({ open: true, editing: null })}>
                Nova questão
              </Button>
              <Button size="sm" variant="outline" icon={<IconDatabase size={16} />} onClick={() => setBankOpen(true)}>
                Puxar do Banco de Questões
              </Button>
            </div>
          </Card>

          {!published && (
            <p className="px-1 text-xs leading-relaxed text-faint">
              Publique o quiz para liberá-lo na Biblioteca e permitir iniciar salas ao vivo.{" "}
              <Link href="/professor/questoes" className="text-accent-bright hover:text-white">
                Gerenciar banco de questões
              </Link>
            </p>
          )}
        </div>
      </div>

      {questionModal.open && (
        <QuestionFormModal
          key={questionModal.editing?.id ?? "new-q"}
          open={questionModal.open}
          onClose={() => setQuestionModal({ open: false, editing: null })}
          initial={questionModal.editing}
          lockedSubjectId={subjectId}
          onSaved={(savedId, wasNew) => {
            if (!wasNew) {
              toast("Questão atualizada.", "ok");
              void quiz.reload();
              return;
            }
            void (async () => {
              try {
                await addQuestionToQuiz(quizId, savedId);
                toast("Questão criada e adicionada ao quiz.", "ok");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Criada no banco, mas não foi possível vinculá-la.", "bad");
              } finally {
                void quiz.reload();
              }
            })();
          }}
        />
      )}

      {bankOpen && (
        <QuestionBankModal
          open={bankOpen}
          onClose={() => setBankOpen(false)}
          excludeIds={detail.questions.map((q) => q.id)}
          onAdd={(qs) => void handleAddFromBank(qs)}
        />
      )}

      {startOpen && (
        <StartSessionModal open={startOpen} onClose={() => setStartOpen(false)} quizId={quizId} quizTitle={detail.title} />
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer rounded-lg p-2 transition-colors disabled:cursor-default disabled:opacity-30 ${
        danger ? "text-faint hover:bg-bad-deep hover:text-bad" : "text-faint hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
