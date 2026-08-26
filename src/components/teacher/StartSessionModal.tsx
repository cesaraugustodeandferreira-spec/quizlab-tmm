"use client";

import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { listClasses } from "@/lib/api/classes";
import { createSession } from "@/lib/api/sessions";
import type { ClassRoom } from "@/types";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function StartSessionModal({
  open,
  onClose,
  quizId,
  quizTitle,
}: {
  open: boolean;
  onClose: () => void;
  quizId: string;
  quizTitle: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassRoom[] | null>(null);
  const [classId, setClassId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClasses(null);
    setClassId("");
    setError(null);
    listClasses()
      .then((list) => {
        setClasses(list);
        if (list.length === 1) setClassId(list[0].id);
        if (list.length === 0) {
          setError("Você precisa criar uma turma antes de iniciar um quiz.");
        }
      })
      .catch(() => setError("Não foi possível carregar suas turmas."));
  }, [open]);

  async function handleStart() {
    if (!classId) {
      setError("Selecione a turma que receberá este quiz.");
      return;
    }
    setLoading(true);
    try {
      const session = await createSession(quizId, classId);
      router.push(`/professor/sala/${session.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao criar sala.", "bad");
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Iniciar quiz"
      description={quizTitle}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button icon={<IconPlayerPlay size={17} />} onClick={() => void handleStart()} loading={loading} disabled={!classes}>
            Criar sala ao vivo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-[10px] border border-warn/30 bg-warn-deep px-4 py-3 text-sm text-warn">
            {error}
          </p>
        )}
        <Field label="Turma participante" htmlFor="session-class" required>
          <Select
            id="session-class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={!classes || loading}
          >
            <option value="" disabled>
              {classes ? "Selecione uma turma…" : "Carregando turmas…"}
            </option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.grade_year ? ` · ${c.grade_year}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs leading-relaxed text-faint">
          Uma sala com código de 6 caracteres será gerada. Projete a tela da sala e peça para os alunos
          entrarem em {"/entrar"} pelo celular.
        </p>
      </div>
    </Modal>
  );
}
