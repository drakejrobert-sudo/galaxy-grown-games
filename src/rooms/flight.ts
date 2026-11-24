import { roomRequest } from './client';
import { readRoomReport, roomIdPattern, type JoinedRoom, type RoomReport } from './types';

export function assignedFlight(search: string) {
  const params = new URLSearchParams(search);
  const room = params.get('room') ?? '';
  const seat = params.get('seat') ?? '';
  if (!roomIdPattern.test(room) || !roomIdPattern.test(seat)) return null;
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
