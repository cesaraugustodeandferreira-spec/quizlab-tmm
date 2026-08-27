"use client";

import { createQuiz } from "@/lib/api/quizzes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewQuizPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createQuiz({
      title: "Quiz sem título",
      description: "",
      subject_id: "",
      topic_id: null,
      default_time_seconds: 20,
      show_ranking: true,
      show_score: true,
      show_correct_answers: false,
    })
      .then((id) => router.replace(`/professor/quizzes/${id}`))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao criar quiz.");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-bad">{error}</p>
        <div className="text-center">
          <Button variant="outline" onClick={() => router.push("/professor/quizzes")}>
            Voltar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="skeleton-pulse h-9 w-64" />
      <div className="skeleton-pulse h-40 w-full" />
    </div>
  );
}
