"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";

export type RealtimeStatus = "connecting" | "subscribed" | "error";

export interface RealtimeChange {
  table: string;
  eventType?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

export interface RealtimeTableSpec {
  table: string;
  events?: ("INSERT" | "UPDATE" | "DELETE")[];
  filter?: string;
}

const RETRY_MS = 1500;
const MAX_RETRIES = 20;

/**
 * Garante que o socket do Realtime vá autenticado com o token do usuário.
 * Sem isso o WebSocket conecta só com a apikey (anon) e eventos com RLS
 * (session_students, answers, quiz_sessions) nunca chegam — sintoma: o professor
 * só via os alunos após F5. Presença (sem RLS) funciona mesmo sem token.
 */
async function attachSessionToRealtime(supabase: ReturnType<typeof createClient>) {
  let { data } = await supabase.auth.getSession();
  if (!data.session) {
    await supabase.auth.getUser();
    ({ data } = await supabase.auth.getSession());
  }
  if (data.session) supabase.realtime.setAuth(data.session.access_token);
}

/**
 * Assina mudanças de tabelas (Postgres Changes) via Supabase Realtime.
 * Reconecta automaticamente em CHANNEL_ERROR/TIMED_OUT e limpa o canal ao desmontar.
 * Retorna o status atual da conexão para exibir indicadores de conexão.
 */
export function usePostgresChanges(
  channelName: string,
  tables: RealtimeTableSpec[],
  onEvent?: (change: RealtimeChange) => void,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const tearDown = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const connect = async () => {
      if (disposed) return;
      tearDown();
      setStatus("connecting");
      await attachSessionToRealtime(supabase);
      channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
      for (const t of tables) {
        for (const ev of t.events ?? ["INSERT", "UPDATE", "DELETE"]) {
          channel.on("postgres_changes", { event: ev, schema: "public", table: t.table, filter: t.filter }, (payload) => {
            onEventRef.current?.({
              table: t.table,
              eventType: payload.eventType,
              new: (payload as { new?: Record<string, unknown> }).new,
              old: (payload as { old?: Record<string, unknown> }).old,
            });
          });
        }
      }
      channel.subscribe((s) => {
        if (disposed) return;
        if (s === "SUBSCRIBED") {
          setStatus("subscribed");
          retryCount = 0;
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          if (retryTimer) clearTimeout(retryTimer);
          setStatus("error");
          retryCount += 1;
          if (retryCount <= MAX_RETRIES) {
            retryTimer = setTimeout(connect, RETRY_MS * Math.min(retryCount, 4));
          }
        }
      });
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      tearDown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, tablesKey]);

  return status;
}

/**
 * Publica presença em um canal Realtime (dançarino/aluno) para refletir "online agora".
 * Retorna o status da conexão do canal.
 */
export function usePresenceTrack(
  channelName: string | null,
  tracked: Record<string, unknown> | null,
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;

  useEffect(() => {
    if (!channelName) {
      setStatus("subscribed");
      return;
    }
    const supabase = createClient();
    let disposed = false;
    const channel = supabase
      .channel(channelName, { config: { presence: { key: `client-${Math.random().toString(36).slice(2, 10)}` } } })
      .on("presence", { event: "sync" }, () => {})
      .subscribe((s) => {
        if (disposed) return;
        if (s === "SUBSCRIBED") {
          setStatus("subscribed");
          if (trackedRef.current) void channel.track(trackedRef.current);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("error");
        }
      });

    return () => {
      disposed = true;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [channelName]);

  return status;
}

/**
 * Observa a presença de um canal Realtime e retorna a quantidade de participantes online.
 * Passar channelName = null desativa a observação.
 */
export function usePresenceState(channelName: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!channelName) return;
    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName]);

  return count;
}