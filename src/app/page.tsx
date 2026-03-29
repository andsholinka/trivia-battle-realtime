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
  const [showQR, setShowQR] = useState(false);
  const [showResultFx, setShowResultFx] = useState(false);
  const [scannedRoomCode, setScannedRoomCode] = useState("");
  const [podiumReveal, setPodiumReveal] = useState(0);
  const [copied, setCopied] = useState(false);

  // Safety: reset loading jika stuck (max 10 detik)
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.log("[Safety] Resetting stuck loading state");
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Reset copied state when joinUrl changes
  useEffect(() => {
    setCopied(false);
  }, [joinUrl]);

  // Load saved session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const roomFromQr = (params.get("room") || "").trim().toUpperCase();
    if (roomFromQr) {
      setScannedRoomCode(roomFromQr);
      setRoomCodeInput(roomFromQr);
      return;
    }

    // Restore from localStorage if exists
    const savedRoomCode = localStorage.getItem("quizzy_roomCode");
    const savedPlayerId = localStorage.getItem("quizzy_playerId");
    const savedNickname = localStorage.getItem("quizzy_nickname");

    if (savedRoomCode && savedPlayerId) {
      setNickname(savedNickname || "");
      // Fetch room data to restore state
      fetch(`/api/rooms/${savedRoomCode}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Room not found");
          return response.json();
        })
        .then((data: RoomState) => {
          // Check if player still in room
          const playerExists = data.players.some((p) => p.id === savedPlayerId);
          if (playerExists) {
            setRoom(data);
            setCurrentPlayerId(savedPlayerId);
          } else {
            // Player no longer in room, clear storage
            localStorage.removeItem("quizzy_roomCode");
            localStorage.removeItem("quizzy_playerId");
            localStorage.removeItem("quizzy_nickname");
          }
        })
        .catch(() => {
          // Room not found, clear storage
          localStorage.removeItem("quizzy_roomCode");
          localStorage.removeItem("quizzy_playerId");
          localStorage.removeItem("quizzy_nickname");
        });
    }
  }, []);

  // Save session to localStorage when room/player changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (room?.code && currentPlayerId) {
      localStorage.setItem("quizzy_roomCode", room.code);
      localStorage.setItem("quizzy_playerId", currentPlayerId);
      localStorage.setItem("quizzy_nickname", nickname);
    } else {
      // Clear storage when not in room
      localStorage.removeItem("quizzy_roomCode");
      localStorage.removeItem("quizzy_playerId");
      localStorage.removeItem("quizzy_nickname");
    }
  }, [room?.code, currentPlayerId, nickname]);

  useEffect(() => {
    if (!room?.code) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms/${room.code}`, { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as RoomState;

        // Check if current player is still in the room (was kicked)
        if (currentPlayerId && data.players && !data.players.some((p) => p.id === currentPlayerId)) {
          setError("Kamu telah dikeluarkan dari room oleh host.");
          localStorage.removeItem("quizzy_roomCode");
          localStorage.removeItem("quizzy_playerId");
          localStorage.removeItem("quizzy_nickname");
          setRoom(null);
          setCurrentPlayerId(null);
          setQrCode("");
          setJoinUrl("");
          clearInterval(interval);
          return;
        }

        setRoom((current) => {
          if (!current || current.code !== data.code) return current;
          return data;
        });
      } catch {
        // no-op
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room?.code, currentPlayerId]);

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
  // Debug: log me state when room status changes to question or leaderboard
  useEffect(() => {
    if (room?.status === "question" || room?.status === "leaderboard") {
      console.log("[Debug] me state:", { me, currentPlayerId, hasAnswered: me?.hasAnswered, players: room?.players?.map(p => ({ id: p.id, name: p.name, hasAnswered: p.hasAnswered })) });
    }
  }, [room?.status, me, currentPlayerId, room?.players]);
  const amIHost = Boolean(room && currentPlayerId && room.hostId === currentPlayerId);
  const effectiveRoomCode = scannedRoomCode || roomCodeInput;
  const topThree = sortedPlayers.slice(0, 3);
  const third = topThree[2];
  const second = topThree[1];
  const first = topThree[0];

  const createRoom = async () => {
    const safeNickname = nickname.replace(/\s+/g, " ").trim();
    if (!safeNickname) {
      setError("Masukkan nama pemain dulu.");
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
      setError("Nama pemain dan kode room wajib diisi.");
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
    console.log("[Generate] Clicked", { room, currentPlayerId, category, questionCount });
    if (!room || !currentPlayerId) {
      console.log("[Generate] Missing room or currentPlayerId");
      return;
    }
    if (!category.trim()) {
      console.log("[Generate] Category empty");
      setError("Kategori wajib diisi sebelum generate pertanyaan.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      console.log("[Generate] Sending request...");
      const response = await fetch(`/api/rooms/${room.code}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId, category, questionCount: Number(questionCount || 5) }),
      });
      const data = await response.json();
      console.log("[Generate] Response:", response.status, data);
      if (!response.ok) throw new Error(data.error || "Gagal generate pertanyaan.");
      setRoom(data);
    } catch (err) {
      console.error("[Generate] Error:", err);
      setError(err instanceof Error ? err.message : "Gagal generate pertanyaan.");
    } finally {
      setLoading(false);
      console.log("[Generate] Done, loading=false");
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

  const leaveRoom = () => {
    localStorage.removeItem("quizzy_roomCode");
    localStorage.removeItem("quizzy_playerId");
    localStorage.removeItem("quizzy_nickname");
    setRoom(null);
    setCurrentPlayerId(null);
    setQrCode("");
    setJoinUrl("");
    setError("");
    setSelectedAnswer(null);
  };

  const kickPlayer = async (playerId: string, playerName: string) => {
    if (!room || !currentPlayerId) return;
    if (!confirm(`Keluarkan "${playerName}" dari room?`)) return;

    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "kick",
          code: room.code,
          playerId,
          hostId: currentPlayerId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal kick pemain.");
      // Refresh room data akan datang dari Pusher event
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kick pemain.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    console.log("[Answer] Clicked:", { answer, currentPlayerId, roomCode: room?.code });
    if (!room || !currentPlayerId || selectedAnswer) {
      console.log("[Answer] Blocked:", { hasRoom: !!room, hasPlayerId: !!currentPlayerId, selectedAnswer });
      return;
    }

    try {
      setSelectedAnswer(answer);
      setError("");
      console.log("[Answer] Sending to API...");
      const response = await fetch(`/api/rooms/${room.code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentPlayerId, answer }),
      });
      const data = await response.json();
      console.log("[Answer] API response:", response.status, data);
      if (!response.ok) throw new Error(data.error || "Gagal mengirim jawaban.");
      setRoom(data);
    } catch (err) {
      console.error("[Answer] Error:", err);
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

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-6 md:px-8 lg:px-10">
        <div className={`mt-2 grid gap-6 lg:items-start ${room ? "lg:grid-cols-[0.88fr_1.12fr]" : "lg:grid-cols-1 lg:place-items-center"}`}>
          <section className={`flex flex-col justify-center rounded-[2.2rem] border border-white/10 bg-white/8 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6 ${room ? "" : "w-full max-w-xl lg:max-w-2xl"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-200/70">Lobby</p>
                <div>
                <h1 className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-4xl font-black leading-none text-transparent md:text-6xl">Quizzy</h1>
                <p className="mt-1 text-sm font-bold italic text-yellow-300 md:text-base">Get Bizzy or Be Dizzy! 🎯</p>
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
                      <button
                        type="button"
                        onClick={() => {
                          console.log("[Button] Generate clicked", { loading, playersLength: room?.players?.length });
                          generateQuestions();
                        }}
                        disabled={loading || (room?.players?.length || 0) < 2}
                        className="rounded-3xl bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-pink-500/30 disabled:opacity-60"
                      >
                        {loading ? "Generating..." : room.questionsReady ? "Generate Ulang" : "Generate Pertanyaan"}
                      </button>
                      <button type="button" onClick={startGame} disabled={loading || !room.questionsReady || room.players.length < 2} className="rounded-3xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-60">{loading ? "Loading..." : "Start Game"}</button>
                    </div>
                  </div>
                ) : null}

                {amIHost && qrCode && room?.status === "lobby" ? (
                  <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Invite Players</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setShowQR(v => !v)}
                        className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/15 hover:scale-[1.02]"
                      >
                        {showQR ? "Hide QR" : "Show QR"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (joinUrl) {
                            await navigator.clipboard.writeText(joinUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className="rounded-3xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02]"
                      >
                        {copied ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                    {showQR && qrCode ? (
                      <div className="mt-4 flex flex-col items-center">
                        <img src={qrCode} alt="QR Join Room" className="w-48 rounded-3xl border border-white/10 bg-white/5 p-2" />
                        {joinUrl ? <p className="mt-2 break-all text-[11px] text-cyan-100/80">{joinUrl}</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Player List - Only show to host in lobby */}
                {room?.status === "lobby" && amIHost ? (
                  <div className="rounded-[1.8rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-100">
                        <span className="text-lg">👥</span>
                        Pemain ({room.players.length})
                      </h4>
                    </div>
                    <ul className="mt-4 grid gap-2">
                      {room.players.map((p) => (
                        <li
                          key={p.id}
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                            p.id === currentPlayerId
                              ? "border-amber-300/30 bg-amber-400/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-bold text-white">
                                {p.name} {p.id === currentPlayerId && <span className="ml-1 text-[10px] text-amber-300">(Host)</span>}
                              </p>
                            </div>
                          </div>
                          {p.id !== currentPlayerId ? (
                            <button
                              type="button"
                              onClick={() => kickPlayer(p.id, p.name)}
                              disabled={loading}
                              className="rounded-xl border border-red-400/30 bg-red-400/20 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-400/30 disabled:opacity-50"
                              title={`Keluarkan ${p.name}`}
                            >
                              Kick
                            </button>
                          ) : (
                            <span className="rounded-xl bg-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-100">
                              Kamu
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
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

                    {/* Championship Podium */}
                    <div className="mt-8">
                      {/* Podium Stage */}
                      <div className="relative flex items-end justify-center gap-2 sm:gap-3">
                        {/* 2nd Place - Left */}
                        <div className={`flex flex-col items-center transition-all duration-700 ${podiumReveal >= 2 ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
                          <div className="mb-3 text-center">
                            <p className="max-w-[80px] truncate text-xs font-bold text-slate-200 sm:max-w-[100px]">{second?.name ?? "-"}</p>
                            <p className="text-lg font-black text-slate-300">{second?.score ?? 0}</p>
                          </div>
                          <div className="relative">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-2xl shadow-lg shadow-slate-500/50 sm:h-16 sm:w-16">🥈</div>
                            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-xs font-black text-slate-900">2</div>
                          </div>
                          <div className="mt-2 flex h-24 w-16 items-end justify-center rounded-t-xl bg-gradient-to-t from-slate-600/80 to-slate-400/60 shadow-[0_0_30px_rgba(148,163,184,0.4)] backdrop-blur-sm sm:h-28 sm:w-20">
                            <span className="mb-2 text-xs font-bold text-slate-200">2nd</span>
                          </div>
                        </div>

                        {/* 1st Place - Center (Tallest) */}
                        <div className={`flex flex-col items-center transition-all duration-700 delay-150 ${podiumReveal >= 3 ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-95"}`}>
                          <div className="mb-3 text-center">
                            <p className="max-w-[90px] truncate text-sm font-bold text-yellow-200 sm:max-w-[110px]">{first?.name ?? "-"}</p>
                            <p className="text-xl font-black text-yellow-300">{first?.score ?? 0}</p>
                          </div>
                          <div className="relative">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-4xl shadow-[0_0_40px_rgba(251,191,36,0.6)] animate-pulse sm:h-24 sm:w-24">👑</div>
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl">✨</div>
                            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-sm font-black text-yellow-900">1</div>
                          </div>
                          <div className="mt-2 flex h-36 w-20 items-end justify-center rounded-t-xl bg-gradient-to-t from-amber-600/90 via-yellow-500/70 to-yellow-300/50 shadow-[0_0_50px_rgba(251,191,36,0.5)] backdrop-blur-sm sm:h-40 sm:w-24">
                            <span className="mb-3 text-sm font-black text-yellow-100">CHAMPION</span>
                          </div>
                        </div>

                        {/* 3rd Place - Right */}
                        <div className={`flex flex-col items-center transition-all duration-700 delay-75 ${podiumReveal >= 1 ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
                          <div className="mb-3 text-center">
                            <p className="max-w-[80px] truncate text-xs font-bold text-amber-200 sm:max-w-[100px]">{third?.name ?? "-"}</p>
                            <p className="text-lg font-black text-amber-300">{third?.score ?? 0}</p>
                          </div>
                          <div className="relative">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-2xl shadow-lg shadow-amber-700/50 sm:h-16 sm:w-16">🥉</div>
                            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs font-black text-amber-100">3</div>
                          </div>
                          <div className="mt-2 flex h-20 w-16 items-end justify-center rounded-t-xl bg-gradient-to-t from-amber-800/80 to-amber-600/60 shadow-[0_0_30px_rgba(180,83,9,0.4)] backdrop-blur-sm sm:h-24 sm:w-20">
                            <span className="mb-2 text-xs font-bold text-amber-200">3rd</span>
                          </div>
                        </div>
                      </div>

                      {/* Confetti Effect Lines */}
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className={`absolute left-1/4 top-1/4 h-2 w-2 rounded-full bg-yellow-400 transition-all duration-1000 ${podiumReveal >= 3 ? "opacity-100" : "opacity-0"}`} style={{ animation: "confetti 2s ease-out infinite" }}></div>
                        <div className={`absolute right-1/4 top-1/3 h-2 w-2 rounded-full bg-fuchsia-400 transition-all duration-1000 delay-200 ${podiumReveal >= 3 ? "opacity-100" : "opacity-0"}`} style={{ animation: "confetti 2s ease-out infinite 0.5s" }}></div>
                        <div className={`absolute left-1/3 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-400 transition-all duration-1000 delay-300 ${podiumReveal >= 3 ? "opacity-100" : "opacity-0"}`} style={{ animation: "confetti 2s ease-out infinite 1s" }}></div>
                      </div>
                    </div>
                    {amIHost ? (
                      <div className="mt-6 space-y-4">
                        <input value={category} onChange={(e) => { setCategory(e.target.value); if (error) setError(""); }} autoCapitalize="sentences" autoCorrect="off" spellCheck={false} placeholder="Kategori baru untuk restart game" className="w-full rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />
                        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                          <input type="number" min={3} max={20} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} className="w-full rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-base text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50" />
                          <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">3 - 20 soal</div>
                        </div>
                        <button type="button" onClick={restartGame} disabled={loading} className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white disabled:opacity-60">{loading ? "Loading..." : "Restart Game"}</button>
                        <button type="button" onClick={leaveRoom} className="w-full rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-bold text-white hover:bg-white/20">Kembali ke Lobby</button>
                      </div>
                    ) : (
                      <button type="button" onClick={leaveRoom} className="mt-6 w-full rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-bold text-white hover:bg-white/20">Kembali ke Lobby</button>
                    )}
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
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Live Leaderboard</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Klasemen Pemain</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-black text-white/70">{room.players.length} pemain</div>
              </div>
              <div className="mt-5 space-y-3">
                {sortedPlayers.length > 0 ? sortedPlayers.map((player, index) => {
                  const rankIcons = ["👑", "🥈", "🥉"];
                  const rankColors = [
                    "border-yellow-300/50 bg-gradient-to-r from-yellow-500/20 to-amber-600/10 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
                    "border-slate-300/40 bg-gradient-to-r from-slate-400/20 to-slate-600/10",
                    "border-amber-700/40 bg-gradient-to-r from-amber-600/20 to-amber-800/10"
                  ];
                  const isTop3 = index < 3;
                  return (
                    <div key={player.id} className={`flex items-center justify-between rounded-3xl border px-4 py-4 transition-all duration-300 hover:scale-[1.02] ${isTop3 ? rankColors[index] : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black ${isTop3 ? "bg-white/20" : "bg-white/10"}`}>
                          {isTop3 ? rankIcons[index] : <span className="text-white/60">#{index + 1}</span>}
                        </div>
                        <div>
                          <p className="font-black text-white">{player.name}</p>
                          <p className="text-xs uppercase tracking-[0.28em] text-white/40">{player.id === room?.hostId ? "🎯 Host" : "🎮 Player"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black ${isTop3 ? "text-white" : "text-cyan-200"}`}>{player.score}</p>
                        <p className="text-xs uppercase tracking-[0.25em] text-white/40">{room?.status === "leaderboard" || room?.status === "finished" ? (player.isCorrect ? `✅ +${player.lastEarnedPoints ?? 0}` : player.hasAnswered ? "❌ wrong" : "⏰ no answer") : player.hasAnswered ? "✓ answered" : "○ waiting"}</p>
                      </div>
                    </div>
                  );
                }) : <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-white/45">Belum ada pemain di room.</div>}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
