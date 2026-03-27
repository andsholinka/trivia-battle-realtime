import { Server as NetServer } from "http";
import { NextRequest } from "next/server";
import { Server as SocketIOServer } from "socket.io";
import {
  advanceRoomToLeaderboard,
  createRoom,
  goToNextQuestion,
  joinRoom,
  removePlayerBySocket,
  sanitizeRoom,
  startRoom,
  submitAnswer,
} from "@/lib/rooms";
import { LEADERBOARD_PAUSE_MS, QUESTION_DURATION_MS, QUESTIONS } from "@/lib/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TimerState = {
  questionTimeout?: NodeJS.Timeout;
  leaderboardTimeout?: NodeJS.Timeout;
};

declare global {
  // eslint-disable-next-line no-var
  var __triviaRoomTimers: Map<string, TimerState> | undefined;
}

const roomTimers = globalThis.__triviaRoomTimers ?? new Map<string, TimerState>();
globalThis.__triviaRoomTimers = roomTimers;

function clearTimers(code: string) {
  const timers = roomTimers.get(code);
  if (!timers) return;

  if (timers.questionTimeout) clearTimeout(timers.questionTimeout);
  if (timers.leaderboardTimeout) clearTimeout(timers.leaderboardTimeout);
  roomTimers.delete(code);
}

function scheduleQuestionTimeout(io: SocketIOServer, roomCode: string) {
  const timers = roomTimers.get(roomCode) ?? {};
  if (timers.questionTimeout) clearTimeout(timers.questionTimeout);

  timers.questionTimeout = setTimeout(async () => {
    const room = await advanceRoomToLeaderboard(roomCode);
    if (!room) return;

    io.to(room.code).emit("room:update", sanitizeRoom(room));
    io.to(room.code).emit("question:result", {
      answer: QUESTIONS[room.currentQuestionIndex]?.answer ?? null,
      players: room.players.map((player) => ({ name: player.name, score: player.score })),
    });

    if (room.status === "leaderboard") {
      scheduleLeaderboardTimeout(io, room.code);
    } else {
      clearTimers(room.code);
    }
  }, QUESTION_DURATION_MS);

  roomTimers.set(roomCode, timers);
}

function scheduleLeaderboardTimeout(io: SocketIOServer, roomCode: string) {
  const timers = roomTimers.get(roomCode) ?? {};
  if (timers.leaderboardTimeout) clearTimeout(timers.leaderboardTimeout);

  timers.leaderboardTimeout = setTimeout(async () => {
    const room = await goToNextQuestion(roomCode);
    if (!room) return;

    io.to(room.code).emit("room:update", sanitizeRoom(room));

    if (room.status === "question") {
      scheduleQuestionTimeout(io, room.code);
    } else {
      clearTimers(room.code);
    }
  }, LEADERBOARD_PAUSE_MS);

  roomTimers.set(roomCode, timers);
}

function attachIO(req: NextRequest) {
  const anyReq = req as NextRequest & {
    socket?: { server?: NetServer & { io?: SocketIOServer } };
  };
  const server = anyReq.socket?.server;

  if (!server) {
    return null;
  }

  if (!server.io) {
    const io = new SocketIOServer(server, {
      path: "/api/socket/io",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
      socket.on("room:create", async ({ name }: { name: string }) => {
        const trimmed = name?.trim();
        if (!trimmed) return;

        const room = await createRoom(trimmed, socket.id);
        socket.join(room.code);
        socket.emit("room:joined", sanitizeRoom(room));
      });

      socket.on("room:join", async ({ code, name }: { code: string; name: string }) => {
        const safeCode = code?.trim().toUpperCase();
        const trimmed = name?.trim();
        if (!safeCode || !trimmed) {
          socket.emit("room:error", "Room tidak ditemukan.");
          return;
        }

        const result = await joinRoom(safeCode, trimmed, socket.id);
        if ("error" in result) {
          socket.emit("room:error", result.error);
          return;
        }

        socket.join(result.room.code);
        io.to(result.room.code).emit("room:update", sanitizeRoom(result.room));
        socket.emit("room:joined", sanitizeRoom(result.room));
      });

      socket.on("room:start", async ({ code }: { code: string }) => {
        const roomCode = code?.trim().toUpperCase();
        if (!roomCode) return;

        const result = await startRoom(roomCode, socket.id);
        if ("error" in result) {
          socket.emit("room:error", result.error);
          return;
        }

        if (!result.room) return;

        io.to(result.room.code).emit("room:update", sanitizeRoom(result.room));
        scheduleQuestionTimeout(io, result.room.code);
      });

      socket.on("question:answer", async ({ code, answer }: { code: string; answer: string }) => {
        const roomCode = code?.trim().toUpperCase();
        if (!roomCode) return;

        const result = await submitAnswer(roomCode, socket.id, answer);
        if (!result.room) return;

        io.to(result.room.code).emit("room:update", sanitizeRoom(result.room));

        const everyoneAnswered = result.room.players.every((player) => player.answer);
        if (everyoneAnswered) {
          clearTimers(result.room.code);
          const advancedRoom = await advanceRoomToLeaderboard(result.room.code);
          if (!advancedRoom) return;

          io.to(advancedRoom.code).emit("room:update", sanitizeRoom(advancedRoom));
          io.to(advancedRoom.code).emit("question:result", {
            answer: QUESTIONS[advancedRoom.currentQuestionIndex]?.answer ?? null,
            players: advancedRoom.players.map((player) => ({ name: player.name, score: player.score })),
          });

          if (advancedRoom.status === "leaderboard") {
            scheduleLeaderboardTimeout(io, advancedRoom.code);
          }
        }
      });

      socket.on("disconnect", async () => {
        const updatedRoom = await removePlayerBySocket(socket.id);
        if (!updatedRoom) return;

        if ("deletedCode" in updatedRoom) {
          clearTimers(updatedRoom.deletedCode);
          return;
        }

        io.to(updatedRoom.code).emit("room:update", sanitizeRoom(updatedRoom));
      });
    });

    server.io = io;
  }

  return server.io;
}

export async function GET(req: NextRequest) {
  attachIO(req);
  return new Response("Socket server running", { status: 200 });
}
