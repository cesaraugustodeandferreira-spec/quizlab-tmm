"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { ClassFormModal } from "@/components/teacher/ClassFormModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Progress";
import { ConfirmModal, type ConfirmState } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteClass, listClasses } from "@/lib/api/classes";
import { fmtDate } from "@/lib/utils";
import type { ClassRoom } from "@/types";
import { IconCopy, IconPencil, IconPlus, IconSchool, IconTrash, IconUsers } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";

export default function ClassesPage() {
  const toast = useToast();
  const { data: classes, loading, error, reload } = useAsync(listClasses, []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Minhas Turmas" },
    ],
    pill: "Turmas",
  });

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    toast(`Código ${code} copiado.`, "ok");
  }

  if (error) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-bad">{error}</p>
        <div className="text-center">
          <Button variant="outline" onClick={() => void reload()}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Minhas Turmas</h1>
          <p className="mt-0.5 text-sm text-mute">
            Organize alunos por turma e acompanhe o desempenho de cada uma.
          </p>
        </div>
        <Button
          icon={<IconPlus size={18} />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Nova turma
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !classes?.length ? (
        <Card>
          <EmptyState
            icon={<IconSchool size={36} stroke={1.4} />}
            title="Nenhuma turma cadastrada"
            description="Crie sua primeira turma para começar a aplicar quizzes e acompanhar diagnósticos."
            action={<Button icon={<IconPlus size={18} />} onClick={() => setFormOpen(true)}>Criar turma</Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Card interactive className="flex h-full flex-col gap-4">
                <Link href={`/professor/turmas/${c.id}`} className="block" aria-label={`Abrir turma ${c.name}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display truncate text-xl font-semibold text-ink">{c.name}</h2>
                    <Badge tone="accent">{c.grade_year || "Turma"}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-faint">
                    Criada em {fmtDate(c.created_at)}
                    {c.identifier && <> · {c.identifier}</>}
                  </p>
                </Link>

                <button
                  onClick={() => copyCode(c.access_code)}
                  aria-label={`Copiar código da turma ${c.name}`}
                  className="group flex cursor-pointer items-center justify-between rounded-[10px] border border-dashed border-line-strong px-3 py-2 transition-colors hover:bg-surface-2"
                  title="Clique para copiar"
                >
                  <span className="font-display text-lg font-bold tracking-[0.25em] text-accent-bright">
                    {c.access_code}
                  </span>
                  <IconCopy size={15} className="text-faint group-hover:text-mute" />
                </button>

                <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
                  <Link
                    href={`/professor/turmas/${c.id}`}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 text-sm font-medium text-ink transition-colors hover:bg-accent-deep hover:text-accent-bright"
                  >
                    <IconUsers size={15} /> Abrir turma
                  </Link>
                  <button
                    aria-label={`Editar ${c.name}`}
                    title="Editar"
                    onClick={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    className="rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <IconPencil size={16} />
                  </button>
                  <button
                    aria-label={`Excluir ${c.name}`}
                    title="Excluir"
                    onClick={() =>
                      setConfirm({
                        title: `Excluir turma ${c.name}?`,
                        message:
                          "Todos os alunos, sessões e respostas vinculados a esta turma serão apagados permanentemente. Esta ação não pode ser desfeita.",
                        confirmLabel: "Excluir turma",
                        onConfirm: async () => {
                          try {
                            await deleteClass(c.id);
                            toast("Turma excluída.", "ok");
                            setConfirm(null);
                            void reload();
                          } catch (err) {
                            toast(err instanceof Error ? err.message : "Erro ao excluir.", "bad");
                          }
                        },
                      })
                    }
                    className="rounded-lg p-2 text-faint transition-colors hover:bg-bad-deep hover:text-bad"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <ClassFormModal
          key={editing?.id ?? "new"}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          initial={editing}
          onSaved={() => {
            toast(editing ? "Turma atualizada." : "Turma criada!", "ok");
            void reload();
          }}
        />
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} loading={false} />
    </div>
  );
}
