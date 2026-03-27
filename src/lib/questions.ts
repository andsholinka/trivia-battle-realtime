export type Question = {
  id: number;
  category: string;
  question: string;
  options: string[];
  answer: string;
};

export const QUESTION_DURATION_MS = 15000;
export const LEADERBOARD_PAUSE_MS = 5000;

export const QUESTIONS: Question[] = [
  { id: 1, category: "Pengetahuan Umum", question: "Planet terbesar di tata surya adalah...", options: ["Mars", "Jupiter", "Saturnus", "Venus"], answer: "Jupiter" },
  { id: 2, category: "Teknologi", question: "HTML merupakan singkatan dari...", options: ["HyperText Markup Language", "HighText Machine Language", "Hyper Tool Main Language", "HomeText Markdown Language"], answer: "HyperText Markup Language" },
  { id: 3, category: "Indonesia", question: "Ibukota Jawa Barat adalah...", options: ["Bandung", "Semarang", "Surabaya", "Serang"], answer: "Bandung" },
  { id: 4, category: "Hiburan", question: "Campuran warna biru dan kuning menghasilkan warna...", options: ["Merah", "Hijau", "Ungu", "Abu-abu"], answer: "Hijau" },
  { id: 5, category: "Sains", question: "Air mendidih pada suhu berapa derajat Celcius?", options: ["90", "95", "100", "110"], answer: "100" },
];
