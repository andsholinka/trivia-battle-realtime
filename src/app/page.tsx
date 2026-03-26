"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered?: boolean;
};

type CurrentQuestion = {
  id: number;
  category: string;
  question: string;
  options: string[];
};

type RoomState = {
  code: string;
  hostId: string;
  players: Player[];
  status: "lobby" | "question" | "leaderboard" | "finished";
  round: number;
  maxRounds: number;
  questionEndsAt: number | null;
  currentQuestion: CurrentQuestion | null;
};

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io({ path: "/api/socket/io" });
  }
  return socket;
}

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [resultAnswer, setResultAnswer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(15);
  const [socketId, setSocketId] = useState("");

  useEffect(() => {
    fetch("/api/socket");
    const client = getSocket();

    client.on("connect", () => {
      setSocketId(client.id ?? "");
    });

    client.on("room:joined", (data: RoomState) => {
      setRoom(data);
      setError("");
      setSelectedAnswer(null);
      setResultAnswer(null);
    });

    client.on("room:update", (data: RoomState) => {
      setRoom(data);
      if (data.status !== "question") {
        setSelectedAnswer(null);
      }
      if (data.status === "question") {
        setResultAnswer(null);
      }
    });

    client.on("question:result", ({ answer }: { answer: string }) => {
      setResultAnswer(answer);
    });

    client.on("room:error", (message: string) => {
      setError(message);
    });

    return () => {
      client.off("connect");
      client.off("room:joined");
      client.off("room:update");
      client.off("question:result");
      client.off("room:error");
    };
  }, []);

  useEffect(() => {
    if (!room?.questionEndsAt || room.status !== "question") {
      setTimeLeft(15);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((room.questionEndsAt! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [room?.questionEndsAt, room?.status]);

  const sortedPlayers = useMemo(() => [...(room?.players ?? [])].sort((a, b) => b.score - a.score), [room?.players]);
  const isHost = room?.hostId === socketId;
  const answeredCount = room?.players.filter((player) => player.hasAnswered).length ?? 0;
  const winner = sortedPlayers[0];

  const createRoom = () => {
    if (!nickname.trim()) {
      setError("Masukkan nickname dulu.");
      return;
    }
    getSocket().emit("room:create", { name: nickname });
  };

  const joinRoom = () => {
    if (!nickname.trim() || !roomCodeInput.trim()) {
      setError("Nickname dan kode room wajib diisi.");
      return;
    }
    getSocket().emit("room:join", { code: roomCodeInput.toUpperCase(), name: nickname });
  };

  const startGame = () => {
    if (!room) return;
    getSocket().emit("room:start", { code: room.code });
  };

  const sendAnswer = (answer: string) => {
    if (!room || selectedAnswer) return;
    setSelectedAnswer(answer);
    getSocket().emit("question:answer", { code: room.code, answer });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_25%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_28%),linear-gradient(160deg,#060816_0%,#0a1024_45%,#090312_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:56px_56px]" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 md:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-200/70">JemauDusun Game Lab</p>
            <h1 className="text-lg font-black tracking-tight text-white md:text-xl">Trivia Battle Real-Time</h1>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100">
            Multiplayer Ready
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/7 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">Lobby Control</p>
            <h2 className="mt-3 text-3xl font-black leading-none md:text-5xl">
              {room ? `Room ${room.code}` : "Masuk ke arena kuis"}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/65">
              Buat room sebagai host atau join memakai kode room. Cocok dimainkan ramai-ramai lewat HP.
            </p>

            {!room ? (
              <div className="mt-6 space-y-4">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Masukkan nickname"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
                />
                <input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="Kode room (untuk join)"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white outline-none placeholder:text-white/35 focus:border-fuchsia-300/50"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={createRoom} className="rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-950">
                    Create Room
                  </button>
                  <button onClick={joinRoom} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-white">
                    Join Room
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Status</p>
                  <p className="mt-2 text-lg font-bold text-white">{room.status.toUpperCase()}</p>
                  <p className="mt-1 text-sm text-white/55">Round {room.round} / {room.maxRounds}</p>
                </div>

                {room.status === "lobby" ? (
                  <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                    {room.players.length < 2
                      ? "Tunggu minimal 2 pemain agar game bisa dimulai."
                      : isHost
                        ? "Semua siap. Bos sebagai host bisa mulai game sekarang."
                        : "Menunggu host memulai game..."}
                  </div>
                ) : null}

                {room.status === "question" ? (
                  <div className="rounded-3xl border border-violet-300/20 bg-violet-400/10 p-4 text-sm text-violet-100">
                    {selectedAnswer
                      ? `Jawaban terkunci: ${selectedAnswer}`
                      : "Pilih jawaban secepat mungkin sebelum waktu habis."}
                    <div className="mt-2 text-white/70">Sudah menjawab: {answeredCount}/{room.players.length} pemain</div>
                  </div>
                ) : null}

                {isHost && room.status === "lobby" ? (
                  <button onClick={startGame} className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-950">
                    Start Game
                  </button>
                ) : null}

                {room?.status === "finished" && winner ? (
                  <div className="rounded-3xl border border-yellow-300/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                    Game selesai. Pemenang: <strong>{winner.name}</strong> dengan <strong>{winner.score}</strong> poin.
                  </div>
                ) : null}

                {resultAnswer ? (
                  <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                    Jawaban benar: <strong>{resultAnswer}</strong>
                    {room?.status === "leaderboard" ? <div className="mt-2 text-white/70">Ronde berikutnya akan dimulai otomatis...</div> : null}
                  </div>
                ) : null}
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </section>

          <section className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-violet-200/70">Live Question</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Arena Soal</h3>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {room?.status === "question" ? `${timeLeft}s tersisa` : room?.status === "leaderboard" ? "Lihat hasil ronde" : "Menunggu mulai"}
                </div>
              </div>

              <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-black/20 p-5 min-h-[320px]">
                {room?.currentQuestion ? (
                  <>
                    <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                      <span>{room.currentQuestion.category}</span>
                      <span>Round {room.round}</span>
                    </div>
                    <p className="mt-4 text-xl font-bold leading-8 text-white md:text-2xl">
                      {room.currentQuestion.question}
                    </p>
                    <div className="mt-5 grid gap-3">
                      {room.currentQuestion.options.map((option, index) => {
                        const isSelected = selectedAnswer === option;
                        const isCorrect = resultAnswer === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={!!selectedAnswer || room.status !== "question"}
                            onClick={() => sendAnswer(option)}
                            className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition md:text-base ${
                              isCorrect
                                ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
                                : isSelected
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
                  </>
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-center text-white/45">
                    <div>
                      <p className="text-lg font-bold text-white/70">Belum ada soal aktif</p>
                      <p className="mt-2 text-sm">Host bisa mulai game saat semua pemain sudah masuk room.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Realtime Ranking</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Leaderboard</h3>
                </div>
                <div className="text-sm font-semibold text-white/55">{room ? `${room.players.length} pemain` : "0 pemain"}</div>
              </div>

              <div className="mt-5 space-y-3">
                {sortedPlayers.length > 0 ? sortedPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${
                        index === 0 ? "bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-950" : index === 1 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950" : index === 2 ? "bg-gradient-to-br from-orange-300 to-amber-700 text-slate-950" : "bg-white/10 text-white"
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-white">{player.name}</p>
                        <p className="text-xs uppercase tracking-[0.28em] text-white/40">
                          {player.id === room?.hostId ? "Host" : "Player"}
                          {room?.status === "question" && player.hasAnswered ? " • answered" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-cyan-200">{player.score}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/40">points</p>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
                    Belum ada pemain di room.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
