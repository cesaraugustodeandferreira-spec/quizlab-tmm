import type { Difficulty } from "@/types";

export const MAX_POINTS_PER_QUESTION = 1000;

export const MASTERY_THRESHOLDS = [
  { min: 85, label: "Excelente domínio" },
  { min: 70, label: "Bom domínio" },
  { min: 50, label: "Em desenvolvimento" },
  { min: 0, label: "Necessita atenção" },
] as const;

export type MasteryLevel = (typeof MASTERY_THRESHOLDS)[number]["label"];

export function masteryOf(pct: number | null | undefined): MasteryLevel | null {
  if (pct === null || pct === undefined) return null;
  for (const t of MASTERY_THRESHOLDS) {
    if (pct >= t.min) return t.label;
  }
  return null;
}

export function masteryTone(level: MasteryLevel): "ok" | "accent" | "warn" | "bad" {
  switch (level) {
    case "Excelente domínio":
      return "ok";
    case "Bom domínio":
      return "accent";
    case "Em desenvolvimento":
      return "warn";
    case "Necessita atenção":
      return "bad";
  }
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: "Fácil",
  media: "Médio",
  dificil: "Difícil",
};

export const SESSION_STATUS_LABELS = {
  aguardando: "Aguardando início",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
} as const;
