"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { StartSessionModal } from "@/components/teacher/StartSessionModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal, type ConfirmState } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { deleteQuiz, duplicateQuizRpc, listQuizzes, publishToLibrary, type QuizWithMeta } from "@/lib/api/quizzes";
import dynamic from "next/dynamic";
const QuizWizardModal = dynamic(() => import("@/components/teacher/QuizWizardModal").then((m) => m.QuizWizardModal), { ssr: false });
const AIQuizModal = dynamic(() => import("@/components/teacher/AIQuizModal").then((m) => m.AIQuizModal), { ssr: false });
import { fmtDate } from "@/lib/utils";
import {
  IconBookUpload,
  IconDotsVertical,
  IconListDetails,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSparkles,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useCachedAsync } from "@/hooks/useAsync";

type Filter = "todos" | "rascunho" | "publicado";

export default function QuizzesPage() {
  const toast = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [startingQuiz, setStartingQuiz] = useState<QuizWithMeta | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [aiQuizOpen, setAiQuizOpen] = useState(false);

  const { data: quizzes, loading, error, reload } = useCachedAsync(
    () => listQuizzes(filter === "todos" ? undefined : filter),
    [filter],
    `quizzes:${filter}`,
    30_000,
    "quizzes",
  );

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Quizzes" },
    ],
    pill: "Quizzes",
  });

  async function handleDuplicate(id: string) {
    try {
      const newId = await duplicateQuizRpc(id);
      toast("Quiz duplicado! Abra o editor para ajustar.", "ok");
      window.location.href = `/professor/quizzes/${newId}`;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao duplicar.", "bad");
    }
  }

  async function handlePublish(id: string, title: string) {
    try {
      await publishToLibrary(id);
      toast(`"${title}" publicado na Biblioteca!`, "ok");
      void reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao publicar.", "bad");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Quizzes</h1>
          <p className="mt-0.5 text-sm text-mute">Monte, publique e aplique seus quizzes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAiQuizOpen(true)}
            icon={<IconSparkles size={18} />}
            className="gap-2"
          >
            Novo quiz (IA)
          </Button>
          <Button onClick={() => setWizardOpen(true)} icon={<IconPlus size={18} />}>
            Novo quiz
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "todos", label: "Todos" },
          { id: "rascunho", label: "Rascunhos" },
          { id: "publicado", label: "Publicados" },
        ]}
        active={filter}
        onChange={(id) => setFilter(id as Filter)}
        className="max-w-md"
      />

      {error && (
        <Card>
          <p className="py-6 text-center text-sm text-bad">{error}</p>
          <div className="text-center pb-2">
            <Button variant="outline" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {!loading && !error && !quizzes?.length ? (
        <Card>
          <EmptyState
            icon={<IconListDetails size={36} stroke={1.4} />}
            title="Nenhum quiz encontrado"
            description={
              filter === "todos"
                ? "Crie seu primeiro quiz ou duplique um da Biblioteca."
                : `Nenhum quiz ${filter === "rascunho" ? "em rascunho" : "publicado"} por aqui.`
            }
          />
        </Card>
      ) : null}

      {!loading && !!quizzes?.length && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((q, i) => (
            <li key={q.id} className="stagger-item" style={{ animationDelay: `${i * 35}ms` }}>
              <Card interactive className="group relative flex h-full flex-col gap-3">
                <Link href={`/professor/quizzes/${q.id}`} className="block pr-8" aria-label={`Abrir quiz ${q.title}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display line-clamp-2 text-lg leading-snug font-semibold text-ink group-hover:text-accent-bright">
                      {q.title}
                    </h2>
                  </div>
                  {q.description && <p className="mt-1 line-clamp-2 text-sm text-mute">{q.description}</p>}
                </Link>

                <button
                  aria-label="Mais ações"
                  title="Mais ações"
                  onClick={() => setMenuFor(menuFor === q.id ? null : q.id)}
                  onBlur={() => setTimeout(() => setMenuFor(null), 150)}
                  className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <IconDotsVertical size={17} />
                </button>
                {menuFor === q.id && (
                  <div
                    role="menu"
                    className="acrylic absolute top-12 right-4 z-20 w-44 overflow-hidden p-1"
                  >
                    <MenuItem
                      label="Editar"
                      onClick={() => (window.location.href = `/professor/quizzes/${q.id}`)}
                    />
                    <MenuItem label="Duplicar" onClick={() => void handleDuplicate(q.id)} />
                    {q.question_count > 0 && q.status !== "publicado" && (
                      <MenuItem
                        icon={<IconBookUpload size={16} />}
                        label="Publicar na Biblioteca"
                        onClick={() => void handlePublish(q.id, q.title)}
                      />
                    )}
                    {q.status === "publicado" && q.question_count > 0 && (
                      <MenuItem label="Iniciar agora" onClick={() => setStartingQuiz(q)} />
                    )}
                    <MenuItem
                      danger
                      label="Excluir"
                      onClick={() =>
                        setConfirm({
                          title: `Excluir "${q.title}"?`,
                          message:
                            "As questões do banco permanecem, mas as aplicações e respostas deste quiz serão apagadas.",
                          confirmLabel: "Excluir quiz",
                          onConfirm: async () => {
                            try {
                              await deleteQuiz(q.id);
                              toast("Quiz excluído.", "ok");
                              setConfirm(null);
                              void reload();
                            } catch (err) {
                              toast(err instanceof Error ? err.message : "Erro.", "bad");
                            }
                          },
                        })
                      }
                    />
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Badge tone={q.status === "publicado" ? "ok" : "warn"}>
                    {q.status === "publicado" ? "Publicado" : "Rascunho"}
                  </Badge>
                  <Badge tone="neutral">{q.question_count} questões</Badge>
                  <span className="ml-auto text-xs text-faint">{fmtDate(q.created_at)}</span>
                </div>

                <div className="flex items-center gap-2">
                  {q.status === "publicado" && q.question_count > 0 ? (
                    <button
                      onClick={() => setStartingQuiz(q)}
                      className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent-deep text-sm font-medium text-accent-bright transition-colors hover:bg-accent hover:text-white"
                    >
                      <IconPlayerPlay size={15} /> Iniciar quiz
                    </button>
                  ) : (
                    <Link
                      href={`/professor/quizzes/${q.id}`}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 text-sm font-medium text-mute transition-colors hover:text-ink"
                    >
                      <IconPencil size={14} /> Continuar edição
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {startingQuiz && (
        <StartSessionModal
          open={!!startingQuiz}
          onClose={() => setStartingQuiz(null)}
          quizId={startingQuiz.id}
          quizTitle={startingQuiz.title}
        />
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />

      <QuizWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => {
          setWizardOpen(false);
          router.push(`/professor/quizzes/${id}`);
        }}
      />

      <AIQuizModal
        open={aiQuizOpen}
        onClose={() => setAiQuizOpen(false)}
      />
    </div>
  );
}

function MenuItem({ label, onClick, danger, icon }: { label: string; onClick: () => void; danger?: boolean; icon?: ReactNode }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        danger ? "text-bad hover:bg-bad-deep" : "text-mute hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
