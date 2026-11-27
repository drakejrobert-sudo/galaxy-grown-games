import type { Inventory, ShopSummary } from '../shops/inventory';
import type { GuestRoutePlanner, HostRoutePlanner } from './map-types';
import type { Role, Situation } from '../game/rules';

export const stations = ['Pilot', 'Gunner', 'Bomber', 'Life Support'] as const satisfies readonly Role[];
export const encounters = ['Asteroid Field', 'Space Battle', 'Boarding Party'] as const satisfies readonly Situation[];
export const roomIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export interface RoomReport {
  text: string;
  outcome: string;
  rating: number;
  ratingLabel: string;
  points: number;
  victoryBonus: number;
}

function wholeNumber(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function reportText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length <= maximum && Boolean(value.trim())
    && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value);
}

export function readRoomReport(value: unknown): RoomReport | null {
  if (!value || typeof value !== 'object') return null;
  const { text, outcome, rating, ratingLabel, points, victoryBonus } = value as Partial<RoomReport>;
  if (!reportText(text, 2000) || !reportText(outcome, 100) || !reportText(ratingLabel, 100)
    || !wholeNumber(rating, 100) || !wholeNumber(points) || !wholeNumber(victoryBonus, points)) return null;
  return { text, outcome, rating, ratingLabel, points, victoryBonus };
}

export interface Seat {
  id: string;
  name: string;
  station: Role | null;
  startedAt: number | null;
  report: RoomReport | null;
}

export interface HostedRoom {
  id: string;
  code: string;
  expiresAt: number;
  situation: Situation | null;
  seats: Seat[];
  shopId?: string;
  planner?: HostRoutePlanner;
}

export interface JoinedRoom {
  id: string;
  expiresAt: number;
  situation: Situation | null;
  seat: Seat;
  shop?: Inventory;
  planner?: GuestRoutePlanner;
}

export interface RoomList {
  shops?: ShopSummary[];
  canHost: boolean;
  hosted: HostedRoom[];
  joined: JoinedRoom[];
}
