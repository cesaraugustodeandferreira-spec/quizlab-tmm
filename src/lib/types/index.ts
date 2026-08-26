export type UserRole = 'teacher'

export interface Teacher {
  id: string
  email: string
  full_name: string
  school?: string
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  teacher_id: string
  name: string
  grade?: string
  subject?: string
  created_at: string
  updated_at: string
}

export interface Quiz {
  id: string
  teacher_id: string
  class_id?: string
  title: string
  subject: string
  time_per_question: number
  status: 'draft' | 'published'
  is_shared: boolean
  questions_count?: number
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  quiz_id: string
  question_text: string
  question_order: number
  theme?: string
  subtheme?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  points: number
  created_at: string
  updated_at: string
}

export interface AnswerOption {
  id: string
  question_id: string
  option_text: string
  is_correct: boolean
  option_order: number
}

export interface QuizSession {
  id: string
  quiz_id: string
  class_id?: string
  room_code: string
  status: 'waiting' | 'active' | 'finished'
  current_question_index: number
  started_at?: string
  finished_at?: string
  created_at: string
  updated_at: string
}

export interface SessionParticipant {
  id: string
  session_id: string
  student_name: string
  joined_at: string
  is_connected: boolean
  total_score: number
}

export interface ParticipantAnswer {
  id: string
  session_id: string
  participant_id: string
  question_id: string
  selected_option_id: string
  is_correct: boolean
  answered_at: string
  time_taken_ms: number
  points_earned: number
}

export interface QuizResult {
  id: string
  session_id: string
  participant_id: string
  quiz_id: string
  class_id?: string
  total_score: number
  max_possible_score: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  completed_at: string
}

export interface QuestionResult {
  id: string
  result_id: string
  question_id: string
  selected_option_id?: string
  is_correct: boolean
  time_taken_ms: number
  points_earned: number
}

export interface LibraryQuiz {
  id: string
  quiz_id: string
  original_teacher_id: string
  title: string
  subject: string
  question_count: number
  time_per_question: number
  shared_at: string
}

export type SessionStatus = 'waiting' | 'active' | 'finished'
export type QuizStatus = 'draft' | 'published'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface DashboardStats {
  classes_count: number
  quizzes_created: number
  quizzes_conducted: number
  recent_activity: RecentActivity[]
}

export interface RecentActivity {
  id: string
  quiz_title: string
  class_name: string
  conducted_at: string
  average_score: number
  participant_count: number
}

export interface ClassDiagnostic {
  class_id: string
  class_name: string
  overall_performance: number
  total_answers_analyzed: number
  themes_evaluated: ThemePerformance[]
  weakest_themes: ThemePerformance[]
  strongest_themes: ThemePerformance[]
  hardest_questions: QuestionPerformance[]
}

export interface ThemePerformance {
  theme: string
  subtheme?: string
  correct_count: number
  total_count: number
  performance_percentage: number
}

export interface QuestionPerformance {
  question_id: string
  question_text: string
  theme?: string
  correct_count: number
  total_count: number
  performance_percentage: number
}

export interface IndividualDiagnostic {
  session_id: string
  quiz_title: string
  class_name: string
  conducted_at: string
  overall: {
    correct: number
    incorrect: number
    unanswered: number
    total_questions: number
    average_score: number
  }
  by_theme: ThemePerformance[]
  hardest_questions: QuestionPerformance[]
  participant_results: ParticipantResult[]
}

export interface ParticipantResult {
  participant_id: string
  student_name: string
  total_score: number
  max_score: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  answers: ParticipantAnswerDetail[]
}

export interface ParticipantAnswerDetail {
  question_id: string
  question_text: string
  theme?: string
  selected_option?: string
  correct_option: string
  is_correct: boolean
  time_taken_ms: number
  points_earned: number
}