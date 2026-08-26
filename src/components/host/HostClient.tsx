"use client";

import { HostFinished, HostLobby, HostQuestion } from "@/components/host/HostViews";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { getQuiz, type QuizDetail } from "@/lib/api/quizzes";
import {
  broadcastRoom,
  getSession,
  hostAdvance,
  hostCancelRoom,
  hostCloseQuestion,
  hostStart,
  listSessionAnswers,
  listSessionStudents,
  type SessionDetail,
} from "@/lib/api/sessions";
import { createClient } from "@/lib/supabase/client";
import type { AnswerRow, SessionStudentRow } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function HostClient({ sessionId }: { sessionId: string }) {
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
      /* silencioso: listas atualizam na próxima mudança */
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

  const sessionActive = !!session;
  useEffect(() => {
    if (!sessionActive) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`host-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_students", filter: `session_id=eq.${sessionId}` },
        () => void refreshLists(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` },
        () => void refreshLists(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [sessionActive, sessionId, refreshLists]);

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

  async function handleStart() {
    if (!session) return;
    setBusy(true);
    try {
      await hostStart(session.id);
      broadcastRoom(session.room_code, { type: "sync" });
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
      broadcastRoom(session.room_code, { type: "closed" });
      toast("Sala encerrada.", "ok");
      window.location.assign("/professor/quizzes");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao encerrar sala.", "bad");
      setBusy(false);
    }
  }

  async function handleCloseQuestion(fromTimer: boolean) {
    if (!session || busy) return;
    if (fromTimer && autoCloseGuard.current) return;
    autoCloseGuard.current = true;
    setBusy(true);
    try {
      await hostCloseQuestion(session.id);
      broadcastRoom(session.room_code, { type: "sync" });
      setRevealed(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao encerrar a questão.", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvance(finish: boolean) {
    if (!session) return;
    setBusy(true);
    try {
      const result = await hostAdvance(session.id);
      broadcastRoom(session.room_code, { type: "sync" });
      setRevealed(false);
      if (result.finished) toast("Quiz finalizado! Resultados liberados.", "ok");
      await loadAll();
      if (!result.finished) autoCloseGuard.current = false;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao avançar questão.", "bad");
    } finally {
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
    <>
      {session.status === "aguardando" && (
        <HostLobby
          roomCode={session.room_code}
          students={students}
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

      {session.status === "em_andamento" && currentQuestion && !revealed && deadlineMs !== null && (
        <AutoClose
          key={`${session.current_index}-${deadlineMs}`}
          enabled={deadlineMs - Date.now()}
          onExpire={() => void handleCloseQuestion(true)}
        />
      )}

      {session.status === "em_andamento" && currentQuestion && (
        <HostQuestion
          key={`${session.current_index}-${revealed}`}
          label={session.current_index}
          total={quiz.questions.length}
          statement={currentQuestion.statement}
          imageUrl={currentQuestion.image_url}
          seconds={session.question_seconds ?? quiz.default_time_seconds}
          deadlineMs={deadlineMs}
          answered={answeredCount}
          waiting={Math.max(students.length - answeredCount, 0)}
          optionCounts={optionCounts}
          reveal={revealed}
          correctIndex={currentQuestion.correct_index}
          busy={busy}
          onCloseQuestion={() => void handleCloseQuestion(false)}
          onNext={() => void handleAdvance(false)}
          onFinish={() => void handleAdvance(true)}
          isLast={session.current_index >= quiz.questions.length}
        />
      )}

      {session.status === "encerrada" && (
        <HostFinished
          students={students}
          onOpenDiagnostics={() => window.location.assign(`/professor/diagnosticos/${session.id}`)}
        />
      )}
    </>
  );
}

function AutoClose({ enabled, onExpire }: { enabled: number; onExpire: () => void }) {
  useEffect(() => {
    if (enabled <= 0) {
      const t = setTimeout(onExpire, 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(onExpire, enabled + 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
