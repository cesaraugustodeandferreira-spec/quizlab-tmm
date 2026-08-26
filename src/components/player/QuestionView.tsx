"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { BRAND } from "@/config/brand";
import { LETTERS } from "@/lib/utils";
import type { PlayerView } from "@/types";
import { IconCheck, IconX } from "@tabler/icons-react";

interface QuestionViewProps {
  view: PlayerView;
  serverOffsetMs: number;
  submittingIndex: number | null;
  submitted: boolean;
  timedOut: boolean;
  onSelect: (index: number) => void;
}

export function QuestionView({
  view,
  serverOffsetMs,
  submittingIndex,
  submitted,
  timedOut,
  onSelect,
}: QuestionViewProps) {
  const q = view.question!;
  const deadline =
    q.started_at && q.seconds ? new Date(q.started_at).getTime() + q.seconds * 1000 : null;

  return (
    <QuestionInner
      statement={q.statement}
      imageUrl={q.image_url}
      label={q.label}
      total={view.total_questions}
      options={q.options}
      seconds={q.seconds ?? 20}
      startedAtMs={q.started_at ? new Date(q.started_at).getTime() : null}
      serverOffsetMs={serverOffsetMs}
      submittingIndex={submittingIndex}
      submitted={submitted}
      timedOut={timedOut}
      answeredOnServer={!!view.answered}
      pointsSoFar={view.totals?.points ?? null}
      correctSoFar={view.totals?.correct ?? null}
      showScore={view.show_score}
      onSelect={onSelect}
      deadlineKey={deadline}
    />
  );
}

function QuestionInner(props: {
  statement: string;
  imageUrl: string | null;
  label: number;
  total: number;
  options: string[];
  seconds: number;
  startedAtMs: number | null;
  serverOffsetMs: number;
  submittingIndex: number | null;
  submitted: boolean;
  timedOut: boolean;
  answeredOnServer: boolean;
  pointsSoFar: number | null;
  correctSoFar: number | null;
  showScore: boolean;
  onSelect: (index: number) => void;
  deadlineKey: number | null;
}) {
  const deadline = props.startedAtMs
    ? props.startedAtMs + props.seconds * 1000 + props.serverOffsetMs
    : null;
  const remainingMs = useCountdown(deadline, props.serverOffsetMs);
  const expired = remainingMs <= 0;
  const locked = props.submitted || props.timedOut || expired || props.answeredOnServer;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <header className="mb-6 space-y-4">
        <div className="flex items-center justify-between text-xs font-medium tracking-wide text-mute uppercase">
          <span>
            Questão {props.label} de {props.total}
          </span>
          {props.showScore && (
            <span className="tnum text-sm text-ink normal-case">
              {props.pointsSoFar ?? 0} pts · {props.correctSoFar ?? 0} acertos
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(props.label / Math.max(props.total, 1)) * 100}%` }}
          />
        </div>
      </header>

      {props.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.imageUrl}
          alt="Imagem da questão"
          className="mb-5 max-h-56 w-full rounded-xl border border-line object-contain"
        />
      )}

      <h1 className="font-display mb-8 text-2xl leading-snug font-semibold text-balance text-ink sm:text-3xl">
        {props.statement}
      </h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {props.options.map((text, idx) => (
          <OptionButton
            key={idx}
            letter={LETTERS[idx]}
            text={text}
            color={BRAND.answerColors[idx]}
            disabled={locked}
            loading={props.submittingIndex === idx}
            selected={props.submittingIndex === idx}
            onClick={() => props.onSelect(idx)}
          />
        ))}
      </div>

      <div aria-live="polite" className="mt-8 min-h-14 text-center">
        {locked && (
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm text-mute">
            {expired || props.timedOut ? (
              <>
                Tempo esgotado — aguarde o professor.
              </>
            ) : (
              <>
                <IconCheck size={16} className="text-ok" aria-hidden />
                Resposta enviada! Aguarde o professor.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function OptionButton({
  letter,
  text,
  color,
  disabled,
  loading,
  selected,
  onClick,
}: {
  letter: string;
  text: string;
  color: string;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] disabled:cursor-default ${
        selected ? "border-white/30 brightness-125" : "border-line hover:border-white/25 hover:brightness-110"
      }`}
      style={{ background: `${color}26`, borderColor: selected ? color : undefined }}
      aria-label={`Alternativa ${letter}`}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-inner"
        style={{ background: color }}
      >
        {loading ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : letter}
      </span>
      <span className="text-[15px] leading-snug font-medium text-white/95">{text}</span>
    </button>
  );
}

export function RevealView({
  view,
}: {
  view: PlayerView;
}) {
  const reveal = view.reveal_data!;
  const mine = reveal.my;
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      <p className="text-xs font-medium tracking-wide text-mute uppercase">Questão {view.current_index}</p>
      {mine ? (
        mine.is_correct ? (
          <div role="status" className="mt-6">
            <span className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-ok-deep text-ok ring-4 ring-ok/15">
              <IconCheck size={32} stroke={2.5} />
            </span>
            <h1 className="font-display text-3xl font-bold text-ok">Você acertou!</h1>
          </div>
        ) : (
          <div role="status" className="mt-6">
            <span className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-bad-deep text-bad ring-4 ring-bad/15">
              <IconX size={32} stroke={2.5} />
            </span>
            <h1 className="font-display text-3xl font-bold text-bad">Não foi essa vez.</h1>
          </div>
        )
      ) : (
        <h1 className="font-display mt-6 text-3xl font-bold text-mute">Tempo esgotado.</h1>
      )}

      {view.show_correct_answers && (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 text-left">
          <p className="mb-3 text-xs font-medium tracking-wide text-mute uppercase">Resposta correta</p>
          <p className="flex items-start gap-3 rounded-xl bg-ok-deep p-4">
            <span className="tnum flex size-9 shrink-0 items-center justify-center rounded-lg bg-ok-deep text-base font-bold text-ok ring-1 ring-ok/30">
              {LETTERS[reveal.correct_index]}
            </span>
            <span className="pt-1.5 leading-snug text-ink">{reveal.options_text?.[reveal.correct_index]}</span>
          </p>
        </div>
      )}

      {mine && view.show_score && mine.is_correct && (
        <p className="tnum mt-6 text-lg text-mute">
          +<span className="font-semibold text-ok">{mine.points_earned}</span> pontos
        </p>
      )}

      <p className="mt-10 animate-pulse text-sm text-faint">Aguardando o professor…</p>
    </div>
  );
}
