"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Progress";
import { fetchAppliedQuizzes, fetchDashboard } from "@/lib/api/diagnostics";
import { listClasses } from "@/lib/api/classes";
import { fmtDateTime, pctText } from "@/lib/utils";
import type { ClassRoom } from "@/types";
import { IconArrowLeft, IconChartBar, IconChevronRight, IconSchool } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/useAsync";

export default function DiagnosticsPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [classes, setClasses] = useState<ClassRoom[] | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [applied, setApplied] = useState<Awaited<ReturnType<typeof fetchAppliedQuizzes>> | null>(null);
  const [appliedLoading, setAppliedLoading] = useState(false);
  const [appliedError, setAppliedError] = useState<string | null>(null);

  const dash = useAsync(fetchDashboard, []);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Diagnósticos" },
    ],
    pill: "Análise pedagógica",
  });

  useEffect(() => {
    if (!open || step !== 1 || classes) return;
    setClasses(null);
    listClasses()
      .then((list) => {
        if (!list.length) setClasses([]);
        else setClasses(list);
      })
      .catch(() => setClasses([]));
  }, [open, step, classes]);

  function closeModal() {
    setOpen(false);
    setStep(1);
    setSelectedClass(null);
    setApplied(null);
    setAppliedError(null);
  }

  async function pickClass(c: ClassRoom) {
    setSelectedClass(c);
    setStep(2);
    setApplied(null);
    setAppliedError(null);
    setAppliedLoading(true);
    try {
      setApplied(await fetchAppliedQuizzes(c.id));
    } catch (err) {
      setAppliedError(err instanceof Error ? err.message : "Erro ao carregar quizzes.");
    } finally {
      setAppliedLoading(false);
    }
  }

  function pickQuiz(sessionId: string) {
    closeModal();
    router.push(`/professor/diagnosticos/${sessionId}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Diagnósticos</h1>
        <p className="mt-0.5 text-sm text-mute">
          Escolha uma turma e um quiz aplicado para ver o diagnóstico detalhado da aplicação.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-accent-deep text-accent-bright">
          <IconChartBar size={26} stroke={1.6} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-ink">Diagnóstico por aplicação</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mute">
            O diagnóstico agregado da turma vive dentro de cada turma, em Minhas Turmas. Aqui você analisa
            quiz a quiz: temas, questões mais difíceis e desempenho individual.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} icon={<IconChartBar size={17} />}>
          Iniciar diagnóstico
        </Button>
      </Card>

      {!!dash.data?.recent.length && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-mute">Acessos rápidos · últimas aplicações</p>
          <ul className="divide-y divide-line">
            {dash.data!.recent.map((r) => (
              <li key={r.session_id}>
                <button
                  onClick={() => pickQuiz(r.session_id)}
                  className="group flex w-full cursor-pointer items-center gap-3 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink group-hover:text-accent-bright">{r.title}</span>
                    <span className="text-xs text-faint">{r.class_name} · {fmtDateTime(r.date)}</span>
                  </span>
                  <Badge tone={r.avg_pct !== null && r.avg_pct >= 70 ? "ok" : r.avg_pct !== null && r.avg_pct >= 50 ? "warn" : "bad"}>
                    {pctText(r.avg_pct)}
                  </Badge>
                  <IconChevronRight size={16} className="text-faint group-hover:text-mute" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={closeModal}
        size="md"
        title={step === 1 ? "Selecione a turma" : `Quizzes aplicados em ${selectedClass?.name ?? ""}`}
        description={step === 1 ? "Passo 1 de 2" : "Passo 2 de 2"}
      >
        {step === 1 ? (
          classes === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !classes.length ? (
            <EmptyState
              icon={<IconSchool size={32} stroke={1.4} />}
              title="Nenhuma turma cadastrada"
              description="Crie uma turma e aplique um quiz para gerar diagnósticos."
            />
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Turmas">
              {classes.map((c) => (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={false}
                    onClick={() => void pickClass(c)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-all hover:border-accent/40 hover:bg-accent-deep"
                  >
                    <IconSchool size={19} className="shrink-0 text-mute" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{c.name}</span>
                      <span className="text-xs text-faint">{c.grade_year || "Sem série definida"}</span>
                    </span>
                    <IconChevronRight size={17} className="shrink-0 text-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : appliedLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : appliedError ? (
          <EmptyState icon={<IconChartBar size={30} stroke={1.4} />} title="Erro ao carregar" description={appliedError} />
        ) : !applied?.length ? (
          <EmptyState
            icon={<IconChartBar size={30} stroke={1.4} />}
            title="Nenhum quiz aplicado"
            description={`A turma ${selectedClass?.name} ainda não realizou nenhum quiz.`}
            action={
              <Button variant="outline" icon={<IconArrowLeft size={16} />} onClick={() => setStep(1)}>
                Voltar para turmas
              </Button>
            }
          />
        ) : (
          <>
            <ul className="space-y-2" aria-label="Quizzes aplicados">
              {applied.map((q) => (
                <li key={q.session_id}>
                  <button
                    onClick={() => pickQuiz(q.session_id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-all hover:border-accent/40 hover:bg-accent-deep"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{q.title}</span>
                      <span className="text-xs text-faint">
                        {fmtDateTime(q.date)} · {q.participants} participantes
                      </span>
                    </span>
                    <Badge tone={q.avg_pct !== null && q.avg_pct >= 70 ? "ok" : q.avg_pct !== null && q.avg_pct >= 50 ? "warn" : "bad"}>
                      {pctText(q.avg_pct)}
                    </Badge>
                    <IconChevronRight size={17} className="shrink-0 text-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button variant="ghost" icon={<IconArrowLeft size={16} />} onClick={() => setStep(1)}>
                Voltar
              </Button>
            </div>
          </>
        )}
      </Modal>

      {!open && null}
    </div>
  );
}
