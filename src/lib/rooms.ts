import { randomUUID } from "crypto";
import getMongoClientPromise from "@/lib/mongodb";
import { QUESTIONS } from "@/lib/questions";

export type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
  answer?: string;
  answeredAt?: number;
  socketId?: string;
};

export type RoomStatus = "lobby" | "question" | "leaderboard" | "finished";

export type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  round: number;
  maxRounds: number;
  questionEndsAt: number | null;
  currentQuestionIndex: number;
  createdAt: Date;
  updatedAt: Date;
};

const DB_NAME = process.env.MONGODB_DB_NAME || "trivia_battle_realtime";
const COLLECTION_NAME = "rooms";

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getCollection() {
  const client = await getMongoClientPromise();
  const db = client.db(DB_NAME);
  const collection = db.collection<Room>(COLLECTION_NAME);

  await collection.createIndex({ code: 1 }, { unique: true });
  await collection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

  return collection;
}

export function sanitizeRoom(room: Room) {
  const currentQuestion = QUESTIONS[room.currentQuestionIndex];

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players
      .map(({ answer, answeredAt, socketId, ...player }) => ({
        ...player,
        hasAnswered: Boolean(answer),
      }))
      .sort((a, b) => b.score - a.score),
    status: room.status,
    round: room.round,
    maxRounds: room.maxRounds,
    questionEndsAt: room.questionEndsAt,
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

export async function createRoom(name: string, socketId?: string) {
  const collection = await getCollection();

  let code = generateRoomCode();
  while (await collection.findOne({ code })) {
    code = generateRoomCode();
  }

  const hostId = randomUUID();
  const now = new Date();

  const room: Room = {
    code,
    hostId,
    players: [{ id: hostId, name, score: 0, hasAnswered: false, socketId }],
    status: "lobby",
    round: 0,
    maxRounds: 5,
    questionEndsAt: null,
    currentQuestionIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(room);
  return room;
}

export async function getRoom(code: string) {
  const collection = await getCollection();
  return collection.findOne({ code });
}

export async function joinRoom(code: string, name: string, socketId?: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.status !== "lobby") {
    return { error: "Game sudah dimulai.", status: 400 as const };
  }

  const duplicateName = room.players.some((player) => player.name.toLowerCase() === name.toLowerCase());
  if (duplicateName) {
    return { error: "Nickname sudah dipakai di room ini.", status: 400 as const };
  }

  const nextPlayer: Player = {
    id: randomUUID(),
    name,
    score: 0,
    hasAnswered: false,
    socketId,
  };

  const result = await collection.findOneAndUpdate(
    {
      code,
      status: "lobby",
      "players.name": { $not: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
    },
    {
      $push: { players: nextPlayer },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    const freshRoom = await collection.findOne({ code });
    if (!freshRoom) {
      return { error: "Room tidak ditemukan.", status: 404 as const };
    }
    if (freshRoom.status !== "lobby") {
      return { error: "Game sudah dimulai.", status: 400 as const };
    }
    return { error: "Nickname sudah dipakai di room ini.", status: 400 as const };
  }

  return { room: result };
}

export async function startRoom(code: string, hostSocketId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  const hostPlayer = room.players.find((player) => player.id === room.hostId);
  if (!hostPlayer || hostPlayer.socketId !== hostSocketId) {
    return { error: "Hanya host yang bisa memulai game.", status: 403 as const };
  }

  if (room.players.length < 2) {
    return { error: "Minimal butuh 2 pemain untuk mulai game.", status: 400 as const };
  }

  const players = room.players.map((player) => ({ ...player, answer: undefined, answeredAt: undefined, hasAnswered: false }));
  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: "question",
        round: 1,
        currentQuestionIndex: 0,
        questionEndsAt: Date.now() + 15000,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
}

export async function submitAnswer(code: string, socketId: string, answer: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room || room.status !== "question") {
    return { room: null };
  }

  const playerIndex = room.players.findIndex((player) => player.socketId === socketId);
  if (playerIndex === -1) {
    return { room };
  }

  const player = room.players[playerIndex];
  if (player.answer) {
    return { room };
  }

  room.players[playerIndex] = {
    ...player,
    answer,
    answeredAt: Date.now(),
    hasAnswered: true,
  };

  room.updatedAt = new Date();

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    { $set: { players: room.players, updatedAt: room.updatedAt } },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
}

export async function advanceRoomToLeaderboard(code: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room || room.status !== "question") {
    return null;
  }

  const question = QUESTIONS[room.currentQuestionIndex];
  const players = room.players.map((player) => {
    if (player.answer === question.answer && typeof player.answeredAt === "number" && room.questionEndsAt) {
      const responseMs = Math.max(0, 15000 - (room.questionEndsAt - player.answeredAt));
      const speedBonus = Math.max(100, 1000 - Math.floor(responseMs / 20));
      return {
        ...player,
        score: player.score + speedBonus,
      };
    }

    return player;
  });

  const nextStatus = room.round >= room.maxRounds ? "finished" : "leaderboard";
  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: nextStatus,
        questionEndsAt: null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return updatedRoom;
}

export async function goToNextQuestion(code: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room || room.status !== "leaderboard") {
    return null;
  }

  if (room.round >= room.maxRounds) {
    const finishedRoom = await collection.findOneAndUpdate(
      { code },
      { $set: { status: "finished", questionEndsAt: null, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return finishedRoom;
  }

  const players = room.players.map((player) => ({
    ...player,
    answer: undefined,
    answeredAt: undefined,
    hasAnswered: false,
  }));

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: "question",
        round: room.round + 1,
        currentQuestionIndex: (room.currentQuestionIndex + 1) % QUESTIONS.length,
        questionEndsAt: Date.now() + 15000,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return updatedRoom;
}

export async function removePlayerBySocket(socketId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ "players.socketId": socketId });

  if (!room) {
    return null;
  }

  const players = room.players.filter((player) => player.socketId !== socketId);

  if (players.length === 0) {
    await collection.deleteOne({ code: room.code });
    return { deletedCode: room.code };
  }

  const nextHostId = room.hostId === room.players.find((player) => player.socketId === socketId)?.id ? players[0].id : room.hostId;

  const updatedRoom = await collection.findOneAndUpdate(
    { code: room.code },
    {
      $set: {
        players,
        hostId: nextHostId,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return updatedRoom;
}
