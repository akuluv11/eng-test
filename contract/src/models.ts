export type UserRole = 'user' | 'admin' | 'nikita';

export interface User {
  login: string;
  password_hash: string;
  role: UserRole;
}

export interface Round {
  uuid: string;
  start_datetime: Date;
  end_datetime: Date;
  status: string;
  total_score: number;
}

export interface Score {
  user: string;
  round: string;
  score: number;
  taps: number;
}

// Дополнительные типы для ответов API
export interface RoundWithScore {
  round: Round;
  currentUserScore: number;
}

export interface RoundWithResults extends RoundWithScore {
  totalScore: number;
  bestPlayer: { username: string; score: number } | null;
  currentUserScore: number;
}

export interface BestPlayer {
  username: string;
  score: number;
}
