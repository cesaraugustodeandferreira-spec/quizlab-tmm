"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ensureTopic, listSubjects, listTopics } from "@/lib/api/taxonomy";
import { createQuestion, updateQuestion } from "@/lib/api/questions";
import { DIFFICULTY_LABELS } from "@/lib/scoring";
import { LETTERS, cn } from "@/lib/utils";
import type { Difficulty, QuestionInput, QuestionRow, Subject, Topic } from "@/types";
import { useEffect, useState } from "react";

const emptyInput = (): QuestionInput => ({
  statement: "",
  options: ["", "", "", ""],
  correct_index: 0,
  subject_id: "",
  topic_id: null,
  subtopic: "",
  difficulty: "media",
  time_override_seconds: null,
  image_url: "",
});

export function QuestionFormModal({
  open,
  onClose,
  initial,
  lockedSubjectId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: QuestionRow | null;
  lockedSubjectId?: string | null;
  onSaved: (savedId: string, wasNew: boolean) => void;
}) {
  const [input, setInput] = useState<QuestionInput>(emptyInput);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    listSubjects()
      .then((subs) => {
        setSubjects(subs);
        if (initial?.subject_id) return;
        if (!lockedSubjectId && subs.length) {
          setInput((prev) => ({ ...prev, subject_id: prev.subject_id || subs[0].id }));
        }
      })
      .catch(() => setError("Não foi possível carregar as disciplinas."));
  }, [open, initial?.subject_id, lockedSubjectId]);

  useEffect(() => {
    if (!open) return;
    if (!input.subject_id) {
      setTopics([]);
      return;
    }
    listTopics(input.subject_id)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [open, input.subject_id]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setInput({
        statement: initial.statement,
        options: [initial.options[0], initial.options[1], initial.options[2], initial.options[3]],
        correct_index: initial.correct_index,
        subject_id: initial.subject_id,
        topic_id: initial.topic_id,
        subtopic: initial.subtopic ?? "",
        difficulty: initial.difficulty,
        time_override_seconds: initial.time_override_seconds,
        image_url: initial.image_url ?? "",
      });
    } else {
      setInput({ ...emptyInput(), subject_id: lockedSubjectId ?? "" });
    }
    setTopicQuery("");
    setError(null);
  }, [open, initial, lockedSubjectId]);

  function validate(): string | null {
    if (input.statement.trim().length < 5) return "O enunciado precisa ter pelo menos 5 caracteres.";
    if (!input.subject_id) return "Selecione a disciplina.";
    if (input.options.some((o) => !o.trim())) return "Preencha as quatro alternativas.";
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      let topicId = input.topic_id;
      const trimmedTopic = topicQuery.trim();
      if (trimmedTopic && !topics.some((t) => t.id === topicId)) {
        topicId = await ensureTopic(input.subject_id, trimmedTopic);
      }
      const payload: QuestionInput = { ...input, topic_id: topicId };
      if (initial) {
        await updateQuestion(initial.id, payload);
        onSaved(initial.id, false);
      } else {
        const created = await createQuestion(payload);
        onSaved(created.id, true);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a questão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? "Editar questão" : "Nova questão"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} loading={saving}>
            Salvar questão
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}

        <Field label="Enunciado" htmlFor="q-statement" required>
          <Textarea
            id="q-statement"
            placeholder="Digite a pergunta…"
            value={input.statement}
            onChange={(e) => setInput((p) => ({ ...p, statement: e.target.value }))}
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13px] font-medium text-mute">Alternativas — marque a correta</legend>
          {LETTERS.map((letter, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={input.correct_index === idx}
                aria-label={`Marcar alternativa ${letter} como correta`}
                onClick={() => setInput((p) => ({ ...p, correct_index: idx }))}
                className={cn(
                  "tnum flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border text-sm font-bold transition-all",
                  input.correct_index === idx
                    ? "border-ok/50 bg-ok-deep text-ok"
                    : "border-line-strong bg-surface text-mute hover:border-white/25",
                )}
              >
                {input.correct_index === idx ? "?" : letter}
              </button>
              <Input
                aria-label={`Texto da alternativa ${letter}`}
                placeholder={`Alternativa ${letter}`}
                value={input.options[idx]}
                onChange={(e) =>
                  setInput((p) => {
                    const options = [...p.options] as QuestionInput["options"];
                    options[idx] = e.target.value;
                    return { ...p, options };
                  })
                }
              />
            </div>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Disciplina" htmlFor="q-subject" required>
            <Select
              id="q-subject"
              value={input.subject_id}
              disabled={!!lockedSubjectId}
              onChange={(e) => setInput((p) => ({ ...p, subject_id: e.target.value, topic_id: null }))}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tema" htmlFor="q-topic" hint="Escolha existente ou digite um novo tema.">
            <Input
              id="q-topic"
              list="topic-options"
              placeholder="Ex.: Frações"
              value={topicQuery || topics.find((t) => t.id === input.topic_id)?.name || ""}
              onChange={(e) => {
                setTopicQuery(e.target.value);
                const match = topics.find((t) => t.name.toLowerCase() === e.target.value.toLowerCase());
                setInput((p) => ({ ...p, topic_id: match?.id ?? null }));
              }}
            />
            <datalist id="topic-options">
              {topics.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Subtema (opcional)" htmlFor="q-subtopic">
            <Input
              id="q-subtopic"
              placeholder="Ex.: Operações básicas"
              value={input.subtopic}
              onChange={(e) => setInput((p) => ({ ...p, subtopic: e.target.value }))}
            />
          </Field>
          <Field label="Dificuldade" htmlFor="q-difficulty">
            <Select
              id="q-difficulty"
              value={input.difficulty}
              onChange={(e) => setInput((p) => ({ ...p, difficulty: e.target.value as Difficulty }))}
            >
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tempo próprio (s)" htmlFor="q-time" hint="Vazio = tempo padrão do quiz.">
            <Input
              id="q-time"
              type="number"
              min={5}
              max={600}
              placeholder="Padrão"
              value={input.time_override_seconds ?? ""}
              onChange={(e) =>
                setInput((p) => ({
                  ...p,
                  time_override_seconds: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </Field>
        </div>

        <Field label="Imagem (URL opcional)" htmlFor="q-image">
          <Input
            id="q-image"
            type="url"
            placeholder="https://…"
            value={input.image_url}
            onChange={(e) => setInput((p) => ({ ...p, image_url: e.target.value }))}
          />
        </Field>
      </div>
    </Modal>
  );
}
