"use client";

import { LobbyView, ResultView } from "@/components/player/PlayerViews";
import { QuestionView, RevealView } from "@/components/player/QuestionView";
import { RealtimePill } from "@/components/quiz/RealtimePill";
import { getPlayerView, submitPlayerAnswer } from "@/lib/api/play";
import { usePostgresChanges, usePresenceTrack } from "@/hooks/useRealtimeChannel";
import { computeServerOffset } from "@/hooks/useCountdown";
import type { PlayerView } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function PlayerClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const tokenRef = useRef<string | null>(null);
  const serverOffset = useRef(0);
  const closedRef = useRef(false);
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`ql_room_${roomCode}`);
    if (!stored) {
      router.replace(`/entrar?sala=${roomCode}`);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as { token: string; name: string };
      tokenRef.current = parsed.token;
      setName(parsed.name);
    } catch {
      router.replace(`/entrar?sala=${roomCode}`);
    }
  }, [roomCode, router]);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const next = await getPlayerView(roomCode, tokenRef.current);
      serverOffset.current = computeServerOffset(next.server_now);
      setView(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a sala.");
    }
  }, [roomCode]);

  const markClosed = useCallback((message: string) => {
    if (closedRef.current) return;
    closedRef.current = true;
    localStorage.removeItem(`ql_room_${roomCode}`);
    setError(message);
  }, [roomCode]);

  // Sincronização direta via Supabase Realtime: qualquer mudança na quiz_session
  // desta sala (iniciar, avancar questão, encerrar questão, finalizar, cancelar)
  // atualiza a tela imediatamente — sem esperar o professor "avisar".
  const realtimeStatus = usePostgresChanges(
    `player-${roomCode}`,
    [{ table: "quiz_sessions", events: ["INSERT", "UPDATE", "DELETE"], filter: `room_code=eq.${roomCode}` }],
    (change) => {
      if (closedRef.current) return;
      if (change.eventType === "DELETE") {
        markClosed("A sala foi encerrada pelo professor.");
        return;
      }
      void refresh();
    },
  );

  // Presence: marca este aluno como "online agora" para o professor enxergar quando sair.
  usePresenceTrack(`presence:room:${roomCode}`, name ? { name } : null);

  // Carregamento inicial: busca a view da sala assim que entra (antes de qualquer evento).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Ao trocar de questão, limpa o estado local de resposta/tempo esgotado.
  useEffect(() => {
    setTimedOut(false);
    setSubmittingIndex(null);
  }, [view?.current_index]);

  async function handleSelect(index: number) {
    if (!tokenRef.current || !view?.question) return;
    const startedAtMs = view.question.started_at ? new Date(view.question.started_at).getTime() : null;
    const timeMs = startedAtMs ? Date.now() + serverOffset.current - startedAtMs : 0;
    setSubmittingIndex(index);
    setTimedOut(false);
    try {
      await submitPlayerAnswer(roomCode, tokenRef.current, view.question.id, index, timeMs);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar sua resposta.");
    } finally {
      setSubmittingIndex(null);
    }
  }

  function leaveRoom() {
    localStorage.removeItem(`ql_room_${roomCode}`);
    router.push("/entrar");
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display mb-3 text-2xl font-bold text-ink">Sessão encerrada</h1>
        <p className="mb-8 max-w-sm text-sm text-mute">{error}</p>
        <Link
          href="/entrar"
          className="inline-flex h-12 items-center rounded-xl bg-accent px-6 font-medium text-white transition-colors hover:bg-accent-bright"
        >
          Voltar para a entrada
        </Link>
      </div>
    );
  }

  if (!view) {
    return (
      <main className="relative min-h-dvh">
        <div className="fixed right-4 bottom-4 z-40">
          <RealtimePill status={realtimeStatus} />
        </div>
        <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
          <div className="skeleton-pulse h-8 w-2/3" />
          <div className="skeleton-pulse h-40 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-pulse h-20 w-full" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Sala encerrada antes de ser iniciada pelo professor → tratar como sala cancelada.
  if (view.status === "encerrada" && !view.started) {
    markClosed("A sala foi encerrada pelo professor.");
    return null;
  }

  return (
    <main className="relative min-h-dvh">
      <div className="fixed right-4 bottom-4 z-40">
        <RealtimePill status={realtimeStatus} />
      </div>
      {view.status === "aguardando" && <LobbyView view={view} name={name} />}
      {view.status === "encerrada" && view.result && (
        <>
          <ResultView
            result={view.result}
            showScore={view.show_score}
            showRanking={view.show_ranking}
          />
          <div className="pb-12 text-center">
            <button
              onClick={leaveRoom}
              className="cursor-pointer rounded-[10px] border border-line-strong px-5 py-2.5 text-sm text-mute transition-colors hover:bg-surface hover:text-ink"
            >
              Sair da sala
            </button>
          </div>
        </>
      )}
      {view.status === "em_andamento" && view.question && !view.reveal_data && (
        <QuestionView
          view={view}
          serverOffsetMs={serverOffset.current}
          submittingIndex={submittingIndex}
          submitted={!!view.answered || submittingIndex !== null}
          timedOut={timedOut}
          onSelect={(idx) => void handleSelect(idx)}
        />
      )}
      {view.status === "em_andamento" && view.reveal_data && <RevealView view={view} serverOffsetMs={serverOffset.current} />}
      {view.status === "em_andamento" && !view.question && (
        <div className="flex min-h-dvh items-center justify-center">
          <p className="animate-pulse text-sm text-mute">Preparando a próxima questão…</p>
        </div>
      )}
    </main>
  );
}