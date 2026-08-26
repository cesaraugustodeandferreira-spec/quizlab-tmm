"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { BarList, DonutStat } from "@/components/charts/Charts";
import { QuestionBreakdownModal } from "@/components/diagnostics/QuestionBreakdown";
import { Timeline } from "@/components/diagnostics/DiagnosticParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Progress";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { fetchSessionDiagnostics } from "@/lib/api/diagnostics";
import { DIFFICULTY_LABELS, SESSION_STATUS_LABELS } from "@/lib/scoring";
import { fmtDateTime, fmtRelative, pctText } from "@/lib/utils";
import type { QuestionDiag } from "@/types";
import { IconChartBar, IconDownload, IconTrophy } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";

export default function SessionDiagnosticsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionDiag | null>(null);

  const diag = useAsync(() => fetchSessionDiagnostics(sessionId), [sessionId]);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Diagnósticos", href: "/professor/diagnosticos" },
      { label: diag.data?.meta.title ?? "Carregando…" },
    ],
    pill: diag.data?.meta.class_name ?? null,
  });

  if (diag.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-80" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56 lg:col-span-2" />
          <Skeleton className="h-64 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (diag.error || !diag.data) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-bad">{diag.error}</p>
        <div className="pb-2 text-center">
          <Button variant="outline" onClick={() => void diag.reload()}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  const d = diag.data;
  const total = d.correct + d.wrong + d.unanswered;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{d.meta.title}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-mute">
            Turma {d.meta.class_name} · {fmtDateTime(d.meta.date)}
            <Badge tone={d.meta.status === "encerrada" ? "neutral" : "warn"}>
              {SESSION_STATUS_LABELS[d.meta.status]}
            </Badge>
          </p>
        </div>
        <Button
          variant="outline"
          icon={<IconDownload size={16} />}
          disabled={!d.students.length}
          onClick={() =>
            downloadCsv(
              `resultado-${slugify(d.meta.title)}-${slugify(d.meta.class_name)}.csv`,
              buildCsv(d.students, [
                { key: "name", label: "Aluno" },
                { key: "points", label: "Pontos" },
                { key: "correct", label: "Acertos" },
                { key: "wrong", label: "Erros" },
                { key: "unanswered", label: "Sem resposta" },
                { key: "avg_time_s", label: "Tempo médio (s)" },
              ]),
            )
          }
        >
          Exportar CSV
        </Button>
      </div>

      {!total ? (
        <Card>
          <EmptyState
            icon={<IconChartBar size={36} stroke={1.4} />}
            title="Nenhuma resposta registrada"
            description={
              d.participants > 0
                ? "Os alunos participaram, mas nenhuma questão foi concluída."
                : "Nenhum aluno entrou nesta sala."
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardTitle>Aproveitamento geral</CardTitle>
              <DonutStat
                segments={[
                  { label: "Acertos", value: d.correct, color: "#3ed598" },
                  { label: "Erros", value: d.wrong, color: "#f09595" },
                  { label: "Sem resposta", value: d.unanswered, color: "#6b6e76" },
                ]}
              />
              <p className="tnum mt-4 border-t border-line pt-4 text-center text-5xl font-bold text-ink">
                {pctText(d.overall_pct)}
              </p>
              <p className="mt-1 text-center text-xs text-faint">de acerto nas {total} respostas</p>
            </Card>

            <Card>
              <CardTitle>Números da aplicação</CardTitle>
              <dl className="grid grid-cols-2 gap-4">
                <Metric label="Participantes" value={String(d.participants)} />
                <Metric label="Média de pontos" value={d.avg_points !== null ? String(d.avg_points) : "—"} />
                <Metric label="Tempo médio de resposta" value={d.avg_time_s !== null ? `${d.avg_time_s}s` : "—"} />
                <Metric label="Questões no quiz" value={String(d.questions.length)} />
              </dl>
            </Card>

            <Card>
              <CardTitle>Linha do tempo</CardTitle>
              <Timeline
                items={[
                  {
                    title: "Sala criada",
                    time: fmtRelative(d.meta.created_at),
                    tone: "faint",
                    description: `Código ${d.meta.room_code}`,
                  },
                  ...(d.meta.started_at
                    ? [{ title: "Quiz iniciado", time: fmtRelative(d.meta.started_at), tone: "accent" as const }]
                    : []),
                  ...(d.meta.ended_at
                    ? [{ title: "Quiz encerrado", time: fmtRelative(d.meta.ended_at), tone: "ok" as const }]
                    : d.meta.status === "em_andamento"
                      ? [{ title: "Em andamento agora", tone: "warn" as const }]
                      : []),
                ]}
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Aproveitamento por tema</CardTitle>
              <BarList items={d.topics.map((t) => ({ label: t.label, value: t.pct, n: t.n }))} semantic className="[&_li]:px-0" />
            </Card>

            <Card>
              <CardTitle>Ranking · pontos de velocidade</CardTitle>
              {!d.students.length ? (
                <p className="py-6 text-center text-sm text-faint">Sem participantes.</p>
              ) : (
                <ol className="space-y-1.5">
                  {d.students.slice(0, 10).map((s, i) => (
                    <li
                      key={s.student_id}
                      className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                        s.class_student_id ? "hover:bg-surface-2" : ""
                      }`}
                    >
                      <span className={`tnum w-7 text-center text-sm font-bold ${i < 3 ? "text-warn" : "text-faint"}`}>
                        {i + 1}º
                      </span>
                      {s.class_student_id ? (
                        <Link
                          href={`/professor/alunos/${s.class_student_id}`}
                          className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent-bright"
                        >
                          {s.name}
                        </Link>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.name}</span>
                      )}
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-mute">
                        <IconTrophy size={13} className="text-faint" aria-hidden /> {s.correct}
                      </span>
                      <span className="tnum w-16 shrink-0 text-right text-sm font-semibold text-accent-bright">
                        {s.points} pts
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
                Pontos incluem bônus de velocidade e servem apenas ao placar. Todos os diagnósticos usam somente acertos e erros.
              </p>
            </Card>
          </div>

          <Card>
            <CardTitle>Questões mais difíceis desta aplicação</CardTitle>
            {!d.questions.length ? (
              <p className="py-6 text-center text-sm text-faint">O quiz não tem questões.</p>
            ) : (
              <ul className="space-y-2">
                {d.questions.map((q) => (
                  <li key={q.question_id}>
                    <button
                      onClick={() => setSelectedQuestion(q)}
                      aria-label={`Detalhes da questão ${q.position}`}
                      className="w-full cursor-pointer rounded-xl border border-line bg-surface-2/40 p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-deep"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 flex-1 text-sm text-ink">
                          <span className="mr-2 text-xs font-bold text-faint">{q.position}.</span>
                          {q.statement}
                        </p>
                        <span
                          className={`tnum shrink-0 text-lg font-bold ${
                            q.n === 0 ? "text-faint" : q.pct >= 70 ? "text-ok" : q.pct >= 50 ? "text-warn" : "text-bad"
                          }`}
                        >
                          {q.n === 0 ? "—" : pctText(q.pct)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{q.topic}</Badge>
                        <Badge tone="neutral">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                        <Badge tone={q.n === 0 ? "neutral" : q.pct >= 70 ? "ok" : q.pct >= 50 ? "accent" : "bad"}>
                          {q.n === 0 ? "sem respostas" : `${q.n} respostas`}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-faint">Clique em uma questão para ver a distribuição das alternativas.</p>
          </Card>
        </>
      )}

      <QuestionBreakdownModal question={selectedQuestion} onClose={() => setSelectedQuestion(null)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2/50 p-3">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="tnum mt-1 text-2xl font-semibold text-ink">{value}</dd>
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}
