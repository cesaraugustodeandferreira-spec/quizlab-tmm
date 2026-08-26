"use client";

import { HostClient } from "@/components/host/HostClient";
import { useParams } from "next/navigation";

export default function HostRoomPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  return <HostClient key={sessionId} sessionId={sessionId} />;
}
