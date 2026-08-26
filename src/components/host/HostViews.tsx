"use client";

import { TimerRing } from "@/components/quiz/TimerRing";
import { BRAND } from "@/config/brand";
import { LETTERS, cn } from "@/lib/utils";
import type { SessionStudentRow } from "@/types";
import { IconCheck, IconPlayerPlay, IconTrophy, IconUsers } from "@tabler/icons-react";

export function HostLobby({
  roomCode,
  students,
  onStart,
  onCancel,
  busy,
}: {
  roomCode: string;
  students: SessionStudentRow[];
  onStart: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-5xl flex-col items-center justify-center gap-8 py-8 text-center">
      <p className="text-sm font-medium tracking-[0.3em] text-mute uppercase">Código da sala</p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <h1
          aria-label={`Código da sala: ${roomCode.split("").join(" ")}`}
          className="tnum font-display text-7xl leading-none font-bold tracking-[0.12em] text-accent-bright select-all sm:text-[9rem]"
        >
          {roomCode}
        </h1>
        <button
          onClick={() => void navigator.clipboard.writeText(roomCode)}
          aria-label="Copiar código da sala"
          className="mt-2 cursor-pointer rounded-xl border border-line-strong px-4 py-2 text-xs text-mute transition-colors hover:bg-surface hover:text-ink"
        >
          Copiar
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-6 py-3" aria-live="polite">
        <IconUsers size={22} className="text-accent-bright" aria-hidden />
        <span className="tnum text-3xl font-bold text-ink">{students.length}</span>
        <span className="text-sm text-mute">{students.length === 1 ? "aluno conectado" : "alunos conectados"}</span>
      </div>

      {students.length > 0 && (
        <ul aria-label="Alunos na sala" className="flex max-w-3xl flex-wrap justify-center gap-2">
          {students.map((s) => (
            <li
              key={s.id}
              className="animate-scale-in rounded-full border border-line bg-surface px-4 py-2 text-base font-medium text-ink"
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {students.length === 0 && (
        <p className="max-w-md text-lg text-faint">
          Peça para os alunos acessarem <strong className="text-mute">/entrar</strong> no celular e digitarem o código acima.
        </p>
      )}

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <button
          onClick={onStart}
          disabled={busy}
          className="inline-flex h-20 min-w-72 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-ok px-10 text-2xl font-bold text-[#052e1e] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          <IconPlayerPlay size={30} stroke={2.4} /> {busy ? "Iniciando…" : "Iniciar Quiz"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="h-14 cursor-pointer rounded-xl border border-line-strong px-6 text-lg text-mute transition-colors hover:border-bad/40 hover:bg-bad-deep hover:text-bad"
        >
          Encerrar sala
        </button>
      </div>
    </div>
  );
}

export function HostQuestion({
  label,
  total,
  statement,
  imageUrl,
  seconds,
  deadlineMs,
  answered,
  waiting,
  optionCounts,
  reveal,
  correctIndex,
  busy,
  onCloseQuestion,
  onNext,
  onFinish,
  isLast,
}: {
  label: number;
  total: number;
  statement: string;
  imageUrl: string | null;
  seconds: number;
  deadlineMs: number | null;
  answered: number;
  waiting: number;
  optionCounts: number[];
  reveal: boolean;
  correctIndex: number | null;
  busy: boolean;
  onCloseQuestion: () => void;
  onNext: () => void;
  onFinish: () => void;
  isLast: boolean;
}) {
  const totalVotes = optionCounts.reduce((a, b) => a + b, 0);
  return (
    <div className="mx-auto max-w-6xl space-y-6 py-2">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.25em] text-mute uppercase">
            Questão {label} de {total}
          </p>
          <h1 className="font-display mt-2 line-clamp-3 max-w-4xl text-3xl leading-snug font-bold text-balance text-ink sm:text-4xl">
            {statement}
          </h1>
        </div>
        <TimerRing secondsLeft={deadlineMs ? deadlineMs - Date.now() : 0} totalSeconds={seconds} size="lg" />
      </header>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Imagem da questão" className="max-h-52 rounded-2xl border border-line object-contain" />
      )}

      <section aria-label="Respostas em tempo real" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {optionCounts.map((count, idx) => {
          const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
          const isCorrect = reveal && correctIndex === idx;
          const color = BRAND.answerColors[idx];
          return (
            <div
              key={idx}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-5 transition-colors",
                isCorrect ? "border-ok/60 bg-ok-deep" : reveal ? "border-line bg-surface opacity-70" : "border-line bg-surface",
              )}
              aria-live={isCorrect ? "polite" : undefined}
            >
              <div className="flex items-start justify-between">
                <span
                  aria-hidden
                  className="flex size-12 items-center justify-center rounded-xl text-2xl font-black text-white"
                  style={{ background: color }}
                >
                  {LETTERS[idx]}
                </span>
                {isCorrect && (
                  <span className="flex items-center gap-1 rounded-full bg-ok-deep px-3 py-1 text-xs font-bold text-ok">
                    <IconCheck size={14} stroke={3} /> Correta
                  </span>
                )}
                <span className="tnum text-5xl font-bold text-white">{count}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
              </div>
              <p className="mt-1.5 text-right text-xs text-faint">{totalVotes ? `${pct}% das escolhas` : ""}</p>
            </div>
          );
        })}
      </section>

      <section aria-live="polite" className="flex flex-wrap items-center justify-center gap-8">
        <BigNumber value={answered} label="responderam" tone="text-ok" />
        <BigNumber value={waiting} label="ainda não responderam" tone="text-warn" />
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {!reveal ? (
          <button
            onClick={onCloseQuestion}
            disabled={busy}
            className="h-16 cursor-pointer rounded-2xl bg-accent px-10 text-xl font-bold text-white transition-all hover:bg-accent-bright active:scale-[0.98] disabled:opacity-60"
          >
            Encerrar questão
          </button>
        ) : (
          <>
            <p className="w-full text-center text-sm text-mute">
              {totalVotes === 0 ? "Nenhuma resposta recebida nesta questão." : "Distribuição finalizada."}
            </p>
            {isLast ? (
              <button
                onClick={onFinish}
                disabled={busy}
                className="inline-flex h-16 cursor-pointer items-center gap-3 rounded-2xl bg-ok px-10 text-xl font-bold text-[#052e1e] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <IconTrophy size={24} /> Finalizar quiz
              </button>
            ) : (
              <button
                onClick={onNext}
                disabled={busy}
                className="h-16 cursor-pointer rounded-2xl bg-accent px-10 text-xl font-bold text-white transition-all hover:bg-accent-bright active:scale-[0.98] disabled:opacity-60"
              >
                Próxima questão →
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}

function BigNumber({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-center">
      <p className={cn("tnum text-7xl leading-none font-bold", tone)}>{value}</p>
      <p className="mt-1 text-sm text-mute">{label}</p>
    </div>
  );
}

export function HostFinished({
  students,
  onOpenDiagnostics,
}: {
  students: SessionStudentRow[];
  onOpenDiagnostics: () => void;
}) {
  const ranked = [...students].sort((a, b) => b.total_points - a.total_points || b.correct_count - a.correct_count);
  const top3 = ranked.slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10 text-center">
      <div>
        <IconTrophy size={56} stroke={1.4} className="mx-auto text-warn" aria-hidden />
        <h1 className="font-display mt-4 text-4xl font-bold text-ink">Quiz finalizado!</h1>
        <p className="mt-2 text-lg text-mute">{ranked.length} alunos participaram.</p>
      </div>

      {top3.length > 0 && (
        <ol className="flex flex-col items-center gap-3" aria-label="Top 3 da turma">
          {top3.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "flex w-full max-w-md items-center gap-4 rounded-2xl border p-4",
                i === 0 ? "border-warn/40 bg-warn-deep" : "border-line bg-surface",
              )}
            >
              <span className="tnum text-3xl font-black text-warn">{i + 1}º</span>
              <span className="min-w-0 flex-1 truncate text-left text-xl font-semibold text-ink">{s.name}</span>
              <span className="text-right">
                <span className="tnum block text-xl font-bold text-accent-bright">{s.total_points} pts</span>
                <span className="block text-xs text-faint">{s.correct_count} acertos</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onOpenDiagnostics}
          className="h-14 cursor-pointer rounded-xl bg-accent px-8 text-lg font-semibold text-white transition-all hover:bg-accent-bright active:scale-[0.98]"
        >
          Ver diagnóstico completo
        </button>
      </div>
    </div>
  );
}
