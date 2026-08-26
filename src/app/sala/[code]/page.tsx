"use client";

import { PlayerClient } from "@/components/player/PlayerClient";
import { useParams } from "next/navigation";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (Array.isArray(params.code) ? params.code[0] : params.code)?.toUpperCase() ?? "";

  return <PlayerClient key={code} roomCode={code} />;
}
