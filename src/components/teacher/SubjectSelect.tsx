"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  createSubject,
  deleteSubject,
  listSubjects,
  normalizeName,
  subscribeSubjects,
} from "@/lib/api/taxonomy";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";

const CREATE_VALUE = "__create_subject__";
const MAX_NAME = 60;

interface Option {
  value: string;
  label: string;
}

interface SubjectSelectProps {
  value: string;
  onChange: (id: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  leadingOptions?: Option[];
}

export function SubjectSelect({
  value,
  onChange,
  id,
  disabled,
  className,
  placeholder = "Selecione…",
  leadingOptions = [],
}: SubjectSelectProps) {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    try {
      const list = await listSubjects();
      setSubjects(list);
    } catch {
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const unsub = subscribeSubjects(() => void load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(next: string) {
    if (next === CREATE_VALUE) {
      setError(null);
      setName("");
      setModalOpen(true);
      return;
    }
    onChange(next);
  }

  const trimmed = name.trim().replace(/\s+/g, " ");
  const valid = trimmed.length > 0 && trimmed.length <= MAX_NAME;

  async function handleCreate() {
    if (!valid || creating) return;
    const existing = subjects.find((s) => normalizeName(s.name) === normalizeName(name));
    if (existing) {
      setModalOpen(false);
      onChange(existing.id);
      toast("Disciplina já existe — selecionada.", "ok");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createSubject(trimmed);
      setSubjects((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created]));
      setModalOpen(false);
      setName("");
      onChange(created.id);
      toast("Disciplina criada.", "ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar disciplina.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSubject(value);
      setSubjects((prev) => prev.filter((s) => s.id !== value));
      const reset = leadingOptions.length ? leadingOptions[0].value : "";
      onChange(reset);
      setConfirmOpen(false);
      toast("Disciplina excluída.", "ok");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir disciplina.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="input-base skeleton-pulse" aria-hidden />;
  }

  const hasEmptyLeading = leadingOptions.some((o) => o.value === "");
  const selected = subjects.find((s) => s.id === value);
  const canDelete = !!selected && !!selected.teacher_id && !disabled;

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Select
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="flex-1 min-w-0"
        >
          {leadingOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {!hasEmptyLeading && <option value="">{placeholder}</option>}
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {!disabled && <option value={CREATE_VALUE}>+ Criar disciplina</option>}
        </Select>

        {canDelete && (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
            aria-label="Excluir disciplina"
            title="Excluir disciplina"
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-line-strong text-faint transition-colors hover:border-bad/40 hover:bg-bad-deep hover:text-bad"
          >
            <IconTrash size={18} />
          </button>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Criar disciplina"
        description="Digite o nome da nova disciplina para adicioná-la à sua lista."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} loading={creating} disabled={!valid}>
              {creating ? "Criando…" : "Criar"}
            </Button>
          </>
        }
      >
        <Field label="Nome da disciplina" htmlFor="new-subject-name" required>
          <Input
            id="new-subject-name"
            autoFocus
            maxLength={MAX_NAME}
            placeholder="Ex.: Biologia Celular"
            value={name}
            error={!!error}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) void handleCreate();
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-bad">
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Excluir disciplina?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} loading={deleting}>
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-mute">
          A disciplina <span className="font-medium text-ink">{selected?.name}</span> e todos os
          quizzes, questões e respostas vinculados serão apagados permanentemente. Esta ação não pode
          ser desfeita.
        </p>
        {deleteError && (
          <p role="alert" className="mt-3 flex items-center gap-1 text-sm text-bad">
            <span aria-hidden>⚠</span> {deleteError}
          </p>
        )}
      </Modal>
    </>
  );
}
