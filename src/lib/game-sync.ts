import { advanceRoomToLeaderboard, advanceRoomToQuestion, getRoom, goToNextQuestion, sanitizeRoom } from "@/lib/rooms";

export async function getSyncedRoom(code: string) {
  let room = await getRoom(code);

  if (!room) {
    return null;
  }

  // Handle countdown -> question transition
  if (room.status === "countdown") {
    const countdownDone = typeof room.countdownEndsAt === "number" && room.countdownEndsAt <= Date.now();
    if (countdownDone) {
      room = await advanceRoomToQuestion(code);
      if (!room) {
        return null;
      }
    }
  }

  if (room.status === "question") {
    // Gunakan hasAnswered, bukan answer (karena answer di-clear di sanitizeRoom)
    const everyoneAnswered = room.players.length > 0 && room.players.every((player) => player.hasAnswered);
    const timeUp = typeof room.questionEndsAt === "number" && room.questionEndsAt <= Date.now();

    if (everyoneAnswered || timeUp) {
      room = await advanceRoomToLeaderboard(code);
      if (!room) {
        return null;
      }
    }
  }

  if (room.status === "leaderboard") {
    const leaderboardDone = typeof room.leaderboardEndsAt === "number" && room.leaderboardEndsAt <= Date.now();

    if (leaderboardDone) {
      room = await goToNextQuestion(code);
      if (!room) {
        return null;
      }
    }
  }

  return sanitizeRoom(room);
}
