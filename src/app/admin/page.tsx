"use client";

import { useState, useEffect } from "react";

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "lobby":
        return "bg-slate-400";
      case "question":
        return "bg-emerald-400";
      case "leaderboard":
        return "bg-amber-400";
      case "finished":
        return "bg-rose-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "lobby":
        return "Lobby";
      case "question":
        return "Playing";
      case "leaderboard":
        return "Leaderboard";
      case "finished":
        return "Finished";
      default:
        return status;
    }
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
              <h1 className="text-2xl font-black">Admin Access</h1>
              <p className="mt-2 text-sm text-white/60">Enter admin code to continue</p>
            </div>
            
            <div className="space-y-4">
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                placeholder="Admin code"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-center text-lg tracking-widest text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              />
              
              <button
                onClick={verifyCode}
                disabled={loading || code.length === 0}
                className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Enter"}
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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black">📊 Admin Dashboard</h1>
            <p className="mt-1 text-sm text-white/60">Trivia Battle Realtime Analytics</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchRooms}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
            >
              🔄 Refresh
            </button>
            <button
              onClick={logout}
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-rose-400/20"
            >
              🚪 Logout
            </button>
          </div>
        </header>

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-wider text-white/50">Total Rooms</p>
              <p className="mt-1 text-3xl font-black">{stats.totalRooms}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-wider text-emerald-300/70">In Lobby</p>
              <p className="mt-1 text-3xl font-black text-emerald-300">{stats.lobbyRooms}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-wider text-amber-300/70">Active Games</p>
              <p className="mt-1 text-3xl font-black text-amber-300">{stats.activeGames}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-wider text-rose-300/70">Finished</p>
              <p className="mt-1 text-3xl font-black text-rose-300">{stats.finishedGames}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-wider text-cyan-300/70">Total Players</p>
              <p className="mt-1 text-3xl font-black text-cyan-300">{stats.totalPlayers}</p>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black">Rooms</h2>
          <div className="flex gap-3">
            <button
              onClick={selectAll}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
            >
              {selectedRooms.size === rooms.length && rooms.length > 0 ? "Deselect All" : "Select All"}
            </button>
            {selectedRooms.size > 0 && (
              <button
                onClick={deleteSelectedRooms}
                disabled={deleteLoading}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : `Delete (${selectedRooms.size})`}
              </button>
            )}
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/8 p-12 text-center text-white/60">
            No rooms found
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rooms.map((room) => (
              <div
                key={room.code}
                className={`rounded-2xl border p-5 backdrop-blur-xl transition-all ${
                  selectedRooms.has(room.code)
                    ? "border-cyan-400/50 bg-cyan-400/10"
                    : "border-white/10 bg-white/8"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedRooms.has(room.code)}
                      onChange={() => toggleRoomSelection(room.code)}
                      className="h-5 w-5 cursor-pointer accent-cyan-400"
                    />
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black">🏠 {room.code}</span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${getStatusColor(room.status)} text-black`}
                        >
                          {getStatusLabel(room.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/50">
                        Created: {new Date(room.createdAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{room.playerCount}</p>
                    <p className="text-xs text-white/50">players</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {room.category && (
                    <span className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs">
                      📁 {room.category}
                    </span>
                  )}
                  <span className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs">
                    🎯 Round {room.round}/{room.maxRounds}
                  </span>
                  <span className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs">
                    ❓ Q{room.currentQuestionIndex + 1}
                  </span>
                  {room.questionsReady && (
                    <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/20 px-2 py-1 text-xs text-emerald-300">
                      ✓ Questions Ready
                    </span>
                  )}
                </div>

                {room.players.length > 0 && (
                  <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">Players</p>
                    <div className="flex flex-wrap gap-2">
                      {room.players.map((player) => (
                        <span
                          key={player.id}
                          className={`rounded-lg px-2 py-1 text-xs ${
                            player.hasAnswered
                              ? "bg-emerald-400/20 text-emerald-300"
                              : "bg-white/10 text-white/70"
                          }`}
                        >
                          {player.name} ({player.score} pts)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
