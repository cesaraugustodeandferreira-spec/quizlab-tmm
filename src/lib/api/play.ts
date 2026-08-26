import { createClient } from "@/lib/supabase/client";
import type { JoinResult, PlayerView } from "@/types";

export async function joinSession(roomCode: string, name: string): Promise<JoinResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_session", {
    p_room_code: roomCode,
    p_display_name: name,
  });
  if (error) throw new Error(error.message);
  return data as unknown as JoinResult;
}

export async function getPlayerView(roomCode: string, token: string): Promise<PlayerView> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_player_view", {
    p_room_code: roomCode,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data as unknown as PlayerView;
}

export async function submitPlayerAnswer(
  roomCode: string,
  token: string,
  questionId: string,
  selectedIndex: number,
  timeMs: number,
): Promise<{ accepted: boolean; reason?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_answer", {
    p_room_code: roomCode,
    p_token: token,
    p_question_id: questionId,
    p_selected_index: selectedIndex,
    p_time_ms: Math.max(0, Math.round(timeMs)),
  });
  if (error) throw new Error(error.message);
  return data as unknown as { accepted: boolean; reason?: string };
}
