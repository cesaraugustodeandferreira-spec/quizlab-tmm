"use client";

import { HostFinished, HostLobby, HostQuestion } from "@/components/host/HostViews";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { getQuiz, type QuizDetail } from "@/lib/api/quizzes";
import {
  getSession,
  hostAdvance,
  hostCancelRoom,
  hostCloseQuestion,
  hostFinishQuiz,
  hostStart,
  listSessionAnswers,
  listSessionStudents,
  type SessionDetail,
} from "@/lib/api/sessions";
import { usePostgresChanges, usePresenceState } from "@/hooks/useRealtimeChannel";
import { RealtimePill } from "@/components/quiz/RealtimePill";
import type { AnswerRow, SessionStudentRow } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function HostClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [students, setStudents] = useState<SessionStudentRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoCloseGuard = useRef(false);

  const refreshLists = useCallback(async () => {
    try {
      const [st, ans] = await Promise.all([listSessionStudents(sessionId), listSessionAnswers(sessionId)]);
      setStudents(st);
      setAnswers(ans);
    } catch {
      /* silencioso */
    }
  }, [sessionId]);

  const loadAll = useCallback(async () => {
    try {
      const s = await getSession(sessionId);
      setSession(s);
      const q = await getQuiz(s.quiz_id);
      setQuiz(q);
      setRevealed(s.reveal_current && s.status === "em_andamento");
      await refreshLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sala não encontrada.");
    }
  }, [sessionId, refreshLists]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Sincronização em tempo real (Supabase Realtime):
  //  - quiz_sessions (UPDATE) → recarrega o estado (timer, fase, questão atual, transição)
  //  - session_students (INSERT/DELETE) → contador e lista de alunos na sala
  //  - answers (INSERT/DELETE) → contagem de respostas e placar por alternativa ao vivo
  const realtimeStatus = usePostgresChanges(
    `host-${sessionId}`,
    [
      { table: "quiz_sessions", events: ["UPDATE"], filter: `id=eq.${sessionId}` },
      { table: "session_students", events: ["INSERT", "DELETE"], filter: `session_id=eq.${sessionId}` },
      { table: "answers", events: ["INSERT", "DELETE"], filter: `session_id=eq.${sessionId}` },
    ],
    (change) => {
      if (change.table === "answers" || change.table === "session_students") {
        void refreshLists();
      } else if (change.table === "quiz_sessions") {
        void loadAll();
      }
    },
  );

  // Presença do canal da sala: quantos alunos estão com a página aberta agora.
  const onlineNow = usePresenceState(session?.room_code ? `presence:room:${session.room_code}` : null);

  // Rede de segurança: revalida as listas a cada 5s para que o professor veja
  // alunos e respostas mesmo se um evento de realtime se perder em trânsito.
  useEffect(() => {
    const t = setInterval(() => void refreshLists(), 5000);
    return () => clearInterval(t);
  }, [refreshLists]);

  const currentQuestion =
    session?.status === "em_andamento" ? (quiz?.questions[session.current_index - 1] ?? null) : null;

  const answeredCount = useMemo(() => {
    if (!currentQuestion) return 0;
    return answers.filter((a) => a.question_id === currentQuestion.id).length;
  }, [answers, currentQuestion]);

  const optionCounts = useMemo(() => {
    const counts = [0, 0, 0, 0];
    if (currentQuestion) {
      for (const a of answers) {
        if (a.question_id === currentQuestion.id && a.selected_index !== null) {
          counts[a.selected_index] = counts[a.selected_index] + 1;
        }
      }
    }
    return counts;
  }, [answers, currentQuestion]);

  const deadlineMs =
    session?.status === "em_andamento" && session.question_started_at && session.question_seconds
      ? new Date(session.question_started_at).getTime() + session.question_seconds * 1000
      : null;

  useEffect(() => {
    autoCloseGuard.current = false;
  }, [session?.current_index, revealed]);

  const closeQuestion = useCallback(
    async (fromTimer: boolean) => {
      if (!sessionId || busy) return;
      if (fromTimer && autoCloseGuard.current) return;
      autoCloseGuard.current = true;
      setBusy(true);
      try {
        await hostCloseQuestion(sessionId);
        setRevealed(true);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Erro ao encerrar a questão.", "bad");
      } finally {
        setBusy(false);
      }
    },
    [sessionId, busy, toast],
  );

  const advanceNow = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const result = await hostAdvance(sessionId);
      setRevealed(false);
      if (result.finished) toast("Quiz finalizado! Resultados liberados.", "ok");
      await loadAll();
      if (!result.finished) autoCloseGuard.current = false;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao avançar questão.", "bad");
    } finally {
      setBusy(false);
    }
  }, [sessionId, loadAll, toast]);

  // Fecha a questão automaticamente quando o tempo da questão chega a 0 (servidor-sincronizado via deadlineMs)
  useEffect(() => {
    if (session?.phase !== "question" || deadlineMs === null) return;
    const ms = deadlineMs - Date.now();
    const t = setTimeout(() => void closeQuestion(true), Math.max(0, ms) + 400);
    return () => clearTimeout(t);
  }, [session?.phase, deadlineMs, session?.current_index, closeQuestion]);

  // Avança automaticamente quando a contagem de 10s da transição chega a 0
  useEffect(() => {
    if (session?.phase !== "transition" || !session.transition_ends_at) return;
    const endsAt = new Date(session.transition_ends_at).getTime();
    const ms = Math.max(0, endsAt - Date.now());
    const t = setTimeout(() => void advanceNow(), ms + 400);
    return () => clearTimeout(t);
  }, [session?.phase, session?.transition_ends_at, session?.current_index, advanceNow]);

  async function handleStart() {
    if (!session) return;
    setBusy(true);
    try {
      await hostStart(session.id);
      setRevealed(false);
      await loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao iniciar o quiz.", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!session) return;
    setBusy(true);
    try {
      await hostCancelRoom(session.id);
      toast("Sala encerrada.", "ok");
      router.push("/professor/quizzes");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao encerrar sala.", "bad");
      setBusy(false);
    }
  }

  async function handleFinish() {
    if (!session) return;
    setBusy(true);
    try {
      await hostFinishQuiz(session.id);
      toast("Quiz finalizado! Resultados liberados.", "ok");
      router.push(`/professor/diagnosticos/${session.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao finalizar o quiz.", "bad");
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-bad">{error}</p>
        <div className="pb-2 text-center">
          <Link href="/professor/quizzes" className="text-sm text-accent-bright hover:text-white">
            Voltar aos quizzes
          </Link>
        </div>
      </Card>
    );
  }

  if (!session || !quiz) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-10">
        <Skeleton className="mx-auto h-28 w-96" />
        <Skeleton className="mx-auto h-14 w-64" />
        <div className="flex justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="fixed right-4 bottom-20 z-40 sm:bottom-4">
        <RealtimePill status={realtimeStatus} />
      </div>
      {session.status === "aguardando" && (
        <HostLobby
          roomCode={session.room_code}
          students={students}
          onlineCount={onlineNow}
          onStart={() => void handleStart()}
          onCancel={() => void handleCancel()}
          busy={busy}
        />
      )}

      {session.status === "em_andamento" && !currentQuestion && (
        <div className="py-24 text-center" aria-live="polite">
          <p className="animate-pulse text-lg text-mute">Preparando questão…</p>
        </div>
      )}

      {session.status === "em_andamento" && currentQuestion && (
        <HostQuestion
          key={`${session.current_index}-${revealed}`}
          label={session.current_index}
          total={quiz.questions.length}
          statement={currentQuestion.statement}
          imageUrl={currentQuestion.image_url}
          options={currentQuestion.options}
          seconds={session.question_seconds ?? quiz.default_time_seconds}
          deadlineMs={deadlineMs}
          phase={session.phase}
          transitionEndsAt={session.transition_ends_at}
          answered={answeredCount}
          waiting={Math.max(students.length - answeredCount, 0)}
          optionCounts={optionCounts}
          reveal={revealed}
          correctIndex={currentQuestion.correct_index}
          busy={busy}
          onCloseQuestion={() => void closeQuestion(false)}
          onNext={() => void advanceNow()}
          onFinish={() => void handleFinish()}
          isLast={session.current_index >= quiz.questions.length}
        />
      )}

      {session.status === "encerrada" && (
        <HostFinished
          students={students}
          onOpenDiagnostics={() => router.push(`/professor/diagnosticos/${session.id}`)}
        />
      )}
    </div>
  );
}
