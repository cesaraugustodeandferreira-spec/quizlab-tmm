export type Difficulty = "facil" | "media" | "dificil";
export type QuizStatus = "rascunho" | "publicado";
export type SessionStatus = "aguardando" | "em_andamento" | "encerrada";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  school: string | null;
  role: "professor" | "aluno";
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
}

export interface ClassRoom {
  id: string;
  teacher_id: string;
  name: string;
  grade_year: string;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  teacher_id: string;
  subject_id: string;
  topic_id: string | null;
  subtopic: string | null;
  statement: string;
  options: string[];
  correct_index: number;
  image_url: string | null;
  difficulty: Difficulty;
  time_override_seconds: number | null;
  created_at: string;
}

export interface QuizRow {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  topic_id: string | null;
  status: QuizStatus;
  default_time_seconds: number;
  show_ranking: boolean;
  show_score: boolean;
  show_correct_answers: boolean;
  is_shared: boolean;
  source_quiz_id: string | null;
  created_at: string;
}

export interface QuizQuestionLink {
  quiz_id: string;
  question_id: string;
  position: number;
}

export interface SessionRow {
  id: string;
  quiz_id: string;
  class_id: string;
  room_code: string;
  status: SessionStatus;
  current_index: number;
  question_started_at: string | null;
  question_seconds: number | null;
  reveal_current: boolean;
  started_at: string | null;
  ended_at: string | null;
  show_ranking: boolean;
  show_score: boolean;
  show_correct_answers: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SessionStudentRow {
  id: string;
  session_id: string;
  class_student_id: string | null;
  name: string;
  token: string;
  joined_at: string;
  total_points: number;
  correct_count: number;
}

export interface AnswerRow {
  id: string;
  session_id: string;
  session_student_id: string;
  quiz_id: string;
  class_id: string;
  question_id: string;
  selected_index: number | null;
  is_correct: boolean;
  points_earned: number;
  time_ms: number | null;
  answered_at: string;
}

export interface QuestionInput {
  statement: string;
  options: [string, string, string, string];
  correct_index: number;
  subject_id: string;
  topic_id: string | null;
  subtopic: string;
  difficulty: Difficulty;
  time_override_seconds: number | null;
  image_url: string;
}

export interface QuizInput {
  title: string;
  description: string;
  subject_id: string;
  topic_id: string | null;
  default_time_seconds: number;
  show_ranking: boolean;
  show_score: boolean;
  show_correct_answers: boolean;
}

export interface JoinResult {
  token: string;
  name: string;
  quiz_title: string;
  total_questions: number;
  show_ranking: boolean;
  show_score: boolean;
  show_correct_answers: boolean;
}

export interface PlayerView {
  status: SessionStatus;
  current_index: number;
  total_questions: number;
  server_now: string;
  show_ranking: boolean;
  show_score: boolean;
  show_correct_answers: boolean;
  question: {
    id: string;
    label: number;
    statement: string;
    image_url: string | null;
    options: string[];
    seconds: number | null;
    started_at: string | null;
  } | null;
  answered?: boolean;
  totals?: { points: number; correct: number };
  reveal_data?: {
    correct_index: number;
    counts: { index: number; count: number }[];
    options_text?: string[];
    my: { selected_index: number; is_correct: boolean; points_earned: number } | null;
  };
  result?: ResultPayload | null;
}

export interface ResultPayload {
  correct: number;
  wrong: number;
  unanswered: number;
  total_questions: number;
  avg_time_s: number | null;
  points: number;
  review:
    | {
        position: number;
        statement: string;
        your_index: number | null;
        correct_index: number;
        is_correct: boolean;
        options_text?: string[];
      }[]
    | null;
  ranking: { name: string; points: number; correct: number; is_me: boolean }[] | null;
}

export interface DashboardData {
  counts: { classes: number; quizzes: number; sessions_done: number; students: number };
  recent: {
    session_id: string;
    title: string;
    class_name: string;
    date: string | null;
    participants: number;
    avg_pct: number | null;
  }[];
  attention: { topic: string; class_name: string; pct: number; n: number }[];
}

export interface TopicStat {
  label: string;
  pct: number | null;
  n: number;
}

export interface ClassDiagnostics {
  class: { id: string; name: string; grade_year: string };
  overall_pct: number | null;
  correct: number;
  wrong: number;
  unanswered: number;
  sessions_count: number;
  topics: TopicStat[];
  hardest: {
    question_id: string;
    statement: string;
    difficulty: Difficulty;
    pct: number;
    n: number;
  }[];
  history: {
    session_id: string;
    title: string;
    date: string | null;
    participants: number;
    avg_pct: number | null;
  }[];
  students: {
    name: string;
    sessions: number;
    avg_pct: number | null;
  }[];
}

export interface QuestionDiag {
  question_id: string;
  position: number;
  statement: string;
  difficulty: Difficulty;
  topic: string;
  pct: number;
  n: number;
  options: { index: number; count: number }[];
  options_text?: string[];
  correct_index?: number;
}

export interface StudentResultDiag {
  student_id: string;
  name: string;
  points: number;
  correct: number;
  wrong: number;
  unanswered: number;
  avg_time_s: number | null;
}

export interface SessionDiagnostics {
  meta: {
    session_id: string;
    title: string;
    class_name: string;
    date: string | null;
    status: SessionStatus;
    created_at?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    room_code?: string;
  };
  participants: number;
  overall_pct: number | null;
  correct: number;
  wrong: number;
  unanswered: number;
  avg_points: number | null;
  avg_time_s: number | null;
  topics: TopicStat[];
  questions: QuestionDiag[];
  students: StudentResultDiag[];
}


