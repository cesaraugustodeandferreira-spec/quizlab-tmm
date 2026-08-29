"use client";

import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { SubjectSelect } from "@/components/teacher/SubjectSelect";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { createQuiz, updateQuiz, type QuizDetail } from "@/lib/api/quizzes";
import { listTopics } from "@/lib/api/taxonomy";
import { cn } from "@/lib/utils";
import type { Topic } from "@/types";
import { IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";

interface QuizWizardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
  quizId?: string;
  initial?: QuizDetail | null;
  onSaved?: () => void;
}

const STEPS = [
  { id: 1, label: "Informações" },
  { id: 2, label: "Classificação" },
  { id: 3, label: "Resultado" },
];

export function QuizWizardModal({
  open,
  onClose,
  onCreated,
  quizId,
  initial,
  onSaved,
}: QuizWizardModalProps) {
  const toast = useToast();
  const isEdit = !!quizId;

  const [step, setStep] = useState(1);
  const [title, setTitleState] = useState("");
  const [description, setDescriptionState] = useState("");
  const [subjectId, setSubjectIdState] = useState<string | null>(null);
  const [topicId, setTopicIdState] = useState<string | null>(null);
  const [defaultTime, setDefaultTimeState] = useState(20);
  const [showRanking, setShowRankingState] = useState(true);
  const [showScore, setShowScoreState] = useState(true);
  const [showCorrect, setShowCorrectState] = useState(false);
  const [isShared, setIsSharedState] = useState(false);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [touchedTitle, setTouchedTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  // Wrapped setters that mark the wizard as dirty.
  const setTitle = (v: string) => {
    setTitleState(v);
    setDirty(true);
  };
  const setDescription = (v: string) => {
    setDescriptionState(v);
    setDirty(true);
  };
  const setSubjectId = (v: string | null) => {
    setSubjectIdState(v);
    setDirty(true);
  };
  const setTopicId = (v: string | null) => {
    setTopicIdState(v);
    setDirty(true);
  };
  const setDefaultTime = (v: number) => {
    setDefaultTimeState(v);
    setDirty(true);
  };
  const setShowRanking = (v: boolean) => {
    setShowRankingState(v);
    setDirty(true);
  };
  const setShowScore = (v: boolean) => {
    setShowScoreState(v);
    setDirty(true);
  };
  const setShowCorrect = (v: boolean) => {
    setShowCorrectState(v);
    setDirty(true);
  };
  const setIsShared = (v: boolean) => {
    setIsSharedState(v);
    setDirty(true);
  };

  useEffect(() => {
    if (!open) return;
    setTitleState(initial?.title ?? "");
    setDescriptionState(initial?.description ?? "");
    setSubjectIdState(initial?.subject_id ?? null);
    setTopicIdState(initial?.topic_id ?? null);
    setDefaultTimeState(initial?.default_time_seconds ?? 20);
    setShowRankingState(initial?.show_ranking ?? true);
    setShowScoreState(initial?.show_score ?? true);
    setShowCorrectState(initial?.show_correct_answers ?? false);
    setIsSharedState(initial?.is_shared ?? false);
    setStep(1);
    setTouchedTitle(false);
    setTopics([]);
    setSaving(false);
    setShowDiscard(false);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      return;
    }
    listTopics(subjectId)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [subjectId]);

  const titleError = touchedTitle && !title.trim() ? "Informe o nome do quiz." : null;
  const subjectError = !subjectId ? "Selecione a disciplina para continuar." : null;
  const nextDisabled = step === 1 ? !title.trim() : step === 2 ? !subjectId : false;

  function handleNext() {
    if (step === 1 && !title.trim()) {
      setTouchedTitle(true);
      return;
    }
    if (step === 2 && !subjectId) return;
    setStep((s) => Math.min(3, s + 1));
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        subject_id: subjectId ?? "",
        topic_id: topicId,
        default_time_seconds: defaultTime,
        show_ranking: showRanking,
        show_score: showScore,
        show_correct_answers: showCorrect,
        is_shared: isShared,
      };
      if (quizId) {
        await updateQuiz(quizId, payload);
        toast("Alterações salvas.", "ok");
        onSaved?.();
      } else {
        const id = await createQuiz(payload);
        toast("Quiz criado!", "ok");
        onCreated?.(id);
      }
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar o quiz.", "bad");
    } finally {
      setSaving(false);
    }
  }

  function requestClose() {
    if (dirty) setShowDiscard(true);
    else onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={isEdit ? "Editar configurações do quiz" : "Criar quiz"}
        description={isEdit ? "Ajuste os dados do quiz. As questões não são alteradas." : "Defina os dados básicos do seu quiz em 3 passos."}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div>
              {step > 1 && (
                <Button variant="ghost" onClick={handleBack} disabled={saving}>
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {step < 3 ? (
                <Button onClick={handleNext} disabled={nextDisabled}>
                  Avançar
                </Button>
              ) : (
                <Button onClick={() => void handleFinish()} loading={saving}>
                  {isEdit ? "Salvar alterações" : "Criar quiz"}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <nav aria-label="Progresso do cadastro" className="mb-6">
          <ol className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const done = s.id < step;
              const current = s.id === step;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      done && "bg-ok text-[#052e1e]",
                      current && "bg-accent text-white",
                      !done && !current && "bg-surface-2 text-faint ring-1 ring-inset ring-line-strong",
                    )}
                  >
                    {done ? <IconCheck size={15} stroke={3} /> : s.id}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      current ? "font-medium text-ink" : done ? "text-mute" : "text-faint",
                    )}
                  >
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-5 bg-line-strong" />}
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Nome do quiz" htmlFor="wz-title" required>
              <Input
                id="wz-title"
                autoFocus
                placeholder="Ex.: Revisão de Frações"
                value={title}
                error={!!titleError}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setTouchedTitle(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && title.trim()) handleNext();
                }}
              />
            </Field>
            {titleError && (
              <p role="alert" className="-mt-2 flex items-center gap-1 text-sm text-bad">
                <span aria-hidden>⚠</span> {titleError}
              </p>
            )}
            <Field label="Descrição (opcional)" htmlFor="wz-desc">
              <Textarea
                id="wz-desc"
                rows={3}
                placeholder="Contexto para você e para os alunos…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Disciplina" htmlFor="wz-subject" required error={subjectError ?? undefined}>
              <SubjectSelect
                id="wz-subject"
                value={subjectId ?? ""}
                onChange={(id) => {
                  setSubjectId(id || null);
                  setTopicId(null);
                }}
              />
            </Field>
            {subjectError && (
              <p role="alert" className="-mt-2 flex items-center gap-1 text-sm text-bad">
                <span aria-hidden>⚠</span> {subjectError}
              </p>
            )}
            <Field label="Tema principal (opcional)" htmlFor="wz-topic">
              <Select
                id="wz-topic"
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
            <Field label="Tempo padrão por questão" htmlFor="wz-time">
              <div className="flex items-center gap-3">
                <input
                  id="wz-time"
                  type="number"
                  min={5}
                  max={600}
                  step={5}
                  value={defaultTime}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (Number.isNaN(raw)) {
                      setDefaultTime(10);
                      return;
                    }
                    setDefaultTime(Math.min(600, Math.max(5, raw)));
                  }}
                  className="input-base w-28 tnum text-center"
                  aria-describedby="wz-time-help"
                />
                <span className="text-sm text-mute">segundos</span>
              </div>
              <p id="wz-time-help" className="mt-1 text-xs text-faint">
                Entre 5 e 600 segundos (mínimo de 5s).
              </p>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-faint uppercase">
              O que o aluno vê no resultado
            </p>
            <Toggle
              checked={showScore}
              onChange={setShowScore}
              label="Mostrar pontuação"
              hint="Pontos ganhos com bônus de velocidade."
            />
            <Toggle
              checked={showRanking}
              onChange={setShowRanking}
              label="Mostrar ranking"
              hint="Top jogadores ao final do quiz."
            />
            <Toggle
              checked={showCorrect}
              onChange={setShowCorrect}
              label="Mostrar gabarito"
              hint="Respostas corretas após o fim."
            />
            <Toggle
              checked={isShared}
              onChange={setIsShared}
              label="Compartilhar na Biblioteca"
              hint="Outros professores poderão usar este quiz."
            />
          </div>
        )}
      </Modal>

      <ConfirmModal
        state={
          showDiscard
            ? {
                title: "Descartar rascunho?",
                message:
                  "As informações preenchidas neste quiz serão perdidas e nenhum quiz será criado.",
                confirmLabel: "Descartar",
                onConfirm: () => {
                  setShowDiscard(false);
                  onClose();
                },
              }
            : null
        }
        onClose={() => setShowDiscard(false)}
      />
    </>
  );
}
