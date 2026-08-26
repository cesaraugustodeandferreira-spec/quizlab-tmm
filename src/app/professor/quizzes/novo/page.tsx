"use client";

import { createQuiz } from "@/lib/api/quizzes";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewQuizPage() {
  const router = useRouter();

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
      .catch(() => router.replace("/professor/quizzes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="skeleton-pulse h-9 w-64" />
      <div className="skeleton-pulse h-40 w-full" />
    </div>
  );
}
