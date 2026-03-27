import { advanceRoomToLeaderboard, getRoom, goToNextQuestion, sanitizeRoom } from "@/lib/rooms";

export async function getSyncedRoom(code: string) {
  let room = await getRoom(code);

  if (!room) {
    return null;
  }

  if (room.status === "question") {
    const everyoneAnswered = room.players.length > 0 && room.players.every((player) => Boolean(player.answer));
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
