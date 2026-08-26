"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { listQuestions } from "@/lib/api/questions";
import { listSubjects, listTopics } from "@/lib/api/taxonomy";
import { DIFFICULTY_LABELS } from "@/lib/scoring";
import type { Difficulty, QuestionRow, Subject, Topic } from "@/types";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export function QuestionBankModal({
  open,
  onClose,
  excludeIds = [],
  lockedSubjectId,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  excludeIds?: string[];
  lockedSubjectId?: string | null;
  onAdd: (questions: QuestionRow[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState(lockedSubjectId ?? "");
  const [topicId, setTopicId] = useState("");
  const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [results, setResults] = useState<QuestionRow[] | null>(null);
  const [selected, setSelected] = useState<Map<string, QuestionRow>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    listSubjects().then(setSubjects).catch(() => setSubjects([]));
    setSelected(new Map());
    setSearch("");
    setTopicId("");
    setDifficulty("");
    if (!lockedSubjectId) setSubjectId("");
  }, [open, lockedSubjectId]);

  useEffect(() => {
    if (!open || !subjectId) {
      setTopics([]);
      return;
    }
    listTopics(subjectId).then(setTopics).catch(() => setTopics([]));
  }, [open, subjectId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLoading(true);
      listQuestions({
        search,
        subject_id: subjectId || undefined,
        topic_id: topicId || undefined,
        difficulty: difficulty || undefined,
      })
        .then((rows) => setResults(rows.filter((r) => !excludeIds.includes(r.id))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, subjectId, topicId, difficulty]);

  function toggle(q: QuestionRow) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Banco de Questões"
      description="Selecione questões já criadas para adicionar a este quiz."
      footer={
        <>
          <span className="mr-auto text-sm text-mute">{selected.size} selecionada(s)</span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!selected.size}
            icon={<IconCheck size={17} />}
            onClick={() => {
              onAdd([...selected.values()]);
              onClose();
            }}
          >
            Adicionar ao quiz
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Buscar" htmlFor="bank-search">
            <Input
              id="bank-search"
              placeholder="Enunciado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Disciplina" htmlFor="bank-subject">
            <Select
              id="bank-subject"
              value={subjectId}
              disabled={!!lockedSubjectId}
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
          <Field label="Tema" htmlFor="bank-topic">
            <Select id="bank-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!topics.length}>
              <option value="">Todos</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dificuldade" htmlFor="bank-diff">
            <Select
              id="bank-diff"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as "" | Difficulty)}
            >
              <option value="">Todas</option>
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-pulse h-16 w-full" />
            ))}
          </div>
        ) : !results?.length ? (
          <EmptyState
            icon={<IconSearch size={32} stroke={1.5} />}
            title="Nenhuma questão encontrada"
            description="Ajuste a busca ou crie novas questões no Banco de Questões."
          />
        ) : (
          <ul className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {results.map((q) => {
              const isSel = selected.has(q.id);
              return (
                <li key={q.id}>
                  <button
                    onClick={() => toggle(q)}
                    aria-pressed={isSel}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      isSel ? "border-accent/50 bg-accent-deep" : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                        isSel ? "border-accent bg-accent text-white" : "border-line-strong"
                      }`}
                    >
                      {isSel && <IconCheck size={13} stroke={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{q.statement}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone="neutral">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                        <Badge tone="neutral">{q.subtopic || q.topic_id || "Sem tema"}</Badge>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
