"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Progress";
import { fetchDashboard } from "@/lib/api/diagnostics";
import { fmtDateTime, pctText } from "@/lib/utils";
import {
  IconAlertTriangle,
  IconChartBar,
  IconChevronRight,
  IconClipboardCheck,
  IconListDetails,
  IconSchool,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useAsync } from "@/hooks/useAsync";

export default function DashboardPage() {
  const { profile } = useAuth();
  const dash = useAsync(fetchDashboard, []);

  usePageHeader({
    breadcrumb: [{ label: "Dashboard" }],
    pill: profile?.school || "Painel geral",
  });

  const firstName = profile?.full_name.split(" ")[0] ?? "Professor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Olá, {firstName}</h1>
        <p className="mt-1 text-sm text-mute">Aqui está o resumo da sua atividade pedagógica.</p>
      </div>

      {dash.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-64 xl:col-span-2" />
          <Skeleton className="h-64 xl:col-span-2" />
        </div>
      ) : dash.error ? (
        <Card>
          <p className="py-8 text-center text-sm text-bad">{dash.error}</p>
          <div className="pb-2 text-center">
            <Button variant="outline" onClick={() => void dash.reload()}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : (
        dash.data && (
          <>
            <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<IconSchool size={20} stroke={1.7} />} label="Turmas cadastradas" value={dash.data.counts.classes} href="/professor/turmas" />
              <StatCard icon={<IconListDetails size={20} stroke={1.7} />} label="Quizzes criados" value={dash.data.counts.quizzes} href="/professor/quizzes" />
              <StatCard icon={<IconClipboardCheck size={20} stroke={1.7} />} label="Quizzes realizados" value={dash.data.counts.sessions_done} />
              <StatCard icon={<IconUsers size={20} stroke={1.7} />} label="Alunos participantes" value={dash.data.counts.students} />
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-col">
                <CardTitle right={<Badge tone="neutral">Últimos 6</Badge>}>Atividade recente</CardTitle>
                {!dash.data.recent.length ? (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <EmptyState
                      icon={<IconChartBar size={32} stroke={1.4} />}
                      title="Nenhum quiz realizado ainda"
                      description="Publique um quiz e inicie uma sala ao vivo."
                      action={
                        <Link
                          href="/professor/quizzes"
                          className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
                        >
                          Ver meus quizzes
                        </Link>
                      }
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {dash.data.recent.map((r) => (
                      <li key={r.session_id}>
                        <Link
                          href={`/professor/diagnosticos/${r.session_id}`}
                          className="group flex items-center gap-3 py-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink group-hover:text-accent-bright">
                              {r.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-faint">
                              {r.class_name} · {fmtDateTime(r.date)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="tnum block text-lg font-semibold text-ink">{r.participants}</span>
                            <span className="block text-[11px] text-faint">participantes</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span
                              className={`tnum block text-lg font-semibold ${
                                r.avg_pct === null ? "text-faint" : r.avg_pct >= 70 ? "text-ok" : r.avg_pct >= 50 ? "text-warn" : "text-bad"
                              }`}
                            >
                              {pctText(r.avg_pct)}
                            </span>
                            <span className="block text-[11px] text-faint">média</span>
                          </span>
                          <IconChevronRight size={16} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-mute" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="flex flex-col border-warn/15 bg-gradient-to-br from-surface to-warn-deep/40">
                <CardTitle right={<IconAlertTriangle size={17} className="text-warn" aria-hidden />}>
                  Atenção — conteúdos com baixo aproveitamento
                </CardTitle>
                {!dash.data.attention.length ? (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <EmptyState
                      icon={<IconChartBar size={32} stroke={1.4} />}
                      title="Nada crítico por aqui"
                      description="Quando algum tema ficar abaixo de 55% de acertos (com 5+ respostas), ele aparece aqui automaticamente."
                    />
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {dash.data.attention.map((a, i) => (
                      <li key={`${a.topic}-${a.class_name}-${i}`} className="rounded-xl border border-line bg-surface p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm leading-snug text-ink">
                            <strong>{a.topic}</strong> apresentou apenas{" "}
                            <strong className="text-bad">{pctText(a.pct)}</strong> de acertos na turma {a.class_name}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!!dash.data.recent.length && (
                  <Link
                    href="/professor/diagnosticos"
                    className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-accent-bright hover:text-white"
                  >
                    Abrir diagnósticos completos <IconChevronRight size={15} aria-hidden />
                  </Link>
                )}
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <Card interactive={!href} className="flex items-center gap-4">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-deep text-accent-bright">
        {icon}
      </span>
      <span>
        <span className="tnum block text-3xl leading-none font-bold text-ink">{value}</span>
        <span className="mt-1.5 block text-xs text-mute">{label}</span>
      </span>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
