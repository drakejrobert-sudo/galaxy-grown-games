import type { Role } from '../game/rules';

export const stations = ['Pilot', 'Gunner', 'Bomber', 'Life Support'] as const satisfies readonly Role[];

export interface Seat {
  id: string;
  name: string;
  station: Role | null;
}

export interface HostedRoom {
  id: string;
  code: string;
  expiresAt: number;
  seats: Seat[];
}

export interface JoinedRoom {
  id: string;
  expiresAt: number;
  seat: Seat;
}

export interface RoomList {
  canHost: boolean;
  hosted: HostedRoom[];
  joined: JoinedRoom[];
}
