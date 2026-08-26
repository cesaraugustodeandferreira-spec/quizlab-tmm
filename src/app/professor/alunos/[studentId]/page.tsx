"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { BarList, LineEvolution } from "@/components/charts/Charts";
import { DiffBlock, MasteryBadge } from "@/components/diagnostics/DiagnosticParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Progress";
import { fetchStudentDiagnostics } from "@/lib/api/diagnostics";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { fmtDate, pctText } from "@/lib/utils";
import { IconChartBar, IconDownload, IconTrendingDown, IconTrendingUp, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAsync } from "@/hooks/useAsync";

export default function StudentDiagnosticsPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;
  const diag = useAsync(() => fetchStudentDiagnostics(studentId), [studentId]);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Minhas Turmas", href: "/professor/turmas" },
      ...(diag.data ? [{ label: diag.data.class_name, href: `/professor/turmas/${diag.data.class_id}` }] : []),
      { label: diag.data?.name ?? "Aluno" },
    ],
    pill: diag.data?.class_name ?? null,
  });

  if (diag.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52 lg:col-span-2" />
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

  const withData = d.topics.filter((t) => t.n > 0 && t.pct !== null) as (typeof d.topics[number] & { pct: number })[];
  const strengths = [...withData].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const weaknesses = [...withData].sort((a, b) => a.pct - b.pct).slice(0, 3);
  const evolutionPoints = d.evolution.map((e) => ({ label: e.title, value: e.pct }));
  const validEvo = d.evolution.filter((e) => e.pct !== null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-accent-deep text-accent-bright">
            <IconUser size={26} stroke={1.6} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{d.name}</h1>
            <Link href={`/professor/turmas/${d.class_id}`} className="text-sm text-mute hover:text-accent-bright">
              Turma {d.class_name}
            </Link>
          </div>
        </div>
        <Button
          variant="outline"
          icon={<IconDownload size={16} />}
          disabled={!total}
          onClick={() =>
            downloadCsv(
              `diagnostico-${slug(d.name)}.csv`,
              buildCsv(d.topics, [
                { key: "label", label: "Tema" },
                { key: "pct", label: "Aproveitamento (%)", value: (r) => r.pct ?? "" },
                { key: "n", label: "Respostas" },
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
            title="Sem dados de desempenho"
            description={`${d.name} ainda não respondeu nenhum quiz. O diagnóstico aparece após a primeira participação.`}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center text-center">
              <CardTitle>Aproveitamento geral</CardTitle>
              <p className="tnum mt-2 text-7xl font-bold text-ink">{pctText(d.overall_pct)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge tone="ok">{d.correct} acertos</Badge>
                <Badge tone="bad">{d.wrong} erros</Badge>
                <Badge tone="warn">{d.unanswered} sem resposta</Badge>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-xs text-faint">
                {d.sessions_count} {d.sessions_count === 1 ? "quiz realizado" : "quizzes realizados"}
              </p>
            </Card>

            <Card>
              <CardTitle right={<IconTrendingUp size={16} className="text-ok" aria-hidden />}>Pontos fortes</CardTitle>
              {!strengths.length ? (
                <p className="py-6 text-center text-sm text-faint">Sem temas com dados suficientes.</p>
              ) : (
                <ul className="space-y-3">
                  {[...strengths].reverse().map((t) => (
                    <li key={t.label} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-ink">{t.label}</span>
                      <MasteryBadge pct={t.pct} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle right={<IconTrendingDown size={16} className="text-warn" aria-hidden />}>Pontos de atenção</CardTitle>
              {!weaknesses.length ? (
                <p className="py-6 text-center text-sm text-faint">Nada crítico identificado.</p>
              ) : (
                <ul className="space-y-3">
                  {weaknesses.map((t) => (
                    <li key={t.label} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-ink">{t.label}</span>
                      <MasteryBadge pct={t.pct} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Evolução ao longo dos quizzes</CardTitle>
              <LineEvolution points={evolutionPoints} />
              {validEvo.length >= 2 && (
                <div className="mt-4 max-w-md">
                  <DiffBlock
                    label={`Evolução · ${validEvo[0].title.slice(0, 24)} → ${validEvo[validEvo.length - 1].title.slice(0, 24)}`}
                    oldValue={`${pctText(validEvo[0].pct)} em ${fmtDate(validEvo[0].date)}`}
                    newValue={`${pctText(validEvo[validEvo.length - 1].pct)} em ${fmtDate(validEvo[validEvo.length - 1].date)}`}
                  />
                </div>
              )}
            </Card>

            <Card>
              <CardTitle>Domínio por tema</CardTitle>
              <BarList items={d.topics.map((t) => ({ label: t.label, value: t.pct, n: t.n }))} semantic />
            </Card>
          </div>

          <Card>
            <CardTitle>Questões mais erradas por este aluno</CardTitle>
            {!d.missed.length ? (
              <p className="py-6 text-center text-sm text-faint">Nenhuma questão errada registrada.</p>
            ) : (
              <ul className="space-y-2">
                {d.missed.map((q) => (
                  <li key={q.question_id} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/40 p-3.5">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm text-ink">{q.statement}</p>
                      <Badge tone="neutral" className="mt-1.5">
                        {q.topic}
                      </Badge>
                    </div>
                    <span className={`tnum shrink-0 text-lg font-bold ${q.pct < 50 ? "text-bad" : "text-warn"}`}>
                      {pctText(q.pct)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="px-1 text-[11px] leading-relaxed text-faint">
            As classificações refletem exclusivamente o desempenho acadêmico nas respostas registradas — nunca
            características pessoais ou condições individuais.
          </p>
        </>
      )}
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}
