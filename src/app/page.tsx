"use client";

import { useMemo, useState } from "react";

type Player = {
  id: number;
  name: string;
  score: number;
};

type SampleQuestion = {
  question: string;
  options: string[];
  answer: string;
  category: string;
};

const SAMPLE_PLAYERS: Player[] = [
  { id: 1, name: "Bos", score: 920 },
  { id: 2, name: "Alya", score: 860 },
  { id: 3, name: "Raka", score: 790 },
  { id: 4, name: "Nina", score: 730 },
];

const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    category: "Pengetahuan Umum",
    question: "Planet terbesar di tata surya adalah...",
    options: ["Mars", "Jupiter", "Saturnus", "Venus"],
    answer: "Jupiter",
  },
  {
    category: "Teknologi",
    question: "HTML merupakan singkatan dari...",
    options: [
      "HyperText Markup Language",
      "HighText Machine Language",
      "Hyper Transfer Main Link",
      "Home Tool Markup Language",
    ],
    answer: "HyperText Markup Language",
  },
  {
    category: "Hiburan",
    question: "Warna yang dihasilkan dari campuran biru dan kuning adalah...",
    options: ["Merah", "Hijau", "Ungu", "Oranye"],
    answer: "Hijau",
  },
];

const SAMPLE_ROOM_CODE = "JEMAU7";

function NeonOrb({ className }: { className: string }) {
  return <div className={`absolute rounded-full blur-3xl ${className}`} />;
}

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const currentQuestion = useMemo(() => SAMPLE_QUESTIONS[0], []);
  const orderedPlayers = useMemo(() => [...SAMPLE_PLAYERS].sort((a, b) => b.score - a.score), []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_25%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_28%),linear-gradient(160deg,#060816_0%,#0a1024_45%,#090312_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:56px_56px]" />
      <NeonOrb className="-left-16 top-10 h-56 w-56 bg-cyan-400/25" />
      <NeonOrb className="right-0 top-20 h-64 w-64 bg-fuchsia-500/20" />
      <NeonOrb className="bottom-0 left-1/3 h-64 w-64 bg-violet-500/15" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-200/70">JemauDusun Game Lab</p>
            <h1 className="text-lg font-black tracking-tight text-white md:text-xl">Trivia Battle Real-Time</h1>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100">
            Mobile Multiplayer
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/7 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-fuchsia-100/85">
              Neon Gaming Party
            </div>
            <h2 className="mt-5 max-w-3xl text-4xl font-black leading-none tracking-tight md:text-6xl">
              Mabar kuis cepat,
              <span className="mt-2 block bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                rebut skor tertinggi.
              </span>
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
              Masuk room dari HP, jawab pertanyaan secepat mungkin, dan lihat leaderboard berubah secara real-time.
              MVP ini dirancang mobile-first dengan tampilan neon yang ramai tapi tetap nyaman dipakai.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Room Code", SAMPLE_ROOM_CODE],
                ["Mode", "4 Pemain"],
                ["Round", "10 Soal"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">{label}</p>
                  <p className="mt-2 text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/8 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/75">Buat room</p>
                <p className="mt-2 text-sm leading-7 text-white/65">Jadi host, pilih kategori, tentukan jumlah ronde, dan undang teman lewat kode room.</p>
                <button className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.35)] transition hover:scale-[1.02]">
                  Create Room
                </button>
              </div>

              <div className="rounded-[1.75rem] border border-fuchsia-300/20 bg-fuchsia-400/8 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-200/75">Join room</p>
                <div className="mt-4 space-y-3">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Nickname kamu"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-fuchsia-300/50"
                  />
                  <input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Masukkan kode room"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white outline-none placeholder:text-white/35 focus:border-fuchsia-300/50"
                  />
                </div>
                <button className="mt-5 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:bg-white/15">
                  Join Battle
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-violet-200/70">Live Preview</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Kartu Soal</h3>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  12s tersisa
                </div>
              </div>

              <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                  <span>{currentQuestion.category}</span>
                  <span>+120 poin</span>
                </div>
                <p className="mt-4 text-xl font-bold leading-8 text-white md:text-2xl">
                  {currentQuestion.question}
                </p>
                <div className="mt-5 grid gap-3">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSelectedAnswer(option)}
                        className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition md:text-base ${
                          isSelected
                            ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.22)]"
                            : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-xs">
                          {String.fromCharCode(65 + index)}
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Realtime Ranking</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Leaderboard</h3>
                </div>
                <div className="text-sm font-semibold text-white/55">Room {SAMPLE_ROOM_CODE}</div>
              </div>

              <div className="mt-5 space-y-3">
                {orderedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${
                        index === 0
                          ? "bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-950"
                          : index === 1
                            ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950"
                            : index === 2
                              ? "bg-gradient-to-br from-orange-300 to-amber-700 text-slate-950"
                              : "bg-white/10 text-white"
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        <p className="text-xs uppercase tracking-[0.28em] text-white/40">Player ready</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-cyan-200">{player.score}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/40">points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
