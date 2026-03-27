export type Question = {
  id: number;
  category: string;
  question: string;
  options: string[];
  answer: string;
};

export const QUESTION_DURATION_MS = 15000;
export const LEADERBOARD_PAUSE_MS = 5000;
