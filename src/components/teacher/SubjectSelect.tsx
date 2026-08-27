"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  createSubject,
  listSubjects,
  normalizeName,
  subscribeSubjects,
} from "@/lib/api/taxonomy";
import type { Subject } from "@/types";
import { IconPlus } from "@tabler/icons-react";
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

  if (loading) {
    return <div className="input-base skeleton-pulse" aria-hidden />;
  }

  const hasEmptyLeading = leadingOptions.some((o) => o.value === "");

  return (
    <>
      <Select id={id} value={value} onChange={(e) => handleChange(e.target.value)} disabled={disabled} className={className}>
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
        {!disabled && (
          <option value={CREATE_VALUE}>+ Criar disciplina</option>
        )}
      </Select>

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
    </>
  );
}
