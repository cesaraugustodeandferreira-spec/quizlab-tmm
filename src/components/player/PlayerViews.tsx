"use client";

import { IconTrophy, IconListCheck } from "@tabler/icons-react";
import type { PlayerView } from "@/types";
import { LETTERS, pctText } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export function LobbyView({ view, name }: { view: PlayerView; name: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-14 text-center">
      <div className="w-full rounded-3xl border border-line bg-surface/70 p-8 shadow-soft">
        <p className="text-xs font-medium tracking-wide text-mute uppercase">Sala de espera</p>
        <h1 className="font-display mt-3 text-3xl font-bold text-balance text-ink">{view.quiz_title}</h1>
        <p className="mt-1 text-sm text-mute">Turma {view.class_name}</p>

        <p className="mt-6 text-sm text-mute">
          Olá, <strong className="text-ink">{name}</strong>. Aguarde o professor iniciar o quiz.
        </p>

        <span aria-hidden className="mt-8 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2.5 animate-bounce rounded-full bg-accent-bright"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </div>

      <dl className="mt-6 grid w-full grid-cols-2 gap-3 text-left" aria-label="Informações da sala">
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-xs text-faint">Participantes</dt>
          <dd className="tnum mt-1 text-2xl font-semibold text-ink">{view.connected_count}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-xs text-faint">Questões</dt>
          <dd className="tnum mt-1 text-2xl font-semibold text-ink">{view.total_questions}</dd>
        </div>
      </dl>

      <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-mute">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-bright" />
        </span>
        Conectado em tempo real
      </p>
    </div>
  );
}

export function ResultView({
  result,
  showScore,
  showRanking,
}: {
  result: NonNullable<PlayerView["result"]>;
  showScore: boolean;
  showRanking: boolean;
}) {
  const totalAnswered = result.correct + result.wrong + result.unanswered;
  const accuracyPct = totalAnswered ? (result.correct / totalAnswered) * 100 : null;
  const [gabaritoOpen, setGabaritoOpen] = useState(false);
  const hasGabarito = result.review && result.review.length > 0;

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-4 py-10">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-mute uppercase">Quiz finalizado</p>
        {showScore && (
          <>
            <p className="tnum mt-4 text-7xl font-bold text-ink">{result.points}</p>
            <p className="mt-1 text-sm text-mute">pontos</p>
          </>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Chip tone="ok" label={`${result.correct} acertos`} />
          <Chip tone="bad" label={`${result.wrong} erros`} />
          <Chip tone="warn" label={`${result.unanswered} sem resposta`} />
          {result.avg_time_s !== null && <Chip tone="neutral" label={`⏱ ${result.avg_time_s}s em média`} />}
          {accuracyPct !== null && <Chip tone="neutral" label={`Aproveitamento ${pctText(accuracyPct)}`} />}
        </div>
      </div>

      {showRanking && result.ranking && result.ranking.length > 0 && (
        <section aria-label="Melhores colocações" className="rounded-[14px] border border-line bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-mute">
            <IconTrophy size={16} className="text-warn" aria-hidden /> Top jogadores
          </h2>
          <ol className="space-y-1.5">
            {result.ranking.map((r, i) => (
              <li
                key={`${r.name}-${i}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  r.is_me ? "bg-accent-deep ring-1 ring-accent/30" : ""
                }`}
              >
                <span className="tnum w-6 shrink-0 text-center font-bold text-faint">{i + 1}º</span>
                <span className={`min-w-0 flex-1 truncate font-medium ${r.is_me ? "text-accent-bright" : "text-ink"}`}>
                  {r.name}
                  {r.is_me && <span className="ml-2 text-xs text-faint">(você)</span>}
                </span>
                <span className="text-xs text-faint">{r.correct} acertos</span>
                {showScore && (
                  <span className="tnum w-16 text-right font-semibold text-ink">{r.points}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasGabarito && (
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => setGabaritoOpen(true)}
            className="w-full"
            icon={<IconListCheck size={18} />}
          >
            Ver gabarito
          </Button>
        </div>
      )}

      <Modal
        open={gabaritoOpen}
        onClose={() => setGabaritoOpen(false)}
        title="Gabarito"
        size="lg"
        description={hasGabarito ? `${result.review!.length} questões` : undefined}
      >
        <div className="space-y-2.5 max-h-[60dvh] overflow-y-auto">
          {hasGabarito && result.review!.map((item) => (
            <article key={item.position} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-snug text-ink">
                  <span className="mr-2 text-xs font-semibold text-faint">{item.position}.</span>
                  {item.statement}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    item.is_correct ? "bg-ok-deep text-ok" : item.your_index === null ? "bg-warn-deep text-warn" : "bg-bad-deep text-bad"
                  }`}
                >
                  {item.is_correct ? "Acertou" : item.your_index === null ? "Sem resposta" : "Errou"}
                </span>
              </div>
              <p className="mt-2.5 text-xs text-mute">
                Correta:{" "}
                <strong className="font-semibold text-ok">
                  {LETTERS[item.correct_index]}. {item.options_text?.[item.correct_index]}
                </strong>
              </p>
            </article>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Chip({ tone, label }: { tone: "ok" | "bad" | "warn" | "neutral"; label: string }) {
  const tones = {
    ok: "bg-ok-deep text-ok",
    bad: "bg-bad-deep text-bad",
    warn: "bg-warn-deep text-warn",
    neutral: "bg-white/[0.06] text-mute",
  };
  return <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${tones[tone]}`}>{label}</span>;
}
