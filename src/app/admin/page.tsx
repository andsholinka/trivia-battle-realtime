"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Icons
const Icons = {
  Lock: () => (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Dashboard: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Rooms: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  Players: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Refresh: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Logout: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Check: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  Trash: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Clock: () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Category: () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  Target: () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Question: () => (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Home: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Loading: () => (
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

interface Player {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
}

interface Room {
  code: string;
  status: "lobby" | "question" | "leaderboard" | "finished";
  hostId: string;
  playerCount: number;
  players: Player[];
  round: number;
  maxRounds: number;
  category?: string | null;
  questionsReady?: boolean;
  currentQuestionIndex: number;
  createdAt: string;
  updatedAt: string;
  questionEndsAt: number | null;
  leaderboardEndsAt: number | null;
}

interface Stats {
  totalRooms: number;
  lobbyRooms: number;
  activeGames: number;
  finishedGames: number;
  totalPlayers: number;
}

export default function AdminPage() {
  const [code, setCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);

  const verifyCode = async () => {
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("adminCode", code);
        fetchRooms();
      } else {
        setError("Invalid admin code");
      }
    } catch {
      setError("Failed to verify");
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    const storedCode = localStorage.getItem("adminCode") || code;
    
    try {
      const res = await fetch("/api/admin/rooms", {
        headers: { "x-admin-code": storedCode },
      });
      
      const data = await res.json();
      
      if (data.success) {
        setRooms(data.rooms);
        setStats(data.stats);
      } else {
        setError("Failed to load rooms");
      }
    } catch {
      setError("Failed to load rooms");
    }
  };

  const deleteSelectedRooms = async () => {
    if (selectedRooms.size === 0) return;
    
    const confirmed = confirm(`Delete ${selectedRooms.size} room(s)?`);
    if (!confirmed) return;
    
    setDeleteLoading(true);
    const storedCode = localStorage.getItem("adminCode") || code;
    
    try {
      const res = await fetch("/api/admin/rooms/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-code": storedCode,
        },
        body: JSON.stringify({ roomCodes: Array.from(selectedRooms) }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSelectedRooms(new Set());
        fetchRooms();
      } else {
        setError(data.error || "Failed to delete rooms");
      }
    } catch {
      setError("Failed to delete rooms");
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleRoomSelection = (roomCode: string) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomCode)) {
      newSelected.delete(roomCode);
    } else {
      newSelected.add(roomCode);
    }
    setSelectedRooms(newSelected);
  };

  const selectAll = () => {
    if (selectedRooms.size === rooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(rooms.map((r) => r.code)));
    }
  };

  const logout = () => {
    localStorage.removeItem("adminCode");
    setIsAuthenticated(false);
    setCode("");
    setRooms([]);
    setStats(null);
    setSelectedRooms(new Set());
  };

  useEffect(() => {
    const storedCode = localStorage.getItem("adminCode");
    if (storedCode) {
      setCode(storedCode);
      setIsAuthenticated(true);
      fetchRooms();
    }
  }, []);

  const getStatusConfig = (status: string) => {
    const configs = {
      lobby: {
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        dot: "bg-amber-400",
        text: "text-amber-400",
        label: "LOBBY",
      },
      question: {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        dot: "bg-emerald-400",
        text: "text-emerald-400",
        label: "IN GAME",
        pulse: true,
      },
      leaderboard: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        dot: "bg-blue-400",
        text: "text-blue-400",
        label: "LEADERBOARD",
      },
      finished: {
        bg: "bg-slate-500/10",
        border: "border-slate-500/20",
        dot: "bg-slate-400",
        text: "text-slate-400",
        label: "FINISHED",
      },
    };
    return configs[status as keyof typeof configs] || configs.finished;
  };

  const StatusBadge = ({ status }: { status: Room["status"] }) => {
    const cfg = getStatusConfig(status);
    return (
      <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${cfg.bg} ${cfg.border} border shrink-0`}>
        <span className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full ${cfg.dot} ${(cfg as any).pulse ? "animate-pulse" : ""}`} />
        <span className={`text-[9px] sm:text-[10px] font-bold tracking-wider ${cfg.text}`}>{cfg.label}</span>
      </div>
    );
  };

  const StatCard = ({ label, value, subtext, color, icon }: { label: string; value: number; subtext?: string; color: "cyan" | "emerald" | "amber" | "rose" | "violet"; icon: React.ReactNode }) => {
    const colorStyles = {
      cyan: { text: "text-cyan-400", border: "border-cyan-500/30", from: "from-cyan-500/20", to: "to-blue-500/20", iconBg: "bg-cyan-500/20" },
      emerald: { text: "text-emerald-400", border: "border-emerald-500/30", from: "from-emerald-500/20", to: "to-teal-500/20", iconBg: "bg-emerald-500/20" },
      amber: { text: "text-amber-400", border: "border-amber-500/30", from: "from-amber-500/20", to: "to-orange-500/20", iconBg: "bg-amber-500/20" },
      rose: { text: "text-rose-400", border: "border-rose-500/30", from: "from-rose-500/20", to: "to-pink-500/20", iconBg: "bg-rose-500/20" },
      violet: { text: "text-violet-400", border: "border-violet-500/30", from: "from-violet-500/20", to: "to-purple-500/20", iconBg: "bg-violet-500/20" },
    };
    const style = colorStyles[color];
    return (
      <div className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border ${style.border} bg-gradient-to-br ${style.from} ${style.to} p-3 sm:p-5 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-2xl`}>
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 transition-transform group-hover:scale-150" />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/50 truncate">{label}</p>
            <p className={`mt-1 sm:mt-2 text-2xl sm:text-4xl font-black ${style.text}`}>{value}</p>
            {subtext && <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/40">{subtext}</p>}
          </div>
          <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${style.iconBg}`}>
            {icon}
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <div className="rounded-[2.2rem] border border-white/10 bg-white/8 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-400">
                <span className="text-2xl">🔒</span>
              </div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                <Icons.Lock />
              </div>
              <h1 className="text-2xl font-black text-white">Admin Access</h1>
              <p className="text-sm text-slate-400">Enter admin code to continue</p>
            </div>
            
            <div className="space-y-4">
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                placeholder="Admin code"
                className="w-full rounded-2xl border border-slate-700/50 bg-slate-800/50 px-5 py-4 text-center text-lg font-mono tracking-[0.2em] text-white outline-none placeholder:text-slate-600 focus:border-indigo-500/50 focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20"
              />
              
              <button
                onClick={verifyCode}
                disabled={loading || code.length === 0}
                className="group w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98] disabled:opacity-50"
              >
                <span className="flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Icons.Loading />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Icons.Lock />
                      Enter Dashboard
                    </>
                  )}
                </span>
              </button>
            </div>
            
            {error && (
              <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-center text-sm text-rose-100">
                {error}
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0f1c] text-slate-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0a0f1c]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Icons.Dashboard />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-bold text-white">Admin Console</h1>
              <p className="hidden sm:block text-[10px] text-slate-500">Trivia Battle Realtime</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={fetchRooms}
              className="group flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-slate-700/50 bg-slate-800/50 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              aria-label="Refresh"
            >
              <span className="transition-transform group-hover:rotate-180"><Icons.Refresh /></span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300"
              aria-label="Logout"
            >
              <Icons.Logout />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8 lg:px-8">
        {/* Stats Grid */}
        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Total Rooms"
              value={stats.totalRooms}
              subtext="Active game sessions"
              color="cyan"
              icon={<svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            />
            <StatCard
              label="In Lobby"
              value={stats.lobbyRooms}
              subtext="Waiting for players"
              color="amber"
              icon={<svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
            />
            <StatCard
              label="Active Games"
              value={stats.activeGames}
              subtext="Currently playing"
              color="emerald"
              icon={<svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
            <StatCard
              label="Finished"
              value={stats.finishedGames}
              subtext="Completed sessions"
              color="rose"
              icon={<svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Total Players"
              value={stats.totalPlayers}
              subtext="Across all rooms"
              color="violet"
              icon={<svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            />
          </div>
        )}

        {/* Rooms Section */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-800/60 bg-slate-900/50">
          {/* Rooms Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-bold text-white">Game Rooms</h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                {rooms.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              >
                {selectedRooms.size === rooms.length && rooms.length > 0 ? "Deselect" : "Select All"}
              </button>
              {selectedRooms.size > 0 && (
                <button
                  onClick={deleteSelectedRooms}
                  disabled={deleteLoading}
                  className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-rose-400 transition-all hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <Icons.Trash />
                  <span className="hidden sm:inline">{deleteLoading ? "Deleting..." : "Delete "}</span>
                  <span className="sm:hidden">{deleteLoading ? "..." : ""}</span>
                  ({selectedRooms.size})
                </button>
              )}
            </div>
          </div>

          {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 sm:py-20 text-center px-4">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-800/30 p-5 sm:p-6">
              <Icons.Rooms />
            </div>
            <div>
              <p className="text-base sm:text-lg font-semibold text-slate-300">No active rooms</p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">Rooms will appear here when created</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 p-3 sm:p-5 lg:grid-cols-2">
            {rooms.map((room, idx) => (
              <motion.div
                key={room.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border p-3 sm:p-5 transition-all hover:shadow-xl ${
                  selectedRooms.has(room.code)
                    ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                    : "border-slate-800/60 bg-slate-800/40 hover:border-slate-700/60 hover:bg-slate-800/60"
                }`}
              >
                {/* Hover gradient effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative">
                  {/* Header: Code, Status, Players count */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedRooms.has(room.code)}
                        onChange={() => toggleRoomSelection(room.code)}
                        className="mt-0.5 sm:mt-1 h-3.5 w-3.5 sm:h-4 sm:w-4 cursor-pointer rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/20 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                          <span className="text-base sm:text-lg font-mono font-bold text-white tracking-wider">
                            {room.code}
                          </span>
                          <StatusBadge status={room.status} />
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs text-slate-500">
                          <Icons.Clock />
                          <span className="truncate">
                            {new Date(room.createdAt).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl sm:text-3xl font-black text-slate-200">{room.playerCount}</p>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Players</p>
                    </div>
                  </div>

                  {/* Tags row */}
                  <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {room.category && (
                      <span className="flex items-center gap-1 rounded-md sm:rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-indigo-300">
                        <Icons.Category />
                        <span className="truncate max-w-[80px] sm:max-w-none">{room.category}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 rounded-md sm:rounded-lg border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-slate-400">
                      <Icons.Target />
                      Round {room.round}/{room.maxRounds}
                    </span>
                    <span className="flex items-center gap-1 rounded-md sm:rounded-lg border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-slate-400">
                      <Icons.Question />
                      Q{room.currentQuestionIndex + 1}
                    </span>
                    {room.questionsReady && (
                      <span className="flex items-center gap-1 rounded-md sm:rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-emerald-400">
                        <Icons.Check />
                        Ready
                      </span>
                    )}
                  </div>

                  {/* Players list */}
                  {room.players.length > 0 && (
                    <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-slate-700/30 bg-slate-900/50 p-2 sm:p-3">
                      <p className="mb-1.5 sm:mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Players</p>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {room.players.map((player) => (
                          <span
                            key={player.id}
                            className={`inline-flex items-center gap-1 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium ${
                              player.hasAnswered
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border border-slate-600/30 bg-slate-700/30 text-slate-400"
                            }`}
                          >
                            <span className={player.hasAnswered ? "text-emerald-400" : "text-slate-500"}>●</span>
                            <span className="truncate max-w-[60px] sm:max-w-[100px]">{player.name}</span>
                            <span className="text-slate-500">({player.score})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </div>
      </section>
    </main>
  );
}
