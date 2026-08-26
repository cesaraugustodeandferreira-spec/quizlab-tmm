"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { DonutStat, BarList } from "@/components/charts/Charts";
import { MasteryBadge } from "@/components/diagnostics/DiagnosticParts";
import { ClassFormModal } from "@/components/teacher/ClassFormModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { ConfirmModal, type ConfirmState } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { addStudent, listClassStudents, removeStudent, renameStudent, updateClass } from "@/lib/api/classes";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { DIFFICULTY_LABELS } from "@/lib/scoring";
import { fmtDate, fmtDateTime, pctText, cn } from "@/lib/utils";
import type { ClassRoom, ClassStudent } from "@/types";
import {
  IconChartBar,
  IconDownload,
  IconPencil,
  IconTarget,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { fetchClassDiagnostics } from "@/lib/api/diagnostics";

type TabId = "diagnostico" | "historico" | "alunos";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = Array.isArray(params.id) ? params.id[0] : params.id;
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("diagnostico");
  const [editOpen, setEditOpen] = useState(false);

  const diag = useAsync(() => fetchClassDiagnostics(classId), [classId]);
  const roster = useAsync(() => listClassStudents(classId), [classId]);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Minhas Turmas", href: "/professor/turmas" },
      { label: diag.data?.class.name ?? "Turma" },
    ],
    pill: diag.data?.class.name ?? null,
  });

  if (diag.loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <Tabs tabs={[]} active="diagnostico" onChange={() => {}} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-72 lg:col-span-2" />
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
          <h1 className="font-display text-2xl font-bold text-ink">{d.class.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-mute">
            {d.class.grade_year && <span>{d.class.grade_year} ·</span>}
            {d.sessions_count} {d.sessions_count === 1 ? "quiz realizado" : "quizzes realizados"}
            <button
              onClick={() => setEditOpen(true)}
              aria-label="Editar turma"
              className="ml-1 cursor-pointer rounded p-1 text-faint transition-colors hover:text-ink"
            >
              <IconPencil size={14} />
            </button>
          </p>
        </div>
        <Badge tone="neutral">{roster.data?.length ?? d.students.length} alunos na turma</Badge>
      </div>

      <Tabs
        tabs={[
          { id: "diagnostico", label: "Diagnóstico da Turma" },
          { id: "historico", label: "Histórico" },
          { id: "alunos", label: "Alunos" },
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "diagnostico" && <DiagTab data={d} />}
      {tab === "historico" && (
        <HistoryTab
          history={d.history}
          onExport={() =>
            downloadCsv(
              `historico-${slug(d.class.name)}.csv`,
              buildCsv(d.history, [
                { key: "title", label: "Quiz" },
                { key: "date", label: "Data", value: (r) => fmtDateTime(r.date) },
                { key: "participants", label: "Participantes" },
                { key: "avg_pct", label: "Aproveitamento (%)", value: (r) => r.avg_pct ?? "" },
              ]),
            )
          }
        />
      )}
      {tab === "alunos" && <StudentsTab classId={classId} diagStudents={d.students} roster={roster} onRefreshAll={() => { void roster.reload(); void diag.reload(); }} />}

      {editOpen && (
        <ClassFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={
            {
              id: d.class.id,
              name: d.class.name,
              grade_year: d.class.grade_year,
              identifier: null,
              teacher_id: "",
              access_code: "",
              created_at: "",
            } satisfies ClassRoom
          }
          onSaved={() => {
            toast("Turma atualizada.", "ok");
            void diag.reload();
          }}
        />
      )}
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}

function DiagTab({ data }: { data: Awaited<ReturnType<typeof fetchClassDiagnostics>> }) {
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

function HistoryTab({
  history,
  onExport,
}: {
  history: { session_id: string; title: string; date: string | null; participants: number; avg_pct: number | null }[];
  onExport: () => void;
}) {
  const [quizFilter, setQuizFilter] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const quizOptions = useMemo(() => [...new Set(history.map((h) => h.title))], [history]);

  const filtered = history.filter((h) => {
    if (quizFilter !== "todos" && h.title !== quizFilter) return false;
    if (from && h.date && new Date(h.date) < new Date(`${from}T00:00:00`)) return false;
    if (to && h.date && new Date(h.date) > new Date(`${to}T23:59:59`)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1">
          <Field label="Filtrar por quiz" htmlFor="hist-quiz">
            <Select id="hist-quiz" value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
              <option value="todos">Todos os quizzes</option>
              {quizOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
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
        <Button variant="outline" icon={<IconDownload size={16} />} onClick={onExport} disabled={!filtered.length}>
          Exportar CSV
        </Button>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconChartBar size={34} stroke={1.4} />}
            title="Nenhum quiz encontrado"
            description={history.length ? "Ajuste os filtros acima." : "Aplique o primeiro quiz a esta turma."}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((h) => (
            <li key={h.session_id}>
              <Card interactive className="flex flex-wrap items-center gap-4">
                <Link href={`/professor/diagnosticos/${h.session_id}`} className="min-w-48 flex-1">
                  <p className="font-medium text-ink">{h.title}</p>
                  <p className="mt-0.5 text-xs text-faint">{fmtDateTime(h.date)}</p>
                </Link>
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
                  <Link
                    href={`/professor/diagnosticos/${h.session_id}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-bright"
                  >
                    Ver diagnóstico
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentsTab({
  classId,
  diagStudents,
  roster,
  onRefreshAll,
}: {
  classId: string;
  diagStudents: { student_id: string; name: string; sessions: number; avg_pct: number | null }[];
  roster: { data: ClassStudent[] | null; loading: boolean };
  onRefreshAll: () => void;
}) {
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim().length < 2) {
      toast("Informe o nome do aluno.", "bad");
      return;
    }
    setAdding(true);
    try {
      await addStudent(classId, newName.trim());
      setNewName("");
      toast("Aluno adicionado.", "ok");
      onRefreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao adicionar.", "bad");
    } finally {
      setAdding(false);
    }
  }

  async function saveRename(id: string) {
    try {
      await renameStudent(id, editName.trim());
      setEditingId(null);
      onRefreshAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao renomear.", "bad");
    }
  }

  const statById = new Map(diagStudents.map((s) => [s.student_id, s]));

  return (
    <>
      <Card className="mb-4">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 sm:flex-nowrap">
          <div className="min-w-52 flex-1">
            <Field label="Adicionar aluno à turma" htmlFor="new-student">
              <Input
                id="new-student"
                placeholder="Nome completo do aluno"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" loading={adding} icon={<IconUserPlus size={17} />} className="mb-0.5">
            Adicionar
          </Button>
          <p className="w-full pt-1 text-xs text-faint sm:w-auto sm:max-w-xs sm:pt-0 sm:pb-1.5">
            Alunos que entrarem pelo código da sala e ainda não estiverem na lista são adicionados automaticamente.
          </p>
        </form>
      </Card>

      {roster.loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !roster.data?.length ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} stroke={1.4} />}
            title="Nenhum aluno na turma"
            description="Adicione manualmente ou compartilhe o código da sala para eles entrarem no próximo quiz."
          />
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roster.data.map((s) => {
            const stat = statById.get(s.id);
            return (
              <li key={s.id}>
                <Card interactive className="group flex items-center gap-3 py-4">
                  {editingId === s.id ? (
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-mute">
                        {initialOf(s.name)}
                      </span>
                      <input
                        autoFocus
                        aria-label="Novo nome do aluno"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void saveRename(s.id)}
                        onBlur={() => void saveRename(s.id)}
                        className="input-base h-9 flex-1 py-1"
                      />
                    </span>
                  ) : (
                    <Link
                      href={`/professor/alunos/${s.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                      aria-label={`Ver diagnóstico de ${s.name}`}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-mute">
                        {initialOf(s.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink group-hover:text-accent-bright">
                          {s.name}
                        </span>
                        <span className="mt-1 block">
                          <MasteryBadge pct={stat?.avg_pct ?? null} />
                        </span>
                      </span>
                    </Link>
                  )}
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {editingId === s.id ? (
                      <button
                        onClick={() => void saveRename(s.id)}
                        aria-label="Salvar nome"
                        className="cursor-pointer rounded-lg p-1.5 text-ok hover:bg-ok-deep"
                      >
                        ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setEditName(s.name);
                        }}
                        aria-label={`Renomear ${s.name}`}
                        className="cursor-pointer rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
                      >
                        <IconPencil size={15} />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setConfirm({
                          title: `Remover ${s.name}?`,
                          message:
                            "Todas as respostas e histórico deste aluno nas sessões da turma serão apagados junto.",
                          confirmLabel: "Remover aluno",
                          onConfirm: async () => {
                            try {
                              await removeStudent(s.id);
                              toast("Aluno removido.", "ok");
                              setConfirm(null);
                              onRefreshAll();
                            } catch (err) {
                              toast(err instanceof Error ? err.message : "Erro.", "bad");
                            }
                          },
                        })
                      }
                      aria-label={`Remover ${s.name}`}
                      className="cursor-pointer rounded-lg p-1.5 text-faint hover:bg-bad-deep hover:text-bad"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                      </svg>
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function initialOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}
