"use client";

import { useEffect, useMemo, useState } from "react";

type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered?: boolean;
  isCorrect?: boolean;
  answer?: string;
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
  category?: string | null;
  questionEndsAt: number | null;
  leaderboardEndsAt?: number | null;
  lastCorrectAnswer?: string | null;
  currentQuestion: CurrentQuestion | null;
};

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!room?.code) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms/${room.code}`, { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as RoomState;
        setRoom((current) => {
          if (!current || current.code !== data.code) return current;
          return data;
        });
      } catch {
        // no-op
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room?.code]);

  useEffect(() => {
    const deadline = room?.status === "question" ? room.questionEndsAt : room?.status === "leaderboard" ? room.leaderboardEndsAt ?? null : null;

    if (!deadline) {
      setTimeLeft(0);
      return;
    }

    const syncTimer = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(seconds);
    };

    syncTimer();
    const interval = setInterval(syncTimer, 250);
    return () => clearInterval(interval);
  }, [room?.questionEndsAt, room?.leaderboardEndsAt, room?.status]);

  useEffect(() => {
    if (room?.status !== "question") {
      setSelectedAnswer(null);
    }
  }, [room?.status, room?.currentQuestion?.id]);

  const sortedPlayers = useMemo(() => [...(room?.players ?? [])].sort((a, b) => b.score - a.score), [room?.players]);
  const me = room?.players.find((player) => player.id === currentPlayerId) ?? null;
  const amIHost = Boolean(room && currentPlayerId && room.hostId === currentPlayerId);

  const createRoom = async () => {
    const safeNickname = nickname.replace(/\s+/g, " ").trim();
    if (!safeNickname) {
      setError("Masukkan nickname dulu.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: safeNickname }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat room.");
      setRoom(data);
      const meData = data.players.find((player: Player) => player.name.toLowerCase() === safeNickname.toLowerCase());
      setCurrentPlayerId(meData?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat room.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const safeNickname = nickname.replace(/\s+/g, " ").trim();
    const safeRoomCode = roomCodeInput.replace(/\s+/g, "").trim().toUpperCase();
    if (!safeNickname || !safeRoomCode) {
      setError("Nickname dan kode room wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name: safeNickname, code: safeRoomCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal join room.");
      setRoom(data);
      const meData = data.players.find((player: Player) => player.name.toLowerCase() === safeNickname.toLowerCase());
      setCurrentPlayerId(meData?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal join room.");
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!room || !currentPlayerId) return;
    if (!category.trim()) {
      setError("Kategori wajib diisi sebelum start game.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId, category }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memulai game.");
      setRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai game.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!room || !currentPlayerId || selectedAnswer) return;

    try {
      setSelectedAnswer(answer);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayerId, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengirim jawaban.");
      setRoom(data);
    } catch (err) {
      setSelectedAnswer(null);
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban.");
    }
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
            AI Question Mode
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/7 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">Lobby Control</p>
            <h2 className="mt-3 text-3xl font-black leading-none md:text-5xl">
              {room ? `Room ${room.code}` : "Masuk ke arena kuis"}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/65">
              Host menentukan kategori, lalu AI Gemini akan membuat 5 soal untuk semua pemain dalam room yang sama.
            </p>

            {!room ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createRoom();
                }}
              >
                <input
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (error) setError("");
                  }}
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Masukkan nickname"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
                />
                <input
                  value={roomCodeInput}
                  onChange={(e) => {
                    setRoomCodeInput(e.target.value.toUpperCase());
                    if (error) setError("");
                  }}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Kode room (untuk join)"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white outline-none placeholder:text-white/35 focus:border-fuchsia-300/50"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="submit" disabled={loading} className="rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-950 disabled:opacity-60">
                    {loading ? "Loading..." : "Create Room"}
                  </button>
                  <button type="button" disabled={loading} onClick={joinRoom} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-white disabled:opacity-60">
                    {loading ? "Loading..." : "Join Room"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  Room berhasil dibuat / dimasuki.
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Kode Room</p>
                  <p className="mt-2 text-3xl font-black tracking-[0.25em] text-white">{room.code}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Status</p>
                  <p className="mt-2 text-lg font-bold text-white">{room.status.toUpperCase()}</p>
                  <p className="mt-1 text-sm text-white/55">Round {room.round} / {room.maxRounds}</p>
                  {room.category ? <p className="mt-1 text-sm text-cyan-100">Kategori: {room.category}</p> : null}
                </div>

                {room.status === "lobby" && amIHost ? (
                  <div className="space-y-3">
                    <input
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        if (error) setError("");
                      }}
                      autoCapitalize="sentences"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Tentukan kategori soal, misal: sepak bola, anime, sejarah Indonesia"
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
                    />
                    <button type="button" onClick={startGame} disabled={loading || room.players.length < 2} className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-950 disabled:opacity-60">
                      {loading ? "Generating..." : "Start Game"}
                    </button>
                  </div>
                ) : null}

                {room.status === "question" && room.currentQuestion ? (
                  <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">{room.currentQuestion.category}</p>
                      <p className="text-sm font-bold text-cyan-100">{timeLeft}s</p>
                    </div>
                    <p className="mt-3 text-lg font-bold text-white">{room.currentQuestion.question}</p>
                    <div className="mt-4 grid gap-3">
                      {room.currentQuestion.options.map((option) => {
                        const disabled = Boolean(selectedAnswer || me?.hasAnswered);
                        const active = selectedAnswer === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={disabled}
                            onClick={() => submitAnswer(option)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-white/10 bg-black/20 text-white"} disabled:opacity-70`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    {me?.hasAnswered ? <p className="mt-3 text-sm text-emerald-100">Jawaban sudah dikirim.</p> : null}
                  </div>
                ) : null}

                {room.status === "leaderboard" ? (
                  <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    <p>Jawaban benar: <span className="font-bold">{room.lastCorrectAnswer ?? "-"}</span></p>
                    <p className="mt-2">Soal berikutnya akan mulai otomatis dalam {timeLeft}s.</p>
                  </div>
                ) : null}

                {room.status === "finished" ? (
                  <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-4 text-sm text-fuchsia-100">
                    Game selesai.
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

          <section className="rounded-[2rem] border border-white/10 bg-white/7 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Realtime Ranking</p>
                <h3 className="mt-2 text-2xl font-black text-white">Player di Room</h3>
              </div>
              <div className="text-sm font-semibold text-white/55">{room ? `${room.players.length} pemain` : "0 pemain"}</div>
            </div>

            <div className="mt-5 space-y-3">
              {sortedPlayers.length > 0 ? sortedPlayers.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white">{player.name}</p>
                      <p className="text-xs uppercase tracking-[0.28em] text-white/40">{player.id === room?.hostId ? "Host" : "Player"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-cyan-200">{player.score}</p>
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">{room?.status === "leaderboard" || room?.status === "finished" ? (player.isCorrect ? "correct" : player.hasAnswered ? "wrong" : "no answer") : player.hasAnswered ? "answered" : "waiting"}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
                  Belum ada pemain di room.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
