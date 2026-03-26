import { Server as NetServer } from "http";
import { NextRequest } from "next/server";
import { Server as SocketIOServer } from "socket.io";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = {
  id: string;
  name: string;
  score: number;
  answeredAt?: number;
  answer?: string;
};

type Question = {
  id: number;
  category: string;
  question: string;
  options: string[];
  answer: string;
};

type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: "lobby" | "question" | "leaderboard" | "finished";
  currentQuestionIndex: number;
  round: number;
  maxRounds: number;
  questionEndsAt?: number;
  timer?: NodeJS.Timeout;
};

const QUESTION_DURATION_MS = 15000;
const LEADERBOARD_PAUSE_MS = 5000;

const QUESTIONS: Question[] = [
  { id: 1, category: "Pengetahuan Umum", question: "Planet terbesar di tata surya adalah...", options: ["Mars", "Jupiter", "Saturnus", "Venus"], answer: "Jupiter" },
  { id: 2, category: "Teknologi", question: "HTML merupakan singkatan dari...", options: ["HyperText Markup Language", "HighText Machine Language", "Hyper Tool Main Language", "HomeText Markdown Language"], answer: "HyperText Markup Language" },
  { id: 3, category: "Indonesia", question: "Ibukota Jawa Barat adalah...", options: ["Bandung", "Semarang", "Surabaya", "Serang"], answer: "Bandung" },
  { id: 4, category: "Hiburan", question: "Campuran warna biru dan kuning menghasilkan warna...", options: ["Merah", "Hijau", "Ungu", "Abu-abu"], answer: "Hijau" },
  { id: 5, category: "Sains", question: "Air mendidih pada suhu berapa derajat Celcius?", options: ["90", "95", "100", "110"], answer: "100" },
];

const rooms = new Map<string, Room>();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function sanitizeRoom(room: Room) {
  const currentQuestion = QUESTIONS[room.currentQuestionIndex];
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players
      .map(({ answeredAt, answer, ...player }) => ({
        ...player,
        hasAnswered: Boolean(answer),
      }))
      .sort((a, b) => b.score - a.score),
    status: room.status,
    round: room.round,
    maxRounds: room.maxRounds,
    questionEndsAt: room.questionEndsAt ?? null,
    currentQuestion:
      room.status === "question" && currentQuestion
        ? {
            id: currentQuestion.id,
            category: currentQuestion.category,
            question: currentQuestion.question,
            options: currentQuestion.options,
          }
        : null,
  };
}

function clearRoomTimer(room: Room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }
}

function scheduleNextStep(io: SocketIOServer, room: Room) {
  clearRoomTimer(room);
  room.timer = setTimeout(() => {
    if (room.round >= room.maxRounds) {
      room.status = "finished";
      room.questionEndsAt = undefined;
      io.to(room.code).emit("room:update", sanitizeRoom(room));
      return;
    }

    room.round += 1;
    room.currentQuestionIndex = (room.currentQuestionIndex + 1) % QUESTIONS.length;
    startQuestion(io, room);
  }, LEADERBOARD_PAUSE_MS);
}

function advanceToLeaderboard(io: SocketIOServer, room: Room) {
  clearRoomTimer(room);
  const question = QUESTIONS[room.currentQuestionIndex];

  room.players.forEach((player) => {
    if (player.answer === question.answer && typeof player.answeredAt === "number" && room.questionEndsAt) {
      const responseMs = Math.max(0, QUESTION_DURATION_MS - (room.questionEndsAt - player.answeredAt));
      const speedBonus = Math.max(100, 1000 - Math.floor(responseMs / 20));
      player.score += speedBonus;
    }
  });

  room.status = room.round >= room.maxRounds ? "finished" : "leaderboard";
  room.questionEndsAt = undefined;

  io.to(room.code).emit("room:update", sanitizeRoom(room));
  io.to(room.code).emit("question:result", {
    answer: question.answer,
    players: room.players.map((player) => ({ name: player.name, score: player.score })),
  });

  if (room.status === "leaderboard") {
    scheduleNextStep(io, room);
  }
}

function startQuestion(io: SocketIOServer, room: Room) {
  clearRoomTimer(room);

  room.players = room.players.map((player) => ({ ...player, answer: undefined, answeredAt: undefined }));
  room.status = "question";
  room.questionEndsAt = Date.now() + QUESTION_DURATION_MS;
  io.to(room.code).emit("room:update", sanitizeRoom(room));

  room.timer = setTimeout(() => {
    advanceToLeaderboard(io, room);
  }, QUESTION_DURATION_MS);
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
      socket.on("room:create", ({ name }: { name: string }) => {
        const trimmed = name?.trim();
        if (!trimmed) return;

        let code = generateRoomCode();
        while (rooms.has(code)) code = generateRoomCode();

        const room: Room = {
          code,
          hostId: socket.id,
          players: [{ id: socket.id, name: trimmed, score: 0 }],
          status: "lobby",
          currentQuestionIndex: 0,
          round: 0,
          maxRounds: 5,
        };

        rooms.set(code, room);
        socket.join(code);
        socket.emit("room:joined", sanitizeRoom(room));
      });

      socket.on("room:join", ({ code, name }: { code: string; name: string }) => {
        const room = rooms.get(code?.trim().toUpperCase());
        const trimmed = name?.trim();
        if (!room || !trimmed) {
          socket.emit("room:error", "Room tidak ditemukan.");
          return;
        }

        if (room.status !== "lobby") {
          socket.emit("room:error", "Game sudah dimulai.");
          return;
        }

        const duplicateName = room.players.some((player) => player.name.toLowerCase() === trimmed.toLowerCase());
        if (duplicateName) {
          socket.emit("room:error", "Nickname sudah dipakai di room ini.");
          return;
        }

        room.players.push({ id: socket.id, name: trimmed, score: 0 });
        socket.join(room.code);
        io.to(room.code).emit("room:update", sanitizeRoom(room));
        socket.emit("room:joined", sanitizeRoom(room));
      });

      socket.on("room:start", ({ code }: { code: string }) => {
        const room = rooms.get(code);
        if (!room || room.hostId !== socket.id) return;
        if (room.players.length < 2) {
          socket.emit("room:error", "Minimal butuh 2 pemain untuk mulai game.");
          return;
        }
        room.round = 1;
        room.currentQuestionIndex = 0;
        startQuestion(io, room);
      });

      socket.on("question:answer", ({ code, answer }: { code: string; answer: string }) => {
        const room = rooms.get(code);
        if (!room || room.status !== "question") return;

        const player = room.players.find((entry) => entry.id === socket.id);
        if (!player || player.answer) return;

        player.answer = answer;
        player.answeredAt = Date.now();
        io.to(room.code).emit("room:update", sanitizeRoom(room));

        const everyoneAnswered = room.players.every((entry) => entry.answer);
        if (everyoneAnswered) {
          advanceToLeaderboard(io, room);
        }
      });

      socket.on("disconnect", () => {
        rooms.forEach((room, code) => {
          const playerIndex = room.players.findIndex((player) => player.id === socket.id);
          if (playerIndex === -1) return;

          room.players.splice(playerIndex, 1);

          if (room.players.length === 0) {
            clearRoomTimer(room);
            rooms.delete(code);
            return;
          }

          if (room.hostId === socket.id) {
            room.hostId = room.players[0].id;
          }

          io.to(room.code).emit("room:update", sanitizeRoom(room));
        });
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
