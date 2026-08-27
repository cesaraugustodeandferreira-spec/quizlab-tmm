"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { DonutStat, BarList } from "@/components/charts/Charts";
import { MasteryBadge } from "@/components/diagnostics/DiagnosticParts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { fetchClassDiagnostics } from "@/lib/api/diagnostics";
import { listClasses } from "@/lib/api/classes";
import { listSubjects } from "@/lib/api/taxonomy";
import { DIFFICULTY_LABELS } from "@/lib/scoring";
import { fmtDate, fmtDateTime, pctText, cn } from "@/lib/utils";
import type { ClassRoom, Subject, ClassDiagnostics } from "@/types";
import {
  IconArrowLeft,
  IconChartBar,
  IconChevronRight,
  IconDownload,
  IconSchool,
  IconTarget,
  IconX,
} from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { buildCsv, downloadCsv } from "@/lib/csv";

function DiagnosticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const selectedClassId = searchParams.get("class");

  const [classes, setClasses] = useState<ClassRoom[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Diagnósticos" },
      ...(selectedClassId && classes
        ? [{ label: classes.find((c) => c.id === selectedClassId)?.name ?? "Turma" }]
        : []),
    ],
    pill: "Análise pedagógica",
  });

  useEffect(() => {
    if (classes) return;
    listClasses()
      .then((list) => setClasses(list))
      .catch(() => setClasses([]));
  }, [classes]);

  useEffect(() => {
    if (subjects) return;
    listSubjects()
      .then((list) => setSubjects(list))
      .catch(() => setSubjects([]));
  }, [subjects]);

  function close() {
    router.push("/professor/diagnosticos");
  }

  function selectClass(id: string) {
    router.push(`/professor/diagnosticos?class=${id}`);
  }

  function goToSession(sessionId: string) {
    router.push(`/professor/diagnosticos/${sessionId}?returnClass=${selectedClassId ?? ""}`);
  }

  if (!selectedClassId) {
    return <ClassPickerStep classes={classes} onSelect={selectClass} />;
  }

  return (
    <ClassAggregateStep
      classId={selectedClassId}
      classes={classes}
      subjects={subjects}
      subjectFilter={subjectFilter}
      onSubjectFilter={setSubjectFilter}
      onSelectSession={goToSession}
      onBack={() => close()}
    />
  );
}

function ClassPickerStep({
  classes,
  onSelect,
}: {
  classes: ClassRoom[] | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Diagnósticos</h1>
          <p className="mt-0.5 text-sm text-mute">
            Selecione uma turma para ver o diagnóstico agregado e os quizzes aplicados.
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-accent-deep text-accent-bright">
          <IconChartBar size={26} stroke={1.6} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-ink">Selecione uma turma</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mute">
            Escolha a turma para ver o desempenho geral e os quizzes aplicados.
          </p>
        </div>
      </Card>

      {classes === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !classes.length ? (
        <Card>
          <EmptyState
            icon={<IconSchool size={32} stroke={1.4} />}
            title="Nenhuma turma cadastrada"
            description="Crie uma turma e aplique um quiz para gerar diagnósticos."
          />
        </Card>
      ) : (
        <ul className="space-y-2" role="listbox" aria-label="Turmas">
          {classes.map((c) => (
            <li key={c.id}>
              <button
                role="option"
                aria-selected={false}
                onClick={() => onSelect(c.id)}
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
      )}
    </div>
  );
}

function ClassAggregateStep({
  classId,
  classes,
  subjects,
  subjectFilter,
  onSubjectFilter,
  onSelectSession,
  onBack,
}: {
  classId: string;
  classes: ClassRoom[] | null;
  subjects: Subject[] | null;
  subjectFilter: string;
  onSubjectFilter: (v: string) => void;
  onSelectSession: (sessionId: string) => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [quizFilter, setQuizFilter] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const subjectId = subjectFilter === "all" ? null : subjectFilter;
  const diag = useAsync(() => fetchClassDiagnostics(classId, subjectId), [classId, subjectId]);

  const [quizFilterOptions, setQuizFilterOptions] = useState<string[]>([]);
  useEffect(() => {
    if (diag.data?.history) {
      setQuizFilterOptions([...new Set(diag.data.history.map((h) => h.title))]);
    }
  }, [diag.data?.history]);

  const filteredHistory = useMemo(() => {
    if (!diag.data?.history) return [];
    return diag.data.history.filter((h) => {
      if (quizFilter !== "todos" && h.title !== quizFilter) return false;
      if (from && h.date && new Date(h.date) < new Date(`${from}T00:00:00`)) return false;
      if (to && h.date && new Date(h.date) > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [diag.data?.history, quizFilter, from, to]);

  if (diag.loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (diag.error || !diag.data) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-bad">{diag.error}</p>
        <div className="text-center">
          <Button variant="outline" onClick={() => void diag.reload()}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  const d = diag.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Voltar"
            >
              <IconArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">{d.class.name}</h1>
              <p className="mt-0.5 text-sm text-mute">
                {d.class.grade_year && <>{d.class.grade_year} · </>}
                {d.sessions_count} {d.sessions_count === 1 ? "quiz realizado" : "quizzes realizados"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subjects && subjects.length > 0 && (
            <Field label="Disciplina" htmlFor="subject-filter">
              <Select
                id="subject-filter"
                value={subjectFilter}
                onChange={(e) => onSubjectFilter(e.target.value)}
                className="w-48"
              >
                <option value="all">Todas as disciplinas</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </div>

      <AggregateDiagnostics data={d} />

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">Quizzes aplicados</h2>
          <Button
            variant="outline"
            icon={<IconDownload size={16} />}
            onClick={() =>
              downloadCsv(
                `historico-${d.class.name}.csv`,
                buildCsv(filteredHistory, [
                  { key: "title", label: "Quiz" },
                  { key: "date", label: "Data", value: (r) => fmtDateTime(r.date) },
                  { key: "participants", label: "Participantes" },
                  { key: "avg_pct", label: "Aproveitamento (%)", value: (r) => r.avg_pct ?? "" },
                ]),
              )
            }
            disabled={!filteredHistory.length}
          >
            Exportar CSV
          </Button>
        </div>

        <Card className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1">
            <Field label="Filtrar por quiz" htmlFor="hist-quiz">
              <Select id="hist-quiz" value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
                <option value="todos">Todos os quizzes</option>
                {quizFilterOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="De" htmlFor="hist-from">
            <Input id="hist-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até" htmlFor="hist-to">
            <Input id="hist-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </Card>

        {filteredHistory.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconChartBar size={34} stroke={1.4} />}
              title="Nenhum quiz encontrado"
              description={d.history.length ? "Ajuste os filtros acima." : "Aplique o primeiro quiz a esta turma."}
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {filteredHistory.map((h) => (
              <li key={h.session_id}>
                <Card interactive className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => onSelectSession(h.session_id)}
                    className="min-w-48 flex-1 cursor-pointer text-left"
                  >
                    <p className="font-medium text-ink hover:text-accent-bright">{h.title}</p>
                    <p className="mt-0.5 text-xs text-faint">{fmtDateTime(h.date)}</p>
                  </button>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="tnum text-xl font-semibold text-ink">{h.participants}</p>
                      <p className="text-[11px] text-faint">participantes</p>
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "tnum text-xl font-semibold",
                          h.avg_pct === null ? "text-faint" : h.avg_pct >= 70 ? "text-ok" : h.avg_pct >= 50 ? "text-warn" : "text-bad",
                        )}
                      >
                        {pctText(h.avg_pct)}
                      </p>
                      <p className="text-[11px] text-faint">média</p>
                    </div>
                    <button
                      onClick={() => onSelectSession(h.session_id)}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
                    >
                      Ver diagnóstico
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AggregateDiagnostics({ data }: { data: ClassDiagnostics }) {
  const total = data.correct + data.wrong + data.unanswered;

  if (!total) {
    return (
      <Card>
        <EmptyState
          icon={<IconChartBar size={36} stroke={1.4} />}
          title="Sem dados de desempenho ainda"
          description="Aplique o primeiro quiz desta turma para gerar o diagnóstico agregado."
        />
      </Card>
    );
  }

  const strengths = ([...data.topics] as ({ pct: number | null } & typeof data.topics[number])[])
    .filter((t) => t.n >= 3 && t.pct !== null)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .slice(0, 3);
  const weaknesses = (data.topics.filter((t) => t.n >= 3 && t.pct !== null).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)) as (typeof data.topics[number] & { pct: number })[]).slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Aproveitamento geral</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <DonutStat
            segments={[
              { label: "Acertos", value: data.correct, color: "#3ed598" },
              { label: "Erros", value: data.wrong, color: "#f09595" },
              { label: "Sem resposta", value: data.unanswered, color: "#6b6e76" },
            ]}
          />
          <div className="text-right">
            <p className="tnum text-6xl font-bold text-ink">{pctText(data.overall_pct)}</p>
            <p className="mt-1 text-sm text-mute">de acerto no total</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Temas — do mais crítico ao melhor</CardTitle>
        <BarList
          items={data.topics.map((t) => ({ label: t.label, value: t.pct, n: t.n }))}
          emptyLabel="As questões ainda não têm temas definidos."
        />
      </Card>

      <Card>
        <CardTitle right={<IconTarget size={16} className="text-faint" />}>Questões mais difíceis</CardTitle>
        {data.hardest.length === 0 ? (
          <p className="py-4 text-center text-sm text-faint">Sem respostas suficientes.</p>
        ) : (
          <ol className="space-y-2">
            {data.hardest.map((q, i) => (
              <li key={q.question_id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                <span className="tnum mt-0.5 w-5 shrink-0 text-center text-sm font-bold text-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-ink">{q.statement}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <MasteryBadge pct={q.pct} />
                    <Badge tone="neutral">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <CardTitle>Pontos de atenção</CardTitle>
          {weaknesses.length === 0 ? (
            <p className="py-4 text-center text-sm text-faint">Nada crítico identificado.</p>
          ) : (
            <ul className="space-y-2">
              {weaknesses.map((t) => (
                <li key={t.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-mute">{t.label}</span>
                  <span className={`tnum font-semibold ${t.pct < 50 ? "text-bad" : "text-warn"}`}>
                    {pctText(t.pct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Pontos fortes</CardTitle>
          {strengths.length === 0 ? (
            <p className="py-4 text-center text-sm text-faint">Ainda sem temas consolidados.</p>
          ) : (
            <ul className="space-y-2">
              {[...strengths].reverse().map((t) => (
                <li key={t.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-mute">{t.label}</span>
                  <span className="tnum font-semibold text-ok">{pctText(t.pct)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48" />
      </div>
    }>
      <DiagnosticsContent />
    </Suspense>
  );
}
