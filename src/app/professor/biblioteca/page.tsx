"use client";

import { usePageHeader } from "@/components/layout/ProfessorShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { fetchLibrary } from "@/lib/api/diagnostics";
import { duplicateQuizRpc } from "@/lib/api/quizzes";
import { fmtDate } from "@/lib/utils";
import { IconBooks, IconCopy as CopyIcon, IconListCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useCachedAsync } from "@/hooks/useAsync";

export default function LibraryPage() {
  const toast = useToast();
  const library = useCachedAsync(fetchLibrary, [], "biblioteca", 60_000, "biblioteca");
  const [usingId, setUsingId] = useState<string | null>(null);

  usePageHeader({
    breadcrumb: [
      { label: "Início", href: "/professor/dashboard" },
      { label: "Biblioteca" },
    ],
    pill: "Quizzes compartilhados",
  });

  async function handleUse(id: string) {
    setUsingId(id);
    try {
      const newId = await duplicateQuizRpc(id);
      toast("Quiz copiado para sua conta! Abrindo editor…", "ok");
      window.location.href = `/professor/quizzes/${newId}`;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao copiar o quiz.", "bad");
      setUsingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Biblioteca</h1>
        <p className="mt-0.5 text-sm text-mute">
          Quizzes publicados por você e por outros professores da escola — duplique e adapte para a sua turma.
        </p>
      </div>

      {library.error && (
        <Card>
          <p className="py-6 text-center text-sm text-bad">{library.error}</p>
          <div className="pb-2 text-center">
            <Button variant="outline" onClick={() => void library.reload()}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {library.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !library.data?.length ? (
        <Card>
          <EmptyState
            icon={<IconBooks size={36} stroke={1.4} />}
            title="A biblioteca está vazia por enquanto"
            description="Publique um quiz pelo menu de ações para vê-lo aqui, junto com os de outros professores."
            action={
              <Button variant="outline" onClick={() => void library.reload()}>
                Atualizar
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {library.data.map((item, i) => (
            <li key={item.id} className="stagger-item" style={{ animationDelay: `${i * 35}ms` }}>
              <Card className="flex h-full flex-col gap-3">
                <h2 className="font-display line-clamp-2 text-lg leading-snug font-semibold text-ink">
                  {item.title}
                </h2>
                {item.description && <p className="line-clamp-3 text-sm text-mute">{item.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{item.subject}</Badge>
                  <Badge tone="neutral">{item.question_count} questões</Badge>
                  <Badge tone="neutral">⏱ {item.default_time_seconds}s/questão</Badge>
                </div>
                <p className="text-xs text-faint">
                  Por {item.author ?? "Professor"} · {fmtDate(item.created_at)}
                </p>
                <div className="mt-auto border-t border-line pt-3">
                  <Button
                    className="w-full"
                    icon={<CopyIcon size={16} />}
                    loading={usingId === item.id}
                    disabled={usingId !== null}
                    onClick={() => void handleUse(item.id)}
                  >
                    Usar este quiz
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!library.loading && !!library.data?.length && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-faint">
          <IconListCheck size={14} /> Ao usar um quiz, ele é duplicado para a sua conta com as mesmas questões.
        </p>
      )}
    </div>
  );
}
