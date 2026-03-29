"use client";

import { useEffect, useMemo, useState } from "react";

type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered?: boolean;
  isCorrect?: boolean;
  answer?: string;
  lastEarnedPoints?: number;
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
  questionCount?: number;
  category?: string | null;
  questionsReady?: boolean;
  questionEndsAt: number | null;
  leaderboardEndsAt?: number | null;
  finalResultsEndsAt?: number | null;
  lastCorrectAnswer?: string | null;
  everyoneAnswered?: boolean;
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
  const [questionCount, setQuestionCount] = useState("5");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [showResultFx, setShowResultFx] = useState(false);
  const [scannedRoomCode, setScannedRoomCode] = useState("");
  const [podiumReveal, setPodiumReveal] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const roomFromQr = (params.get("room") || "").trim().toUpperCase();
    if (roomFromQr) {
      setScannedRoomCode(roomFromQr);
      setRoomCodeInput(roomFromQr);
    }
  }, []);

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
    if (!room?.code || !currentPlayerId || room.status !== "lobby") return;

    fetch(`/api/rooms/${room.code}/qr`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setQrCode(data.dataUrl ?? null);
        setJoinUrl(data.joinUrl ?? null);
      })
      .catch(() => null);
  }, [room?.code, room?.status, currentPlayerId]);

  useEffect(() => {
    // Kalau semua sudah menjawab saat question, langsung set timer 0
    if (room?.status === "question" && room?.everyoneAnswered) {
      setTimeLeft(0);
      return;
    }

    const deadline = room?.status === "question"
      ? room.questionEndsAt
      : room?.status === "leaderboard"
        ? room.leaderboardEndsAt ?? null
        : room?.status === "finished"
          ? room.finalResultsEndsAt ?? null
          : null;

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
  }, [room?.questionEndsAt, room?.leaderboardEndsAt, room?.finalResultsEndsAt, room?.status, room?.everyoneAnswered]);

  useEffect(() => {
    if (room?.status !== "question") {
      setSelectedAnswer(null);
    }
  }, [room?.status, room?.currentQuestion?.id]);

  useEffect(() => {
    if (room?.status === "leaderboard" || room?.status === "finished") {
      setShowResultFx(true);
      const timeout = setTimeout(() => setShowResultFx(false), 1800);
      return () => clearTimeout(timeout);
    }
  }, [room?.status, room?.round]);

  useEffect(() => {
    if (room?.status !== "finished") {
      setPodiumReveal(0);
      return;
    }

    setPodiumReveal(0);
    const t1 = setTimeout(() => setPodiumReveal(1), 700);
    const t2 = setTimeout(() => setPodiumReveal(2), 1700);
    const t3 = setTimeout(() => setPodiumReveal(3), 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [room?.status, room?.code]);

  const sortedPlayers = useMemo(() => [...(room?.players ?? [])].sort((a, b) => b.score - a.score), [room?.players]);
  const me = room?.players.find((player) => player.id === currentPlayerId) ?? null;
  const amIHost = Boolean(room && currentPlayerId && room.hostId === currentPlayerId);
  const effectiveRoomCode = scannedRoomCode || roomCodeInput;
  const topThree = sortedPlayers.slice(0, 3);
  const third = topThree[2];
  const second = topThree[1];
  const first = topThree[0];

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
      setScannedRoomCode("");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat room.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const safeNickname = nickname.replace(/\s+/g, " ").trim();
    const safeRoomCode = effectiveRoomCode.replace(/\s+/g, "").trim().toUpperCase();
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

  const generateQuestions = async () => {
    if (!room || !currentPlayerId) return;
    if (!category.trim()) {
      setError("Kategori wajib diisi sebelum generate pertanyaan.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId, category, questionCount: Number(questionCount || 5) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal generate pertanyaan.");
      setRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate pertanyaan.");
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!room || !currentPlayerId) return;

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId }),
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

  const restartGame = async () => {
    if (!room || !currentPlayerId) return;
    if (!category.trim()) {
      setError("Kategori baru wajib diisi untuk restart game.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId, category, questionCount: Number(questionCount || 5) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal restart game.");
      setRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal restart game.");
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
    <main className="relative min-h-screen overflow-hidden bg-[#1a0b2e] text-white">
      {/* Vibrant gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,107,157,0.35),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(192,132,252,0.35),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.35),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(253,224,71,0.25),transparent_25%),linear-gradient(160deg,#1a0b2e_0%,#2d1b4e_40%,#1e3a5f_100%)]" />
      {/* Fun floating orbs */}
      <div className="absolute -top-20 left-10 h-56 w-56 rounded-full bg-pink-500/30 blur-3xl animate-pulse" />
      <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-purple-400/25 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute right-20 bottom-20 h-48 w-48 rounded-full bg-yellow-400/20 blur-3xl" />
      <div className="absolute left-1/4 top-1/2 h-32 w-32 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:46px_46px]" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 md:px-8 lg:px-10">
        <div className="mt-2 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="rounded-[2.2rem] border border-white/10 bg-white/8 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">Lobby</p>
                <div>
                <h1 className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-4xl font-black leading-none text-transparent md:text-6xl">Quizzy</h1>
                <p className="mt-1 text-sm font-bold italic text-yellow-300 md:text-base">Get Bizzy or be dizzy 🎯</p>
                <h2 className="mt-3 text-2xl font-black leading-none md:text-4xl">{room ? `Room ${room.code}` : scannedRoomCode ? `Join ${scannedRoomCode}` : "Quiz Battle"}</h2>
              </div>
              </div>
              {room ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Status</p>
                  <p className="mt-1 text-sm font-black text-cyan-100">{room.status.toUpperCase()}</p>
                </div>
              ) : null}
            </div>

            {!room ? (
              <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); scannedRoomCode ? joinRoom() : createRoom(); }}>
                <input value={nickname} onChange={(e) => { setNickname(e.target.value); if (error) setError(""); }} autoCapitalize="words" autoCorrect="off" spellCheck={false} placeholder="Nama pemain" className="w-full rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />

                {scannedRoomCode ? (
                  <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100">QR terhubung ke room <span className="font-black tracking-[0.2em]">{scannedRoomCode}</span></div>
                ) : (
                  <input value={roomCodeInput} onChange={(e) => { setRoomCodeInput(e.target.value.toUpperCase()); if (error) setError(""); }} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="Kode room untuk join" className="w-full rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-base uppercase tracking-[0.2em] text-white outline-none placeholder:text-white/35 focus:border-fuchsia-300/50" />
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {!scannedRoomCode ? <button type="submit" disabled={loading} className="rounded-3xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-pink-500/25 transition hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-60">{loading ? "Loading..." : "Create Room"}</button> : null}
                  <button type="button" disabled={loading} onClick={joinRoom} className="rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-60">{loading ? "Loading..." : scannedRoomCode ? "Join Sekarang" : "Join Room"}</button>
                </div>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-[1.8rem] border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">Room aktif. Ajak teman masuk lalu mainkan kuisnya.</div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Kode Room</p>
                    <p className="mt-2 text-3xl font-black tracking-[0.25em] text-white">{room.code}</p>
                    {room.category ? <p className="mt-2 text-sm text-cyan-100">Kategori: {room.category}</p> : null}
                    {room.questionsReady ? <p className="mt-1 text-sm text-emerald-100">Pertanyaan siap dimainkan.</p> : null}
                  </div>

                  <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Progress</p>
                    <p className="mt-2 text-lg font-black text-white">Round {room.round} / {room.maxRounds}</p>
                    <p className="mt-1 text-sm text-white/60">{room.players.length} pemain di room</p>
                    <p className="mt-1 text-sm text-white/60">Jumlah pertanyaan: {room.questionCount ?? room.maxRounds}</p>
                    {room.status === "question" || room.status === "leaderboard" || room.status === "finished" ? <p className="mt-1 text-sm text-yellow-200">Timer: {timeLeft}s</p> : null}
                  </div>
                </div>

                {amIHost && room.status === "lobby" ? (
                  <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                    <input value={category} onChange={(e) => { setCategory(e.target.value); if (error) setError(""); }} autoCapitalize="sentences" autoCorrect="off" spellCheck={false} placeholder="Kategori seru, misal: anime, sepak bola, Marvel, sejarah Indonesia" className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />
                    <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-white/45">Jumlah Pertanyaan</p>
                        <input type="number" min={3} max={20} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />
                      </div>
                      <div className="flex items-end">
                        <div className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-center text-sm text-white/70">3 - 20 soal</div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={generateQuestions} disabled={loading || room.players.length < 2} className="rounded-3xl bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-pink-500/30 disabled:opacity-60">{loading ? "Generating..." : room.questionsReady ? "Generate Ulang" : "Generate Pertanyaan"}</button>
                      <button type="button" onClick={startGame} disabled={loading || !room.questionsReady || room.players.length < 2} className="rounded-3xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-60">{loading ? "Loading..." : "Start Game"}</button>
                    </div>
                  </div>
                ) : null}

                {amIHost && qrCode ? (
                  <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">QR Join Room</p>
                    <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <img src={qrCode} alt="QR Join Room" className="w-40 rounded-3xl border border-white/10 bg-white/5 p-2" />
                      {joinUrl ? <p className="break-all text-xs text-cyan-100/80">{joinUrl}</p> : null}
                    </div>
                  </div>
                ) : null}

                {room.status === "question" && room.currentQuestion ? (
                  <div className="rounded-[1.8rem] border border-cyan-300/20 bg-cyan-400/10 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="rounded-full border border-cyan-300/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-100">{room.currentQuestion.category}</p>
                      <p className="rounded-full bg-black/20 px-3 py-1 text-sm font-black text-cyan-100">{timeLeft}s</p>
                    </div>
                    <p className="mt-4 text-xl font-black text-white md:text-2xl">{room.currentQuestion.question}</p>
                    <div className="mt-5 grid gap-3">
                      {room.currentQuestion.options.map((option, index) => {
                        const disabled = Boolean(selectedAnswer || me?.hasAnswered);
                        const active = selectedAnswer === option;
                        const gradients = ["from-pink-500 to-rose-500", "from-cyan-500 to-sky-500", "from-amber-400 to-orange-500", "from-emerald-400 to-green-500"];
                        return <button key={option} type="button" disabled={disabled} onClick={() => submitAnswer(option)} className={`rounded-3xl border px-5 py-4 text-left text-base font-bold transition ${active ? "border-white/60 bg-white/20 text-white scale-[1.01]" : `border-white/10 bg-gradient-to-r ${gradients[index % gradients.length]} text-white`} disabled:opacity-70`}>{option}</button>;
                      })}
                    </div>
                    {me?.hasAnswered ? <p className="mt-4 text-sm text-emerald-100">Jawaban sudah dikirim.</p> : null}
                  </div>
                ) : null}

                {room.status === "leaderboard" ? (
                  <div className={`rounded-[1.8rem] border border-amber-300/20 bg-amber-400/10 p-5 text-sm text-amber-100 transition-all duration-500 ${showResultFx ? "scale-[1.02] shadow-[0_0_40px_rgba(251,191,36,0.35)]" : ""}`}>
                    <p className="text-lg font-black">{me?.isCorrect ? "✅ Jawaban kamu benar!" : me?.hasAnswered ? "❌ Jawaban kamu salah." : "⏰ Kamu belum menjawab."}</p>
                    <p className="mt-2">Jawaban benar: <span className="font-black">{room.lastCorrectAnswer ?? "-"}</span></p>
                    <p className="mt-1">Poin kamu ronde ini: <span className="font-black">+{me?.lastEarnedPoints ?? 0}</span></p>
                    <p className="mt-3">Soal berikutnya mulai dalam {timeLeft}s.</p>
                  </div>
                ) : null}

                {room.status === "finished" ? (
                  <div className={`rounded-[2rem] border border-fuchsia-300/20 bg-fuchsia-400/10 p-5 text-sm text-fuchsia-100 transition-all duration-500 ${showResultFx ? "scale-[1.02] shadow-[0_0_40px_rgba(232,121,249,0.35)]" : ""}`}>
                    <p className="text-center text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">Final Result</p>
                    <p className="mt-2 text-center text-2xl font-black text-white md:text-3xl">🎉 Hasil Akhir 🎉</p>
                    <p className="mt-2 text-center">{me?.isCorrect ? "Jawaban terakhir kamu benar!" : me?.hasAnswered ? "Jawaban terakhir kamu salah." : "Kamu belum menjawab di soal terakhir."}</p>
                    <p className="mt-1 text-center">Poin terakhir: <span className="font-black">+{me?.lastEarnedPoints ?? 0}</span></p>
                    <div className="mt-6 space-y-3">
                      <div className={`rounded-3xl border border-amber-700/40 bg-amber-700/15 p-4 text-center transition-all duration-700 ${podiumReveal >= 1 ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}><p className="text-xs uppercase tracking-[0.3em] text-white/50">Peringkat 3</p><p className="mt-2 text-3xl">🥉</p><p className="mt-2 font-black text-white">{third?.name ?? "-"}</p><p className="text-sm text-white/70">{third?.score ?? 0} pts</p></div>
                      <div className={`rounded-3xl border border-slate-300/40 bg-slate-300/10 p-5 text-center transition-all duration-700 ${podiumReveal >= 2 ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}><p className="text-xs uppercase tracking-[0.3em] text-white/50">Peringkat 2</p><p className="mt-2 text-4xl">🥈</p><p className="mt-2 text-lg font-black text-white">{second?.name ?? "-"}</p><p className="text-sm text-white/70">{second?.score ?? 0} pts</p></div>
                      <div className={`rounded-3xl border border-yellow-300/50 bg-yellow-400/15 p-6 text-center transition-all duration-700 ${podiumReveal >= 3 ? "translate-y-0 opacity-100 scale-100" : "translate-y-6 opacity-0 scale-95"}`}><p className="text-xs uppercase tracking-[0.3em] text-yellow-100/80">Peringkat 1</p><p className="mt-2 text-5xl">👑</p><p className="mt-2 text-xl font-black text-white">{first?.name ?? "-"}</p><p className="text-sm text-white/80">{first?.score ?? 0} pts</p></div>
                    </div>
                    {amIHost ? (
                      <div className="mt-6 space-y-4">
                        <input value={category} onChange={(e) => { setCategory(e.target.value); if (error) setError(""); }} autoCapitalize="sentences" autoCorrect="off" spellCheck={false} placeholder="Kategori baru untuk restart game" className="w-full rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />
                        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                          <input type="number" min={3} max={20} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} className="w-full rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />
                          <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">3 - 20 soal</div>
                        </div>
                        <button type="button" onClick={restartGame} disabled={loading} className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white disabled:opacity-60">{loading ? "Loading..." : "Restart Game"}</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {error ? <div className="mt-4 rounded-3xl border border-rose-300/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">{error}</div> : null}
          </section>

          {room ? (
            <section className="rounded-[2.2rem] border border-white/10 bg-white/8 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Leaderboard</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Pemain di Room</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-black text-white/70">{room.players.length} pemain</div>
              </div>
              <div className="mt-5 space-y-3">
                {sortedPlayers.length > 0 ? sortedPlayers.map((player, index) => (
                  <div key={player.id} className={`flex items-center justify-between rounded-3xl border px-4 py-4 ${index === 0 ? "border-yellow-300/30 bg-yellow-400/10" : index === 1 ? "border-slate-300/20 bg-slate-300/10" : index === 2 ? "border-amber-700/30 bg-amber-700/10" : "border-white/10 bg-black/20"}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-base font-black text-white">#{index + 1}</div>
                      <div>
                        <p className="font-black text-white">{player.name}</p>
                        <p className="text-xs uppercase tracking-[0.28em] text-white/40">{player.id === room?.hostId ? "Host" : "Player"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-cyan-200">{player.score}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/40">{room?.status === "leaderboard" || room?.status === "finished" ? (player.isCorrect ? `+${player.lastEarnedPoints ?? 0} correct` : player.hasAnswered ? "wrong" : "no answer") : player.hasAnswered ? "answered" : "waiting"}</p>
                    </div>
                  </div>
                )) : <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/45">Belum ada pemain di room.</div>}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
