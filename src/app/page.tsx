"use client";

import { Show, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";

type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered?: boolean;
  isCorrect?: boolean;
  answer?: string;
  lastEarnedPoints?: number;
  streak?: number;
  maxStreak?: number;
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
  status: "lobby" | "countdown" | "question" | "leaderboard" | "finished";
  countdownEndsAt?: number | null;
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
  streakBonusEnabled?: boolean;
};

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
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
  const [showSetup, setShowSetup] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [verifiedRoomCode, setVerifiedRoomCode] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);

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

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!room) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [room]);

  // Auto-create room setelah login (hanya sekali, dengan guard)
  const autoCreateTriggeredRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || room || isRestoringSession || scannedRoomCode || loading || autoCreateTriggeredRef.current) return;

    const defaultName = user?.username?.trim()
      || user?.firstName?.trim()
      || user?.primaryEmailAddress?.emailAddress?.split("@")[0]?.trim()
      || "Host";

    setNickname((current) => current.trim() || defaultName);
    autoCreateTriggeredRef.current = true;

    const timer = setTimeout(() => {
      void createRoom(defaultName);
    }, 100);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, user, room, isRestoringSession, scannedRoomCode, loading]);

  // Load saved session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const roomFromQr = (params.get("room") || "").trim().toUpperCase();
    if (roomFromQr) {
      setScannedRoomCode(roomFromQr);
      setRoomCodeInput(roomFromQr);
      // Don't return - allow session restore to check if player already in this room
    }

    // Restore from localStorage if exists
    const savedRoomCode = localStorage.getItem("quizzy_roomCode");
    const savedPlayerId = localStorage.getItem("quizzy_playerId");
    const savedNickname = localStorage.getItem("quizzy_nickname");

    // Determine which room to restore to
    // If QR code points to different room than saved session, prioritize QR code
    // (user wants to join a different room)
    const targetRoomCode = roomFromQr && savedRoomCode !== roomFromQr
      ? roomFromQr  // Different room via QR - don't restore old session
      : savedRoomCode;  // Same room or no QR - restore saved session

    // Only restore if we have a target room and player ID
    // Skip restore if QR code points to a different room (let user join manually)
    if (targetRoomCode && savedPlayerId && !(roomFromQr && savedRoomCode && savedRoomCode !== roomFromQr)) {
      setIsRestoringSession(true);
      setNickname(savedNickname || "");
      // Fetch room data to restore state
      fetch(`/api/rooms/${targetRoomCode}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Room not found");
          return response.json();
        })
        .then((data: RoomState) => {
          // Check if player still in room
          const playerExists = data.players?.some((p) => p.id === savedPlayerId);
          if (playerExists) {
            setRoom(data);
            setCurrentPlayerId(savedPlayerId);
          } else {
            // Player no longer in room, clear storage
            localStorage.removeItem("quizzy_roomCode");
            localStorage.removeItem("quizzy_playerId");
            localStorage.removeItem("quizzy_nickname");
          }
          setIsRestoringSession(false);
        })
        .catch(() => {
          // Room not found, clear storage
          localStorage.removeItem("quizzy_roomCode");
          localStorage.removeItem("quizzy_playerId");
          localStorage.removeItem("quizzy_nickname");
          setIsRestoringSession(false);
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
    if (!isLoaded || isSignedIn) return;

    localStorage.removeItem("quizzy_roomCode");
    localStorage.removeItem("quizzy_playerId");
    localStorage.removeItem("quizzy_nickname");
    setRoom(null);
    setCurrentPlayerId(null);
    setQrCode("");
    setJoinUrl("");
    setError("");
    setSelectedAnswer(null);
    setShowSetup(false);
    setNickname("");
  }, [isLoaded, isSignedIn]);

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
  const me = room?.players?.find((player) => player.id === currentPlayerId) ?? null;
  const amIHost = Boolean(room && currentPlayerId && room.hostId === currentPlayerId);
  const effectiveRoomCode = scannedRoomCode || roomCodeInput;
  const topThree = sortedPlayers.slice(0, 3);
  const third = topThree[2];
  const second = topThree[1];
  const first = topThree[0];

  const createRoom = async (overrideName?: string) => {
    const safeNickname = (overrideName ?? nickname).replace(/\s+/g, " ").trim();
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
      const meData = data.players?.find((player: Player) => player.name.toLowerCase() === safeNickname.toLowerCase());
      const playerId = meData?.id ?? null;
      setCurrentPlayerId(playerId);
      setScannedRoomCode("");
      setShowSetup(true); // Show setup view for host to configure questions
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
        // Persist host session to localStorage for reconnection on refresh
        if (playerId && data.code) {
          localStorage.setItem("quizzy_playerId", playerId);
          localStorage.setItem("quizzy_roomCode", data.code);
          localStorage.setItem("quizzy_nickname", safeNickname);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat room.");
    } finally {
      setLoading(false);
    }
  };

  const verifyRoomCode = async () => {
    const safeRoomCode = effectiveRoomCode.replace(/\s+/g, "").trim().toUpperCase();
    if (!safeRoomCode) {
      setError("Room code is required.");
      setShowErrorModal(true);
      // Vibrate phone if supported
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
      return;
    }

    try {
      setLoading(true);
      setError("");
      // Check if room exists
      const response = await fetch(`/api/rooms/${safeRoomCode}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Room not found.");
      }
      const data = await response.json();
      if (data.code) {
        // Room exists, show username modal
        setVerifiedRoomCode(safeRoomCode);
        setShowUsernameModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Room not found.");
      setShowErrorModal(true);
      // Vibrate phone if supported - longer pattern for error
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const safeNickname = nickname.replace(/\s+/g, " ").trim();
    if (!safeNickname) {
      setError("Nama pemain wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name: safeNickname, code: verifiedRoomCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal join room.");
      setRoom(data);
      const meData = data.players?.find((player: Player) => player.name.toLowerCase() === safeNickname.toLowerCase());
      const playerId = meData?.id ?? null;
      setCurrentPlayerId(playerId);
      // Persist session to localStorage for reconnection on refresh
      if (typeof window !== "undefined" && playerId) {
        localStorage.setItem("quizzy_playerId", playerId);
        localStorage.setItem("quizzy_roomCode", verifiedRoomCode);
        localStorage.setItem("quizzy_nickname", safeNickname);
      }
      // Close modal after successful join
      setShowUsernameModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal join room.");
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async (cat?: string, count?: number) => {
    const useCategory = cat?.trim() || category;
    const useCount = count || Number(questionCount || 5);

    if (!room || !currentPlayerId) {
      return;
    }
    if (!useCategory.trim()) {
      setError("Kategori wajib diisi sebelum generate pertanyaan.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId, category: useCategory, questionCount: useCount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal generate pertanyaan.");
      setRoom(data);
      setShowSetup(false); // Hide setup view after successful generation
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

  const returnToLobby = async () => {
    if (!room || !currentPlayerId) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/rooms/${room.code}/return-to-lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentPlayerId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Gagal kembali ke lobby");
      }
      const data = await response.json();
      setRoom(data.room ?? data);
      setShowSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kembali ke lobby");
    } finally {
      setLoading(false);
    }
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
      // Room data will refresh via socket event
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal kick pemain.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!room || !currentPlayerId || selectedAnswer) {
      return;
    }

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
      console.error("[Answer] Error:", err);
      setSelectedAnswer(null);
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban.");
    }
  };

  return (
    <main className={`relative bg-[#1a0b2e] text-white ${!room ? "h-[100dvh] overflow-hidden touch-none" : "min-h-screen overflow-hidden"}`}>
      {/* Vibrant gradient background - more colorful and fun */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,107,157,0.4),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(192,132,252,0.4),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(34,211,238,0.4),transparent_35%),radial-gradient(circle_at_70%_70%,rgba(253,224,71,0.3),transparent_30%),linear-gradient(160deg,#1a0b2e_0%,#2d1b4e_40%,#1e3a5f_100%)]" />
      {/* Fun floating orbs - more vibrant */}
      <div className="absolute -top-20 left-10 h-64 w-64 rounded-full bg-pink-500/40 blur-3xl animate-pulse" />
      <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-purple-400/35 blur-3xl animate-pulse delay-700" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-400/35 blur-3xl animate-pulse delay-1000" />
      <div className="absolute right-20 bottom-20 h-56 w-56 rounded-full bg-yellow-400/30 blur-3xl animate-pulse delay-500" />
      <div className="absolute left-1/4 top-1/2 h-40 w-40 rounded-full bg-orange-400/30 blur-3xl animate-pulse delay-300" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:46px_46px]" />

      <section className={`relative mx-auto flex max-w-5xl flex-col px-4 md:px-6 lg:px-8 ${!room ? "fixed inset-0 min-h-[100dvh] justify-center py-4 overflow-hidden" : "min-h-screen justify-center py-4"}`}>
        <div className={`grid gap-5 ${room ? "mt-2 lg:items-start lg:grid-cols-[0.85fr_1.15fr]" : "flex-1 place-items-center content-center lg:grid-cols-1"}`}>
          <section className={`flex flex-col justify-center ${room ? "" : "w-full max-w-md lg:max-w-lg"}`}>
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div>
                {!room && !isRestoringSession ? (
                  <>
                    <h1 
                      className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-5xl font-black leading-tight text-transparent md:text-7xl drop-shadow-2xl"
                      style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                      Quizzy
                    </h1>
                    <p 
                      className="mt-2 text-base font-black italic text-yellow-300 md:text-lg drop-shadow-lg animate-pulse"
                      style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                      Get Bizzy or Be Dizzy!
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            {isRestoringSession ? (
              <div className="mt-10 flex flex-col items-center justify-center space-y-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-cyan-400" />
                <p className="text-base text-white/70">Menyambungkan kembali...</p>
              </div>
            ) : !room ? (
              <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); verifyRoomCode(); }} style={{ fontFamily: "'Poppins', sans-serif" }}>
                {/* Room Code Input with Fun Styling */}
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-[2.2rem] blur-lg opacity-50 group-hover:opacity-75 transition duration-300 animate-pulse"></div>
                  <input
                    value={scannedRoomCode || roomCodeInput}
                    onChange={(e) => {
                      if (!scannedRoomCode) {
                        setRoomCodeInput(e.target.value.toUpperCase());
                        if (error) setError("");
                      }
                    }}
                    disabled={Boolean(scannedRoomCode)}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="ENTER CODE"
                    maxLength={6}
                    style={{ fontFamily: "'Fredoka', sans-serif" }}
                    className="relative w-full rounded-[2rem] border-2 border-purple-400/60 bg-gradient-to-br from-purple-900/60 to-indigo-900/60 px-6 py-5 text-center text-2xl font-bold uppercase tracking-[0.4em] text-white outline-none placeholder:text-purple-300/60 focus:border-cyan-400/80 focus:bg-gradient-to-br focus:from-purple-900/80 focus:to-indigo-900/80 focus:ring-4 focus:ring-cyan-400/30 transition-all shadow-2xl shadow-purple-500/30 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-purple-500/50 hover:scale-[1.02]"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <button 
                    type="submit" 
                    disabled={loading || effectiveRoomCode.trim().length !== 6} 
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                    className="w-full rounded-[2rem] border-2 border-white/40 bg-white/20 px-6 py-4 text-base font-black uppercase tracking-[0.12em] text-white backdrop-blur-md transition-all hover:bg-white/30 hover:scale-[1.03] hover:shadow-2xl hover:shadow-white/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                  >
                    {loading ? "⏳ Checking..." : "JOIN THE PARTY! 🚀"}
                  </button>
                  
                  {isSignedIn ? (
                    <button 
                      type="button"
                      onClick={() => createRoom()}
                      disabled={loading}
                      style={{ fontFamily: "'Fredoka', sans-serif" }}
                      className="w-full rounded-[2rem] bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-6 py-4 text-lg font-bold uppercase tracking-[0.15em] text-white shadow-2xl shadow-pink-500/50 transition-all hover:shadow-pink-500/70 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "⏳ Creating..." : "CREATE ROOM!"}
                    </button>
                  ) : (
                    <SignInButton mode="modal">
                      <button 
                        type="button"
                        style={{ fontFamily: "'Fredoka', sans-serif" }}
                        className="w-full rounded-[2rem] bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-6 py-4 text-lg font-bold uppercase tracking-[0.15em] text-white shadow-2xl shadow-pink-500/50 transition-all hover:shadow-pink-500/70 hover:scale-[1.03] active:scale-[0.97]"
                      >
                        CREATE ROOM!
                      </button>
                    </SignInButton>
                  )}
                </div>
              </form>
            ) : null}

            {room && (
              <div className="mt-6 space-y-4">

                {amIHost && room.status === "lobby" ? (
                  <div className="space-y-3 rounded-[1.4rem] border border-white/10 bg-black/20 p-3">
                    {/* Question Configuration Form - Only show when category not yet set */}
                    {!room.category ? (
                      <div className="space-y-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚙️</span>
                          <p className="text-sm font-bold text-amber-200">Konfigurasi Pertanyaan</p>
                        </div>
                        
                        {/* Category Input */}
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Kategori Pertanyaan</p>
                          <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Bebas apapun!"
                            className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        
                        {/* Question Count Selection */}
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Jumlah Pertanyaan</p>
                          <div className="flex gap-2">
                            {[5, 10, 15, 20].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setQuestionCount(num.toString())}
                                className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
                                  questionCount === num.toString()
                                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/25"
                                    : "bg-white/10 border border-white/20 text-white hover:bg-white/20"
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Generate Button */}
                        <button
                          type="button"
                          onClick={() => generateQuestions(category, parseInt(questionCount) || 5)}
                          disabled={loading || !category.trim()}
                          className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <span>✨</span> Generate Pertanyaan
                            </span>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Category set - show ready state with reset option */
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Kategori</p>
                          <p className="text-lg font-bold text-cyan-300">{room.category}</p>
                          <p className="mt-1 text-xs text-emerald-100 md:text-sm">✅ Pertanyaan siap dimainkan ({room.questionCount || questionCount} pertanyaan)</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Yakin mau reset dan generate pertanyaan baru? Kategori saat ini akan dihapus.")) return;
                            setLoading(true);
                            try {
                              const res = await fetch(`/api/rooms/${room.code}/reset-questions`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ hostId: currentPlayerId }),
                              });
                              if (res.ok) {
                                setCategory("");
                                setQuestionCount("5");
                              }
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
                        >
                          {loading ? "Loading..." : "↻ Reset & Ganti Pertanyaan"}
                        </button>
                      </div>
                    )}
                    
                    {/* Streak Bonus Toggle */}
                    <div className="rounded-2xl border border-orange-300/30 bg-gradient-to-r from-orange-400/20 via-amber-500/10 to-yellow-400/20 p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-400 shadow-lg shadow-orange-500/30">
                            <span className="text-xl sm:text-2xl">🔥</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-white">Streak Bonus</p>
                            <p className="text-xs text-orange-200/80">Bonus bertambah tiap jawaban benar berturut-turut</p>
                            <p className="mt-0.5 sm:mt-1 text-[10px] text-amber-300/90">+5 (3x) • +10 (5x) • +15 (7x) • +25 (10x)</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setLoading(true);
                            try {
                              const res = await fetch(`/api/rooms/${room.code}/toggle-streak`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ hostId: currentPlayerId }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                // Update room state immediately from API response
                                if (data.room) {
                                  setRoom(data.room);
                                }
                              }
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className={`relative h-9 w-[72px] sm:h-10 sm:w-20 shrink-0 self-end sm:self-auto rounded-full transition-all duration-300 ${room.streakBonusEnabled ? "bg-gradient-to-r from-orange-400 to-amber-400 shadow-lg shadow-orange-500/40" : "bg-slate-600/50"}`}
                        >
                          <span className={`pointer-events-none absolute top-1 sm:top-1.5 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-white shadow-md transition-all duration-300 ${room.streakBonusEnabled ? "left-9 sm:left-11" : "left-1 sm:left-1.5"}`}></span>
                          <span className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-black ${room.streakBonusEnabled ? "pr-6 sm:pr-8 text-white" : "pl-4 sm:pl-6 text-white/70"}`}>
                            {room.streakBonusEnabled ? "ON" : "OFF"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={startGame} disabled={loading || !room.questionsReady || (room.players?.length ?? 0) < 2} className="rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-60 md:text-sm">{loading ? "Loading..." : "Start Game"}</button>
                    </div>
                  </div>
                ) : null}

                {/* Player Lobby Showcase - Visible to NON-HOST players in lobby */}
                {room?.status === "lobby" && (room.players?.length ?? 0) > 0 && !amIHost ? (
                  <div className="relative overflow-hidden rounded-[1.8rem] border border-cyan-300/20 bg-gradient-to-br from-slate-900/80 via-purple-900/20 to-slate-900/80 p-5 shadow-2xl shadow-cyan-500/10">
                    {/* Animated background glow */}
                    <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-400/20 blur-3xl animate-pulse delay-700"></div>
                    
                    {/* Header */}
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 shadow-lg shadow-cyan-500/30">
                          <span className="text-xl">⚡</span>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">Players Ready</p>
                          <p className="text-lg font-black text-white">{room.players?.length ?? 0} Pemain Bergabung</p>
                        </div>
                      </div>
                      {/* Live pulse indicator */}
                      <div className="flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Live</span>
                      </div>
                    </div>
                    
                    {/* Players Grid */}
                    <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {(room.players ?? []).map((p, idx) => (
                        <div
                          key={p.id}
                          className={`group relative overflow-hidden rounded-2xl border p-3 transition-all duration-300 hover:scale-105 ${
                            p.id === currentPlayerId
                              ? "border-amber-300/40 bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent shadow-lg shadow-amber-500/20"
                              : p.id === room.hostId
                                ? "border-purple-300/40 bg-gradient-to-br from-purple-400/20 via-purple-500/10 to-transparent shadow-lg shadow-purple-500/20"
                                : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-cyan-400/10"
                          }`}
                          style={{ animationDelay: `${idx * 100}ms` }}
                        >
                          {/* Avatar */}
                          <div className="flex flex-col items-center gap-2">
                            <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black shadow-lg ${
                              p.id === currentPlayerId
                                ? "bg-gradient-to-br from-amber-300 via-orange-400 to-red-400 shadow-amber-500/30"
                                : p.id === room.hostId
                                  ? "bg-gradient-to-br from-purple-400 via-pink-400 to-rose-400 shadow-purple-500/30"
                                  : "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-500 shadow-cyan-500/30"
                            }`}>
                              {p.name.charAt(0).toUpperCase()}
                              {p.id === currentPlayerId && (
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] shadow-lg">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="max-w-[80px] truncate text-sm font-bold text-white">{p.name}</p>
                              {p.id === room.hostId && (
                                <span className="mt-1 inline-block rounded-full bg-purple-400/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-200">
                                  Host
                                </span>
                              )}
                              {p.id === currentPlayerId && p.id !== room.hostId && (
                                <span className="mt-1 inline-block rounded-full bg-amber-400/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Category Banner */}
                    {room.category && (
                      <div className="relative mt-5 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 via-blue-500/10 to-purple-500/10 p-4">
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-2xl">
                            {room.category === "General Knowledge" && "🌍"}
                            {room.category === "Science" && "🔬"}
                            {room.category === "History" && "📜"}
                            {room.category === "Sports" && "⚽"}
                            {room.category === "Entertainment" && "🎬"}
                            {room.category === "Geography" && "🗺️"}
                            {!["General Knowledge", "Science", "History", "Sports", "Entertainment", "Geography"].includes(room.category) && "🎯"}
                          </span>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">Kategori Pertandingan</p>
                            <p className="text-lg font-black text-cyan-100">{room.category}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Streak Bonus Info for non-host */}
                    {!amIHost && room.streakBonusEnabled && (
                      <div className="relative mt-4 rounded-2xl border border-orange-300/30 bg-gradient-to-r from-orange-400/20 via-amber-500/10 to-yellow-400/20 p-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-400 shadow-lg shadow-orange-500/30">
                            <span className="text-xl">🔥</span>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black text-orange-200">Streak Bonus Aktif!</p>
                            <p className="text-xs text-orange-300/90">Jawab benar berturut-turut untuk bonus tambahan</p>
                            <p className="mt-1 text-[10px] text-amber-300/80">+5 (3x) • +10 (5x) • +15 (7x) • +25 (10x)</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Waiting message for non-host */}
                    {!amIHost && (
                      <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                        <p className="text-sm font-medium text-white/80">
                          <span className="mr-2 animate-bounce inline-block">⏳</span>
                          Menunggu host memulai pertandingan...
                        </p>
                        <p className="mt-1 text-xs text-white/50">Siapkan dirimu!</p>
                      </div>
                    )}

                    {/* Leave Room button for non-host in lobby */}
                    {!amIHost && room?.status === "lobby" && (
                      <button
                        type="button"
                        onClick={() => {
                          // Clear all room session data
                          localStorage.removeItem("quizzy_roomCode");
                          localStorage.removeItem("quizzy_playerId");
                          localStorage.removeItem("quizzy_nickname");
                          // Kill session - return to landing page
                          setRoom(null);
                          setCurrentPlayerId(null);
                          setQrCode("");
                          setJoinUrl("");
                          setError("");
                        }}
                        className="mt-4 w-full rounded-full border border-red-400/40 bg-gradient-to-r from-red-500/80 to-rose-600/80 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_8px_24px_rgba(239,68,68,0.35)] transition hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(239,68,68,0.45)] active:scale-[0.98]"
                      >
                        🚪 Keluar dari Room
                      </button>
                    )}
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
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Player List - Show in lobby, except for NON-HOST players before game starts */}
                {room?.status === "lobby" && amIHost ? (
                  <div className="rounded-[1.4rem] border border-emerald-300/20 bg-emerald-400/10 p-3 md:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-100 md:text-sm">
                        <span className="text-base">👥</span>
                        Pemain ({room.players?.length ?? 0})
                      </h4>
                    </div>
                    <ul className="mt-3 grid gap-2">
                      {(room.players ?? []).map((p) => (
                        <li
                          key={p.id}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
                            p.id === currentPlayerId
                              ? "border-amber-300/30 bg-amber-400/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-bold text-white">
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-white">
                                {p.name} {p.id === room.hostId && <span className="ml-1 text-[10px] text-amber-300">(Host)</span>}
                              </p>
                            </div>
                          </div>
                          {amIHost && p.id !== currentPlayerId ? (
                            <button
                              type="button"
                              onClick={() => kickPlayer(p.id, p.name)}
                              disabled={loading}
                              className="rounded-lg border border-red-400/30 bg-red-400/20 px-2 py-1 text-[10px] font-bold text-red-100 transition hover:bg-red-400/30 disabled:opacity-50 md:text-xs"
                              title={`Keluarkan ${p.name}`}
                            >
                              Kick
                            </button>
                          ) : p.id === currentPlayerId ? (
                            <span className="rounded-lg bg-emerald-400/20 px-2 py-1 text-[10px] font-bold text-emerald-100 md:text-xs">
                              Kamu
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Countdown Overlay - Shows to all players when game is starting */}
                {room?.status === "countdown" && (
                  <div className="rounded-[1.4rem] border border-amber-300/30 bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-red-500/20 p-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Game Starting</p>
                    <p className="mt-1 text-sm font-bold text-white md:text-base">Siap-siap!</p>
                    <div className="mt-3 flex items-center justify-center">
                      <div className="relative">
                        {/* Animated countdown number */}
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-4xl font-black text-white shadow-[0_0_40px_rgba(251,191,36,0.5)] animate-pulse md:h-20 md:w-20 md:text-5xl">
                          {(() => {
                            const endsAt = room?.countdownEndsAt ?? 0;
                            const now = Date.now();
                            const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
                            return remaining > 0 ? remaining : "GO!";
                          })()}
                        </span>
                        {/* Rotating ring effect */}
                        <div className="absolute inset-0 rounded-full border-4 border-amber-300/30 animate-[spin_3s_linear_infinite]" style={{ borderStyle: 'dashed' }}></div>
                        <div className="absolute inset-[-6px] rounded-full border-2 border-orange-400/20 animate-[spin_4s_linear_infinite_reverse]"></div>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-amber-200/70 md:text-sm">Pertanyaan pertama segera muncul...</p>
                  </div>
                )}

                {room?.status === "question" && room.currentQuestion ? (
                  <div className="rounded-[1.4rem] border border-cyan-300/20 bg-cyan-400/10 p-3 md:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="rounded-full border border-cyan-300/20 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100">{room.currentQuestion.category}</p>
                      <p className="rounded-full bg-black/20 px-2 py-1 text-xs font-black text-cyan-100 md:text-sm">{timeLeft}s</p>
                    </div>
                    <p className="mt-2 text-center text-xs font-black text-cyan-200/90">
                      {room.round}/{room.maxRounds}
                    </p>
                    <p className="mt-3 text-lg font-black text-white md:text-xl">{room.currentQuestion.question}</p>
                    <div className="mt-4 grid gap-2">
                      {room.currentQuestion.options.map((option, index) => {
                        const disabled = Boolean(selectedAnswer || me?.hasAnswered);
                        const active = selectedAnswer === option;
                        const gradients = ["from-pink-500 to-rose-500", "from-cyan-500 to-sky-500", "from-amber-400 to-orange-500", "from-emerald-400 to-green-500"];
                        return <button key={option} type="button" disabled={disabled} onClick={() => submitAnswer(option)} className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${active ? "border-white/60 bg-white/20 text-white scale-[1.01]" : `border-white/10 bg-gradient-to-r ${gradients[index % gradients.length]} text-white`} disabled:opacity-70 md:text-base`}>{option}</button>;
                      })}
                    </div>
                    {me?.hasAnswered ? <p className="mt-3 text-xs text-emerald-100 md:text-sm">Jawaban sudah dikirim.</p> : null}
                  </div>
                ) : null}

                {room.status === "leaderboard" ? (
                  <div className={`rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100 transition-all duration-500 ${showResultFx ? "scale-[1.02] shadow-[0_0_40px_rgba(251,191,36,0.35)]" : ""}`}>
                    <p className="text-base font-black">{me?.isCorrect ? "✅ Jawaban kamu benar!" : me?.hasAnswered ? "❌ Jawaban kamu salah." : "⏰ Kamu belum menjawab."}</p>
                    <p className="mt-2">Jawaban benar: <span className="font-black">{room.lastCorrectAnswer ?? "-"}</span></p>
                    <p className="mt-1">Poin kamu ronde ini: <span className="font-black">+{me?.lastEarnedPoints ?? 0}</span></p>
                    {room.streakBonusEnabled && me?.isCorrect && (() => {
                      const s = me?.streak ?? 0;
                      let bonus = 0;
                      let label = "";
                      if (s >= 10) { bonus = 25; label = "10x"; }
                      else if (s >= 7) { bonus = 15; label = "7x"; }
                      else if (s >= 5) { bonus = 10; label = "5x"; }
                      else if (s >= 3) { bonus = 5; label = "3x"; }
                      if (bonus > 0) {
                        return (
                          <p className="mt-1 rounded-full border border-rose-300/30 bg-gradient-to-r from-pink-400/20 to-rose-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-rose-200">
                            🔥 Streak {label}: +{bonus} poin!
                          </p>
                        );
                      }
                      return null;
                    })()}
                    <p className="mt-3">Soal berikutnya mulai dalam {timeLeft}s.</p>
                  </div>
                ) : null}

                {room.status === "finished" ? (
                  <div className={`rounded-[1.4rem] border border-fuchsia-300/20 bg-fuchsia-400/10 p-4 text-sm text-fuchsia-100 transition-all duration-500 ${showResultFx ? "scale-[1.02] shadow-[0_0_40px_rgba(232,121,249,0.35)]" : ""}`}>
                    <p className="text-center text-xs uppercase tracking-[0.25em] text-fuchsia-200/70">Final Result</p>
                    <p className="mt-1 text-center text-xl font-black text-white md:text-2xl">🎉 Hasil Akhir 🎉</p>
                    <p className="mt-2 text-center">{me?.isCorrect ? "Jawaban terakhir kamu benar!" : me?.hasAnswered ? "Jawaban terakhir kamu salah." : "Kamu belum menjawab di soal terakhir."}</p>
                    <p className="mt-1 text-center">Poin terakhir: <span className="font-black">+{me?.lastEarnedPoints ?? 0}</span></p>
                    {room.streakBonusEnabled && me?.isCorrect && (() => {
                      const s = me?.streak ?? 0;
                      let bonus = 0;
                      let label = "";
                      if (s >= 10) { bonus = 25; label = "10x"; }
                      else if (s >= 7) { bonus = 15; label = "7x"; }
                      else if (s >= 5) { bonus = 10; label = "5x"; }
                      else if (s >= 3) { bonus = 5; label = "3x"; }
                      if (bonus > 0) {
                        return (
                          <p className="mt-2 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-gradient-to-r from-pink-400/20 to-rose-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-rose-200">
                              🔥 Streak {label}: +{bonus} poin!
                            </span>
                          </p>
                        );
                      }
                      return null;
                    })()}

                    {/* Championship Podium */}
                    <div className="mt-6">
                      {/* Podium Stage */}
                      <div className="relative flex items-end justify-center gap-2 sm:gap-3">
                        {/* 2nd Place - Left */}
                        <div className={`flex flex-col items-center transition-all duration-700 ${podiumReveal >= 2 ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
                          <div className="mb-2 text-center">
                            <p className="max-w-[70px] truncate text-xs font-bold text-slate-200 sm:max-w-[90px]">{second?.name ?? "-"}</p>
                            <p className="text-base font-black text-slate-300">{second?.score ?? 0}</p>
                          </div>
                          <div className="relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-xl shadow-lg shadow-slate-500/50 sm:h-14 sm:w-14">🥈</div>
                            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-400 text-xs font-black text-slate-900">2</div>
                          </div>
                          <div className="mt-2 flex h-20 w-14 items-end justify-center rounded-t-lg bg-gradient-to-t from-slate-600/80 to-slate-400/60 shadow-[0_0_30px_rgba(148,163,184,0.4)] backdrop-blur-sm sm:h-24 sm:w-16">
                            <span className="mb-1 text-xs font-bold text-slate-200">2nd</span>
                          </div>
                        </div>

                        {/* 1st Place - Center (Tallest) */}
                        <div className={`flex flex-col items-center transition-all duration-700 delay-150 ${podiumReveal >= 3 ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-95"}`}>
                          <div className="mb-2 text-center">
                            <p className="max-w-[80px] truncate text-xs font-bold text-yellow-200 sm:max-w-[100px]">{first?.name ?? "-"}</p>
                            <p className="text-lg font-black text-yellow-300">{first?.score ?? 0}</p>
                          </div>
                          <div className="relative">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-3xl shadow-[0_0_40px_rgba(251,191,36,0.6)] animate-pulse sm:h-20 sm:w-20">👑</div>
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl">✨</div>
                            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-black text-yellow-900">1</div>
                          </div>
                          <div className="mt-2 flex h-28 w-18 items-end justify-center rounded-t-lg bg-gradient-to-t from-amber-600/90 via-yellow-500/70 to-yellow-300/50 shadow-[0_0_50px_rgba(251,191,36,0.5)] backdrop-blur-sm sm:h-32 sm:w-20">
                            <span className="mb-2 text-xs font-black text-yellow-100">CHAMPION</span>
                          </div>
                        </div>

                        {/* 3rd Place - Right */}
                        <div className={`flex flex-col items-center transition-all duration-700 delay-75 ${podiumReveal >= 1 ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
                          <div className="mb-2 text-center">
                            <p className="max-w-[70px] truncate text-xs font-bold text-amber-200 sm:max-w-[90px]">{third?.name ?? "-"}</p>
                            <p className="text-base font-black text-amber-300">{third?.score ?? 0}</p>
                          </div>
                          <div className="relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-xl shadow-lg shadow-amber-700/50 sm:h-14 sm:w-14">🥉</div>
                            <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-xs font-black text-amber-100">3</div>
                          </div>
                          <div className="mt-2 flex h-16 w-14 items-end justify-center rounded-t-lg bg-gradient-to-t from-amber-800/80 to-amber-600/60 shadow-[0_0_30px_rgba(180,83,9,0.4)] backdrop-blur-sm sm:h-20 sm:w-16">
                            <span className="mb-1 text-xs font-bold text-amber-200">3rd</span>
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
                        <button type="button" onClick={returnToLobby} disabled={loading} className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white disabled:opacity-60">{loading ? "Loading..." : "Kembali ke Lobby"}</button>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-4 text-center">
                        <p className="text-sm font-bold text-cyan-200">Menunggu admin memulai pertandingan baru...</p>
                        <p className="mt-1 text-xs text-cyan-300/70">Tetap di room, admin akan generate soal baru</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Error message removed - now using modal */}
          </section>

          {/* Error Modal */}
          {showErrorModal && error && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 animate-in fade-in duration-200">
              <div className="w-full max-w-sm rounded-[2rem] border-2 border-rose-400/50 bg-gradient-to-br from-rose-900/95 to-red-900/95 p-8 shadow-2xl backdrop-blur-xl animate-shake">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/20 animate-pulse">
                    <span className="text-5xl">⚠️</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mb-3" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                    Oops!
                  </h2>
                  <p className="text-base text-rose-100 mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {error}
                  </p>
                  <button
                    onClick={() => {
                      setShowErrorModal(false);
                      setError("");
                    }}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                    className="w-full rounded-[1.5rem] bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-rose-500/40 transition-all hover:shadow-rose-500/60 hover:scale-105 active:scale-95"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Username Modal */}
          {showUsernameModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
              <div className="w-full max-w-md rounded-[2rem] border-2 border-purple-400/40 bg-gradient-to-br from-purple-900/95 to-indigo-900/95 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-300">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    🎮 Enter Your Name
                  </h2>
                  <p className="text-sm text-purple-200">
                    Room: <span className="font-bold text-cyan-300">{verifiedRoomCode}</span>
                  </p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); joinRoom(); }} className="space-y-4">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); if (error) setError(""); }}
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="Your Username"
                    autoFocus
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                    className="w-full rounded-[1.5rem] border-2 border-purple-400/40 bg-purple-900/40 px-5 py-3.5 text-base text-white outline-none placeholder:text-purple-300/50 focus:border-pink-400/70 focus:bg-purple-900/60 transition-all shadow-lg shadow-purple-500/20 backdrop-blur-md"
                  />

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUsernameModal(false);
                        setVerifiedRoomCode("");
                        setNickname("");
                        setError("");
                      }}
                      disabled={loading}
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                      className="flex-1 rounded-[1.5rem] border-2 border-white/30 bg-white/10 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !nickname.trim()}
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                      className="flex-1 rounded-[1.5rem] bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-pink-500/40 transition-all hover:shadow-pink-500/60 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "⏳ Joining..." : "🎉 Join!"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {!room ? (
            <footer className="pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-xs text-white/45">
              powered by: <a href="https://taratech.web.id" target="_blank" rel="noreferrer" className="text-white/60 underline decoration-white/20 underline-offset-2 transition hover:text-white">taratech</a>
            </footer>
          ) : null}

          {room && room.status !== "lobby" ? (
            <section className="rounded-[2.2rem] border border-white/10 bg-white/8 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Live Leaderboard</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Klasemen Pemain</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-black text-white/70">{room.players?.length ?? 0} pemain</div>
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
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white">{player.name}</p>
                            {room.streakBonusEnabled && (player.streak ?? 0) >= 5 && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-pink-400 via-rose-500 to-red-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-lg shadow-rose-500/30 animate-pulse">
                                🔥 Hoki Banget! (+50)
                              </span>
                            )}
                          </div>
                          <p className="text-xs uppercase tracking-[0.28em] text-white/40">{player.id === room?.hostId ? "Host" : "Player"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black ${isTop3 ? "text-white" : "text-cyan-200"}`}>{player.score}</p>
                        <p className="text-xs uppercase tracking-[0.25em] text-white/40">{room?.status === "leaderboard" || room?.status === "finished" ? (player.isCorrect ? `✅ +${player.lastEarnedPoints ?? 0}` : player.hasAnswered ? "❌ wrong" : "⏰ no answer") : player.hasAnswered ? "✓ answered" : "○ waiting"}</p>
                      </div>
                    </div>
                  );
                }) : <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/45">Belum ada pemain di room.</div>}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
