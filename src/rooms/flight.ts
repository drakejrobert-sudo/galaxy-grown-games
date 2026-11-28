import { roomRequest } from './client';
import { readRoomReport, roomIdPattern, type JoinedRoom, type RoomReport } from './types';

export function flightSeat(params: URLSearchParams) {
  const room = params.get('room') ?? '';
  const seat = params.get('seat') ?? '';
  return roomIdPattern.test(room) && roomIdPattern.test(seat) ? { room, seat } : null;
}

export function assignedFlight(search: string) {
  const assignment = flightSeat(new URLSearchParams(search));
  if (!assignment) return null;
  const { room, seat } = assignment;
  const path = `/${room}/seats/${seat}`;
  const key = 'galaxy-grown-room-report:' + path;

  return {
    assignment: () => roomRequest<JoinedRoom>(path),
    start: (situation: JoinedRoom['situation'], station: JoinedRoom['seat']['station']) =>
      roomRequest<void>(path + '/start', 'POST', { situation, station }),
    submit: (report: RoomReport) => roomRequest<RoomReport>(path + '/report', 'POST', report),
    pending() {
      try {
        return readRoomReport(JSON.parse(sessionStorage.getItem(key) ?? 'null'));
      } catch {
        return null;
      }
    },
    savePending(report: RoomReport | null) {
      try {
        if (report) sessionStorage.setItem(key, JSON.stringify(report));
        else sessionStorage.removeItem(key);
      } catch {
        // The on-screen report can still be copied or submitted if storage is blocked.
      }
    },
  };
}
