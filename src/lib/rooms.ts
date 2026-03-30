import { randomUUID } from "crypto";
import type { WithId } from "mongodb";
import getMongoClientPromise from "@/lib/mongodb";
import { generateTriviaQuestions } from "@/lib/gemini";
import { LEADERBOARD_PAUSE_MS, QUESTION_DURATION_MS, Question } from "@/lib/questions";

export type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
  answer?: string;
  answeredAt?: number;
  socketId?: string;
  lastEarnedPoints?: number;
  streak?: number;
  maxStreak?: number;
};

export type RoomStatus = "lobby" | "countdown" | "question" | "leaderboard" | "finished";

export type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  round: number;
  maxRounds: number;
  questionCount?: number;
  category?: string | null;
  questions: Question[];
  questionsReady?: boolean;
  countdownEndsAt?: number | null;
  questionEndsAt: number | null;
  currentQuestionIndex: number;
  lastCorrectAnswer?: string | null;
  leaderboardEndsAt?: number | null;
  finalResultsEndsAt?: number | null;
  streakBonusEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const DB_NAME = process.env.MONGODB_DB_NAME || "trivia_battle_realtime";
const COLLECTION_NAME = "rooms";
const FINAL_RESULTS_DURATION_MS = 10000;

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
  const currentQuestion = room.questions[room.currentQuestionIndex];
  // Gunakan player.hasAnswered jika sudah diset, fallback ke Boolean(player.answer)
  const everyoneAnswered = room.status === "question" && room.players.length > 0 && room.players.every((player) => player.hasAnswered || Boolean(player.answer));

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players
      .map(({ answeredAt, socketId, ...player }) => ({
        ...player,
        hasAnswered: player.hasAnswered || Boolean(player.answer),
        isCorrect: room.status !== "lobby" && player.answer ? player.answer === (currentQuestion?.answer ?? room.lastCorrectAnswer) : false,
        lastEarnedPoints: player.lastEarnedPoints ?? 0,
      }))
      .sort((a, b) => b.score - a.score),
    status: room.status,
    round: room.round,
    maxRounds: room.maxRounds,
    questionCount: room.questionCount ?? room.maxRounds,
    category: room.category ?? null,
    questionsReady: Boolean(room.questionsReady),
    questionEndsAt: room.questionEndsAt,
    countdownEndsAt: room.countdownEndsAt ?? null,
    leaderboardEndsAt: room.leaderboardEndsAt ?? null,
    finalResultsEndsAt: room.finalResultsEndsAt ?? null,
    lastCorrectAnswer: room.lastCorrectAnswer ?? null,
    everyoneAnswered,
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
    players: [{ id: hostId, name, score: 0, hasAnswered: false, socketId, lastEarnedPoints: 0, streak: 0, maxStreak: 0 }],
    status: "lobby",
    round: 0,
    maxRounds: 5,
    questionCount: 5,
    category: null,
    questions: [],
    questionsReady: false,
    questionEndsAt: null,
    currentQuestionIndex: 0,
    lastCorrectAnswer: null,
    leaderboardEndsAt: null,
    finalResultsEndsAt: null,
    streakBonusEnabled: false,
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

export async function toggleStreakBonus(code: string, hostId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa mengubah pengaturan.", status: 403 as const };
  }

  if (room.status !== "lobby") {
    return { error: "Hanya bisa mengubah pengaturan di lobby.", status: 400 as const };
  }

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        streakBonusEnabled: !room.streakBonusEnabled,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom, streakBonusEnabled: !room.streakBonusEnabled };
}

export async function advanceRoomToQuestion(code: string): Promise<WithId<Room> | null> {
  const collection = await getCollection();
  const now = Date.now();

  const updatedRoom = await collection.findOneAndUpdate(
    { code, status: "countdown" },
    {
      $set: {
        status: "question",
        questionEndsAt: now + QUESTION_DURATION_MS,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return updatedRoom;
}

export async function joinRoom(code: string, name: string, socketId?: string, playerId?: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.status !== "lobby") {
    return { error: "Game sudah dimulai.", status: 400 as const };
  }

  // Check for reconnect with existing playerId
  if (playerId) {
    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      // Reconnect - update socketId and return room
      const result = await collection.findOneAndUpdate(
        { code, "players.id": playerId },
        {
          $set: {
            "players.$.socketId": socketId,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );
      if (result) {
        return { room: result };
      }
    }
  }

  const duplicateName = room.players.some((player) => player.name.toLowerCase() === name.toLowerCase());
  if (duplicateName) {
    return { error: "Nickname sudah dipakai di room ini.", status: 400 as const };
  }

  const nextPlayer: Player = {
    id: playerId || randomUUID(),
    name,
    score: 0,
    hasAnswered: false,
    socketId,
    lastEarnedPoints: 0,
    streak: 0,
    maxStreak: 0,
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

export async function generateQuestionsForRoom(code: string, hostId: string, category: string, questionCount: number) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa generate pertanyaan.", status: 403 as const };
  }

  if (!category.trim()) {
    return { error: "Kategori wajib diisi.", status: 400 as const };
  }

  const safeQuestionCount = Number.isFinite(questionCount) ? Math.min(20, Math.max(3, Math.floor(questionCount))) : 5;
  const questions = await generateTriviaQuestions(category.trim(), safeQuestionCount);
  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        category: category.trim(),
        questions,
        maxRounds: questions.length,
        questionCount: questions.length,
        questionsReady: true,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
}

export async function startRoomByHostId(code: string, hostId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa memulai game.", status: 403 as const };
  }

  if (!room.questionsReady || room.questions.length === 0) {
    return { error: "Generate pertanyaan dulu sebelum start game.", status: 400 as const };
  }

  if (room.players.length < 2) {
    return { error: "Minimal butuh 2 pemain untuk mulai game.", status: 400 as const };
  }

  const players = room.players.map((player) => ({ ...player, score: 0, answer: undefined, answeredAt: undefined, hasAnswered: false, lastEarnedPoints: 0 }));
  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: "countdown",
        round: 1,
        currentQuestionIndex: 0,
        countdownEndsAt: Date.now() + 3500, // 3.5 detik untuk countdown 3-2-1
        questionEndsAt: null,
        lastCorrectAnswer: null,
        leaderboardEndsAt: null,
        finalResultsEndsAt: null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
}

async function submitPreparedAnswer(code: string, playerId: string, answer: string) {
  const collection = await getCollection();
  const now = Date.now();

  // Atomic update dengan arrayFilters berdasarkan player.id (bukan index!)
  // Ini fix race condition saat ada player join/leave yang mengubah urutan array
  const updatedRoom = await collection.findOneAndUpdate(
    { 
      code, 
      status: "question",
      "players.id": playerId  // Pastikan player exists
    },
    { 
      $set: { 
        "players.$[p].answer": answer,
        "players.$[p].answeredAt": now,
        "players.$[p].hasAnswered": true,
        updatedAt: new Date()
      } 
    },
    { 
      returnDocument: "after",
      arrayFilters: [
        { 
          "p.id": playerId,
          $or: [
            { "p.answer": { $exists: false } },
            { "p.answer": null },
            { "p.answer": "" }
          ]  // Hanya update jika belum ada jawaban (field tidak ada, null, atau empty string)
        }
      ]
    }
  );

  // Jika atomic update gagal (player tidak ditemukan, sudah ada jawaban, atau status berubah)
  if (!updatedRoom) {
    // Cek apakah player sudah menjawab atau room berubah status
    const currentRoom = await collection.findOne({ code });
    if (!currentRoom) {
      return { error: "Room tidak ditemukan.", status: 404 as const };
    }
    if (currentRoom.status !== "question") {
      return { error: "Pertanyaan sudah berakhir.", status: 400 as const };
    }
    const player = currentRoom.players.find((p: Player) => p.id === playerId);
    if (!player) {
      return { error: "Pemain tidak ditemukan.", status: 404 as const };
    }
    if (player.answer || player.hasAnswered) {
      // Sudah menjawab sebelumnya, return room tanpa error
      return { room: currentRoom };
    }
    // Kasus lain, return room terkini
    return { room: currentRoom };
  }

  return { room: updatedRoom };
}

export async function submitAnswerByPlayerId(code: string, playerId: string, answer: string) {
  return submitPreparedAnswer(code, playerId, answer);
}

function calculateStreakBonus(streak: number): number {
  if (streak >= 10) return 25;
  if (streak >= 7) return 15;
  if (streak >= 5) return 10;
  if (streak >= 3) return 5;
  return 0;
}

export async function advanceRoomToLeaderboard(code: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room || room.status !== "question") {
    return null;
  }

  const question = room.questions[room.currentQuestionIndex];
  if (!question) {
    return null;
  }

  const streakBonusEnabled = room.streakBonusEnabled ?? false;

  const players = room.players.map((player) => {
    const isCorrect = player.answer === question.answer && typeof player.answeredAt === "number" && room.questionEndsAt;

    if (isCorrect) {
      const responseMs = Math.max(0, QUESTION_DURATION_MS - (room.questionEndsAt - player.answeredAt));
      const speedBonus = Math.max(100, 1000 - Math.floor(responseMs / 20));

      // Calculate streak bonus if enabled
      let streakBonus = 0;
      let newStreak = player.streak ?? 0;
      let newMaxStreak = player.maxStreak ?? 0;

      if (streakBonusEnabled) {
        newStreak = (player.streak ?? 0) + 1;
        newMaxStreak = Math.max(newMaxStreak, newStreak);
        streakBonus = calculateStreakBonus(newStreak);
      }

      const totalPoints = speedBonus + streakBonus;

      return {
        ...player,
        score: player.score + totalPoints,
        lastEarnedPoints: totalPoints,
        streak: newStreak,
        maxStreak: newMaxStreak,
      };
    }

    // Wrong answer: reset streak to 0
    return {
      ...player,
      lastEarnedPoints: 0,
      streak: streakBonusEnabled ? 0 : (player.streak ?? 0),
    };
  });

  const isFinalRound = room.round >= room.maxRounds;
  const nextStatus = isFinalRound ? "finished" : "leaderboard";
  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: nextStatus,
        questionEndsAt: null,
        lastCorrectAnswer: question.answer,
        leaderboardEndsAt: isFinalRound ? Date.now() + FINAL_RESULTS_DURATION_MS : Date.now() + LEADERBOARD_PAUSE_MS,
        finalResultsEndsAt: isFinalRound ? Date.now() + FINAL_RESULTS_DURATION_MS : null,
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

  const players = room.players.map((player) => ({
    ...player,
    answer: undefined,
    answeredAt: undefined,
    hasAnswered: false,
    lastEarnedPoints: 0,
  }));

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: "question",
        round: room.round + 1,
        currentQuestionIndex: room.currentQuestionIndex + 1,
        questionEndsAt: Date.now() + QUESTION_DURATION_MS,
        leaderboardEndsAt: null,
        lastCorrectAnswer: null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return updatedRoom;
}

export async function restartRoomWithCategory(code: string, hostId: string, category: string, questionCount: number) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa restart game.", status: 403 as const };
  }

  if (!category.trim()) {
    return { error: "Kategori wajib diisi.", status: 400 as const };
  }

  const safeQuestionCount = Number.isFinite(questionCount) ? Math.min(20, Math.max(3, Math.floor(questionCount))) : 5;
  const questions = await generateTriviaQuestions(category.trim(), safeQuestionCount);
  const players = room.players.map((player) => ({
    ...player,
    score: 0,
    answer: undefined,
    answeredAt: undefined,
    hasAnswered: false,
    lastEarnedPoints: 0,
    streak: 0,
    maxStreak: 0,
  }));

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        category: category.trim(),
        questions,
        questionsReady: true,
        maxRounds: questions.length,
        questionCount: questions.length,
        status: "lobby",
        round: 0,
        currentQuestionIndex: 0,
        questionEndsAt: null,
        leaderboardEndsAt: null,
        finalResultsEndsAt: null,
        lastCorrectAnswer: null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
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

  const leavingPlayer = room.players.find((player) => player.socketId === socketId);
  const nextHostId = room.hostId === leavingPlayer?.id ? players[0].id : room.hostId;

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

export async function kickPlayerById(code: string, playerId: string, hostId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa kick pemain.", status: 403 as const };
  }

  const playerToKick = room.players.find((p) => p.id === playerId);
  if (!playerToKick) {
    return { error: "Pemain tidak ditemukan.", status: 404 as const };
  }

  if (playerId === hostId) {
    return { error: "Host tidak bisa kick diri sendiri.", status: 400 as const };
  }

  const players = room.players.filter((p) => p.id !== playerId);

  // Jika tidak ada pemain lagi, hapus room
  if (players.length === 0) {
    await collection.deleteOne({ code });
    return { deletedCode: code, playerName: playerToKick.name };
  }

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom, playerName: playerToKick.name };
}

export async function returnRoomToLobby(code: string, hostId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa kembali ke lobby.", status: 403 as const };
  }

  // Reset scores and game state, keep players and category
  const players = room.players.map((player: Player) => ({
    ...player,
    score: 0,
    answer: undefined,
    answeredAt: undefined,
    hasAnswered: false,
    lastEarnedPoints: 0,
    streak: 0,
    maxStreak: 0,
  }));

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        players,
        status: "lobby",
        round: 0,
        currentQuestionIndex: 0,
        questionEndsAt: null,
        leaderboardEndsAt: null,
        finalResultsEndsAt: null,
        lastCorrectAnswer: null,
        questionsReady: false, // Require admin to generate new questions
        questions: [],
        category: null,
        maxRounds: 0,
        questionCount: 0,
        streakBonusEnabled: false, // Reset streak bonus setting
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
}

export async function resetQuestions(code: string, hostId: string) {
  const collection = await getCollection();
  const room = await collection.findOne({ code });

  if (!room) {
    return { error: "Room tidak ditemukan.", status: 404 as const };
  }

  if (room.hostId !== hostId) {
    return { error: "Hanya host yang bisa reset pertanyaan.", status: 403 as const };
  }

  const updatedRoom = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        category: null,
        questions: [],
        questionsReady: false,
        maxRounds: 0,
        questionCount: 0,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return { room: updatedRoom };
}
