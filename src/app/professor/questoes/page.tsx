"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { QuestionFormModal } from "@/components/teacher/QuestionFormModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { ConfirmModal, type ConfirmState } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { deleteQuestion, duplicateQuestion, listQuestions } from "@/lib/api/questions";
import { listSubjects, listTopics } from "@/lib/api/taxonomy";
import { DIFFICULTY_LABELS } from "@/lib/scoring";
import { fmtDate } from "@/lib/utils";
import type { Difficulty, QuestionRow, Subject, Topic } from "@/types";
import { IconCopy as CopyIcon, IconDatabase, IconPencil, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/useAsync";

export default function QuestionBankPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: QuestionRow | null }>({ open: false, editing: null });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!subjectId) return setTopics([]);
    listTopics(subjectId).then(setTopics).catch(() => setTopics([]));
  }, [subjectId]);

  const questions = useAsync(
    () =>
      listQuestions({
        search,
        subject_id: subjectId || undefined,
        topic_id: topicId || undefined,
        difficulty: difficulty || undefined,
      }),
    [search, subjectId, topicId, difficulty],
  );

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Banco de Questões" },
    ],
    pill: subjects.find((s) => s.id === subjectId)?.name ?? "Todas as disciplinas",
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Banco de Questões</h1>
          <p className="mt-0.5 text-sm text-mute">
            Sua biblioteca pessoal — reutilize questões em qualquer quiz.
          </p>
        </div>
        <Button icon={<IconPlus size={18} />} onClick={() => setModal({ open: true, editing: null })}>
          Nova questão
        </Button>
      </div>

      <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" padded>
        <Field label="Buscar por enunciado" htmlFor="qb-search">
          <Input id="qb-search" placeholder="Digite para filtrar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Disciplina" htmlFor="qb-subject">
          <Select
            id="qb-subject"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setTopicId("");
            }}
          >
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tema" htmlFor="qb-topic">
          <Select id="qb-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!topics.length}>
            <option value="">Todos</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dificuldade" htmlFor="qb-difficulty">
          <Select id="qb-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "" | Difficulty)}>
            <option value="">Todas</option>
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {questions.error && (
        <Card>
          <p className="py-6 text-center text-sm text-bad">{questions.error}</p>
        </Card>
      )}

      {questions.loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : questions.data && questions.data.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {questions.data.map((q) => (
            <li key={q.id}>
              <Card className="group relative flex h-full flex-col gap-2.5">
                <p className="pr-16 text-sm leading-snug text-ink">{q.statement}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                  {(q.subtopic || q.topic_id || q.subject_id) && (
                    <Badge tone="accent">{q.subtopic || "Questão"}</Badge>
                  )}
                  {q.time_override_seconds && <Badge tone="neutral">{q.time_override_seconds}s</Badge>}
                  <span className="ml-auto text-[11px] text-faint">{fmtDate(q.created_at)}</span>
                </div>
                <div className="mt-auto flex items-center gap-1 border-t border-line pt-3 opacity-70 transition-opacity group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<IconPencil size={15} />}
                    onClick={() => setModal({ open: true, editing: q })}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<CopyIcon size={15} />}
                    onClick={async () => {
                      try {
                        await duplicateQuestion(q);
                        toast("Questão duplicada.", "ok");
                        void questions.reload();
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Erro ao duplicar.", "bad");
                      }
                    }}
                  >
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-bad hover:bg-bad-deep"
                    icon={<IconTrash size={15} />}
                    onClick={() =>
                      setConfirm({
                        title: "Excluir questão?",
                        message:
                          "Ela será removida dos quizzes em que aparece e das estatísticas de respostas associadas.",
                        confirmLabel: "Excluir",
                        onConfirm: async () => {
                          try {
                            await deleteQuestion(q.id);
                            toast("Questão excluída.", "ok");
                            setConfirm(null);
                            void questions.reload();
                          } catch (err) {
                            toast(err instanceof Error ? err.message : "Erro.", "bad");
                          }
                        },
                      })
                    }
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        !questions.error && (
          <Card>
            <EmptyState
              icon={<IconDatabase size={36} stroke={1.4} />}
              title="Nenhuma questão encontrada"
              description={
                search || subjectId || topicId || difficulty
                  ? "Nenhuma questão corresponde aos filtros atuais."
                  : "Crie sua primeira questão para reutilizá-la nos quizzes."
              }
              action={
                <Button icon={<IconPlus size={17} />} onClick={() => setModal({ open: true, editing: null })}>
                  Criar questão
                </Button>
              }
            />
          </Card>
        )
      )}

      {modal.open && (
        <QuestionFormModal
          key={modal.editing?.id ?? "new"}
          open={modal.open}
          onClose={() => setModal({ open: false, editing: null })}
          initial={modal.editing}
          lockedSubjectId={subjectId || undefined}
          onSaved={(id, wasNew) => {
            void id;
            toast(wasNew ? "Questão criada." : "Questão atualizada.", "ok");
            void questions.reload();
          }}
        />
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
