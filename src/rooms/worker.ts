import { assets } from 'virtual:sites-assets';
import { roomApi, type RoomEnvironment } from './api';

export default {
  async fetch(request: Request, env: RoomEnvironment): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/rooms' || pathname.startsWith('/api/rooms/')) return roomApi(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });

    const asset = assets.get(pathname === '/' ? '/index.html' : pathname);
    if (!asset) return new Response('Page not found', { status: 404 });

    let bytes: Uint8Array<ArrayBuffer> | null = null;
    if (request.method === 'GET') {
      const decoded = atob(asset.body);
      bytes = new Uint8Array(decoded.length);
      for (let index = 0; index < bytes.length; index++) bytes[index] = decoded.charCodeAt(index);
    }
    return new Response(bytes, {
      headers: {
        'Content-Type': asset.mime,
        'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
