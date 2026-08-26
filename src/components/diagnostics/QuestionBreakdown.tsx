"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { QuestionDiag } from "@/types";
import { LETTERS, cn, pctText } from "@/lib/utils";

export function QuestionBreakdownModal({
  question,
  onClose,
}: {
  question: QuestionDiag | null;
  onClose: () => void;
}) {
  if (!question) return null;

  const total = Math.max(question.n, 1);
  const unanswered = question.options.find((o) => o.index === -1)?.count ?? 0;
  const correctCount =
    question.correct_index !== undefined
      ? (question.options.find((o) => o.index === question.correct_index)?.count ?? 0)
      : 0;
  const wrongCount = Math.max(0, question.n - unanswered - correctCount);

  return (
    <Modal
      open={!!question}
      onClose={onClose}
      size="lg"
      title={`Questão ${question.position}`}
      description={question.topic}
    >
      <div className="space-y-6">
        <p className="text-[15px] leading-relaxed text-ink">{question.statement}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={question.pct >= 70 ? "ok" : question.pct >= 50 ? "accent" : "bad"}>
            Aproveitamento: {pctText(question.pct)}
          </Badge>
          <Badge tone="neutral">{question.n} respostas</Badge>
          <Badge tone="ok">
            <span aria-hidden>✓</span> {correctCount} acertaram
          </Badge>
          <Badge tone="bad">
            <span aria-hidden>✕</span> {wrongCount} erraram
          </Badge>
          {unanswered > 0 && <Badge tone="warn">{unanswered} sem resposta</Badge>}
        </div>

        <ul className="space-y-2.5" aria-label="Distribuição das alternativas">
          {LETTERS.map((letter, idx) => {
            const chosen = question.options.find((o) => o.index === idx)?.count ?? 0;
            const isCorrect = question.correct_index === idx;
            const pct = Math.round((chosen / total) * 100);
            return (
              <li
                key={idx}
                className={cn(
                  "rounded-xl border p-3",
                  isCorrect ? "border-ok/40 bg-ok-deep" : "border-line bg-surface",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "tnum flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                        isCorrect ? "bg-ok-deep text-ok" : "bg-surface-2 text-ink",
                      )}
                    >
                      {isCorrect ? "✓" : letter}
                    </span>
                    <span className="truncate text-sm text-mute">
                      {question.options_text?.[idx] ?? `Alternativa ${letter}`}
                      {isCorrect && (
                        <span className={cn("ml-2 text-xs", "text-ok")}>(correta)</span>
                      )}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-semibold text-ink">
                    {pct}%
                    <span className="ml-1 font-sans text-xs font-normal text-faint">({chosen})</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500", isCorrect ? "bg-ok" : "bg-accent")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
