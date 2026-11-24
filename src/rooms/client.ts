export class RoomRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function roomRequest<Result>(path = '', method = 'GET', body?: object): Promise<Result> {
  let response: Response;
  try {
    response = await fetch('/api/rooms' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Could not reach Rooms. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as Result;
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new RoomRequestError(response.status, 'Rooms could not be loaded. Try again.');
  }
  const data = await response.json();
  if (!response.ok) throw new RoomRequestError(response.status, data.error);
  return data;
}
