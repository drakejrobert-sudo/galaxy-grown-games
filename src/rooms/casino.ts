import { roomIdPattern } from './types';

export const casinoGames = { 'casino-coolio': 'Casino Coolio · Slot Machine' } as const;
export type CasinoGame = keyof typeof casinoGames;

export interface CasinoAssignment {
  roomId: string;
  seatId: string;
}

export interface CasinoSettlement {
  sessionId: string;
  game: CasinoGame;
  startingGold: number;
  finalGold: number;
}

export interface CasinoReport extends CasinoSettlement {
  player: string;
  roomCode: string;
  submittedAt: number;
}

export const casinoReportPath = '/casino-reports';

export function casinoAssignment(search: string): CasinoAssignment | null {
  const params = new URLSearchParams(search);
  const roomId = params.get('room') ?? '';
  const seatId = params.get('seat') ?? '';
  return roomIdPattern.test(roomId) && roomIdPattern.test(seatId) ? { roomId, seatId } : null;
}

export function casinoRoomPath({ roomId, seatId }: CasinoAssignment): string {
  return `/${roomId}/seats/${seatId}${casinoReportPath}`;
}

export function readCasinoSettlement(fields: Record<string, unknown> | null): CasinoSettlement | null {
  if (!fields) return null;
  const { sessionId, game, startingGold, finalGold } = fields;
  if (typeof sessionId !== 'string' || !roomIdPattern.test(sessionId) ||
      typeof game !== 'string' || !Object.hasOwn(casinoGames, game) ||
      typeof startingGold !== 'number' || !Number.isSafeInteger(startingGold) || startingGold < 5 ||
      typeof finalGold !== 'number' || !Number.isSafeInteger(finalGold) || finalGold < 0) return null;
  return { sessionId, game: game as CasinoGame, startingGold, finalGold };
}
