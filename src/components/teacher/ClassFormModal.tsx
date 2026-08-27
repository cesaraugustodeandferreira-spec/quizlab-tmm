"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createClass, updateClass } from "@/lib/api/classes";
import type { ClassRoom } from "@/types";
import { useState } from "react";

export function ClassFormModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ClassRoom | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [gradeYear, setGradeYear] = useState(initial?.grade_year ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe o nome da turma.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        grade_year: gradeYear.trim(),
      };
      if (initial) await updateClass(initial.id, payload);
      else await createClass(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a turma.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar turma" : "Nova turma"}
      description="A turma serve para agrupar e filtrar diagnósticos por turma."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={(e) => handleSubmit(e as unknown as React.FormEvent)} loading={loading}>
            {initial ? "Salvar alterações" : "Criar turma"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-deep px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
        <Field label="Nome da turma" htmlFor="class-name" required>
          <Input
            id="class-name"
            placeholder="Ex.: 9º A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Série / ano" htmlFor="class-grade" hint="Ex.: 9º ano EF, 3ª série EM">
          <Input
            id="class-grade"
            placeholder="9º ano EF"
            value={gradeYear}
            onChange={(e) => setGradeYear(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
