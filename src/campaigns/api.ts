import { parseArchive, validateArchive } from '../galaxy/storage';
import type { Archive } from '../galaxy/model';
import { CLOUD_MAX_BYTES, CLOUD_MAX_SAVES, type CloudSave } from './types';

interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface CampaignEnvironment {
  ROOM_DM_EMAIL?: string;
  DB?: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<{ results: unknown[] }[]> };
  BUCKET?: {
    put(key: string, value: Uint8Array): Promise<unknown>;
    get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
    delete(key: string): Promise<unknown>;
  };
}
type SaveRow = { id: string; owner_id: string; name: string; revision: number; operation_id: string | null; updated_at: number; deleted_at: number | null };
type Operation = { id: string; save_id: string; owner_id: string; expected_revision: number; content_hash: string; name: string; byte_size: number; chunk_count: number; created_at: number; committed_at: number | null; committed_revision: number | null };
type Art = { map_id: string; object_key: string; mime: string; digest: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const lifetime = 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const failure = (error: string, status: number) => json({ error }, status);
const metadata = (s: SaveRow): CloudSave => ({ id: s.id, name: s.name, revision: s.revision, updatedAt: s.updated_at });
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
async function hash(value: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value as Uint8Array<ArrayBuffer>)), x => x.toString(16).padStart(2, '0')).join('');
}
// Read a bounded stream even when Content-Length is absent or dishonest.
async function body(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw Error('Send a JSON campaign.');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Campaign is missing.');
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    length += item.value.length;
    if (length > CLOUD_MAX_BYTES + 4096) { await reader.cancel(); throw Error('Cloud save exceeds 10 MB. Export a local backup instead.'); }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Invalid request.');
  return parsed;
}

// Only this owner's expired staging/retired revisions are eligible. A pending operation
// cannot publish after its lease expires. Current revisions remain until deletion.
async function clean(env: Required<CampaignEnvironment>, owner: string, now: number) {
  const { results } = await env.DB.prepare(`SELECT o.id FROM campaign_operations o JOIN campaign_saves s ON s.id=o.save_id
    WHERE o.owner_id=? AND o.created_at<? AND (s.deleted_at IS NOT NULL OR s.operation_id IS NULL OR s.operation_id<>o.id)
    LIMIT 4`).bind(owner, now - lifetime).all<{ id: string }>();
  for (const { id } of results) {
    const art = await env.DB.prepare('SELECT object_key FROM campaign_art WHERE operation_id=?').bind(id).all<{ object_key: string }>();
    for (const a of art.results) await env.BUCKET.delete(a.object_key);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM campaign_art WHERE operation_id=?').bind(id),
      env.DB.prepare('DELETE FROM campaign_chunks WHERE operation_id=?').bind(id),
      env.DB.prepare('DELETE FROM campaign_operations WHERE id=?').bind(id),
    ]);
  }
  await env.DB.prepare(`UPDATE campaign_saves SET deleted_at=?,name='',operation_id=NULL WHERE owner_id=? AND revision=0 AND deleted_at IS NULL AND updated_at<? RETURNING id`)
    .bind(now, owner, now - lifetime).all();
}

async function restore(env: Required<CampaignEnvironment>, save: SaveRow): Promise<Archive> {
  const op = await env.DB.prepare('SELECT * FROM campaign_operations WHERE id=? AND owner_id=? AND committed_at IS NOT NULL')
    .bind(save.operation_id, save.owner_id).first<Operation>();
  if (!op) throw Error('Saved revision is unavailable. Your local campaigns are unchanged.');
  const chunks = await env.DB.prepare('SELECT position, content FROM campaign_chunks WHERE operation_id=? ORDER BY position')
    .bind(op.id).all<{ position: number; content: string }>();
  if (chunks.results.length !== op.chunk_count || chunks.results.some((c, i) => c.position !== i)) throw Error('Saved content is incomplete.');
  const archive = parseArchive(chunks.results.map(c => c.content).join(''));
  const art = await env.DB.prepare('SELECT * FROM campaign_art WHERE operation_id=?').bind(op.id).all<Art>();
  for (const a of art.results) {
    const map = archive.campaigns[0].maps.find(m => m.id === a.map_id);
    const object = await env.BUCKET.get(a.object_key);
    if (!map || !object) throw Error('Saved artwork is missing. Your local campaigns are unchanged.');
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (await hash(bytes) !== a.digest) throw Error('Saved artwork failed its integrity check.');
    // Avoid spreading a large array into String.fromCharCode.
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    map.backgroundImage = `data:${a.mime};base64,${btoa(binary)}`;
  }
  const valid = validateArchive(archive);
  if (await hash(encoder.encode(canonical(valid))) !== op.content_hash) throw Error('Saved campaign failed its integrity check.');
  return valid;
}

export async function campaignApi(request: Request, environment: CampaignEnvironment, now = Date.now()): Promise<Response> {
  const url = new URL(request.url), method = request.method;
  const owner = request.headers.get('oai-authenticated-user-id')?.trim();
  if (!owner) return failure('Sign in to use private cloud saves.', 401);
  const dmEmail = environment.ROOM_DM_EMAIL?.trim().toLowerCase();
  if (!dmEmail) return failure('Cloud saves are unavailable until the DM account is configured. Local saves and exports still work.', 503);
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (email !== dmEmail) return failure('Cloud saves are currently limited to the signed-in DM. Local saves and exports still work.', 403);
  if (method !== 'GET' && request.headers.get('Origin') !== url.origin) return failure('Open campaign saves from this Site to make changes.', 403);
  if (!environment.DB || !environment.BUCKET) return failure('Cloud saves are temporarily unavailable. Local saves and exports still work.', 503);
  const env = environment as Required<CampaignEnvironment>;
  const match = /^\/api\/campaigns(?:\/([a-f0-9-]+)(\/export)?)?$/.exec(url.pathname);
  if (!match || (match[1] && !uuid.test(match[1]))) return failure('Save not found.', 404);
  const id = match[1];
  try {
    if (!id && method === 'GET') {
      // An opaque account fingerprint lets the client discard stale selections on sign-in changes.
      const account = await hash(encoder.encode(owner));
      const saves = await env.DB.prepare('SELECT * FROM campaign_saves WHERE owner_id=? AND deleted_at IS NULL AND revision>0 ORDER BY updated_at DESC, id')
        .bind(owner).all<SaveRow>();
      return json({ account, saves: saves.results.map(metadata) });
    }
    let save = id ? await env.DB.prepare('SELECT * FROM campaign_saves WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id, owner).first<SaveRow>() : null;
    if (id && !save) return failure('Save not found.', 404);
    if (id && method === 'GET') {
      if (!save!.revision) return failure('This save has not finished uploading.', 409);
      try { return json({ save: metadata(save!), archive: await restore(env, save!) }); }
      catch { return failure('Cloud campaign content or artwork is missing or corrupt. No local campaigns were changed. Try again or use a local backup.', 503); }
    }
    if (id && method === 'DELETE' && !match[2]) {
      const data = await body(request);
      if (data.account !== await hash(encoder.encode(owner))) return failure('Account changed. Refresh before deleting.', 409);
      const removed = await env.DB.prepare("UPDATE campaign_saves SET deleted_at=?,name='',operation_id=NULL WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL RETURNING id")
        .bind(now, id, owner, typeof data.revision === 'number' ? data.revision : -1).first();
      if (!removed) return failure('This save changed. Refresh the list before deleting.', 409);
      await clean(env, owner, now);
      return json({ deleted: true });
    }
    if ((!id && method === 'POST' || id && method === 'PUT') && !match[2]) {
      let data: Record<string, unknown>, archive: Archive;
      try {
        data = await body(request);
        if (data.account !== await hash(encoder.encode(owner))) return failure('Account changed. Refresh before saving.', 409);
        archive = validateArchive(data.archive);
        if (archive.campaigns.length !== 1) throw Error('Save one campaign at a time.');
        if (archive.campaigns[0].maps.filter(m => m.backgroundImage).length > 100) throw Error('Cloud saves support up to 100 illustrated maps. Export a local backup instead.');
        if (encoder.encode(JSON.stringify(archive)).length > CLOUD_MAX_BYTES) throw Error('Cloud save exceeds 10 MB. Export a local backup instead.');
        if (typeof data.operationId !== 'string' || !uuid.test(data.operationId)) throw Error('Invalid save operation.');
        if (!Number.isInteger(data.revision) || (data.revision as number) < 0 || (!id && data.revision !== 0)) throw Error('Invalid revision.');
        if (!id && (typeof data.id !== 'string' || !uuid.test(data.id))) throw Error('Invalid save ID.');
      } catch (e) { return failure(e instanceof Error ? e.message : 'Invalid campaign.', 400); }
      await clean(env, owner, now);
      const saveId = id ?? data.id as string, operationId = data.operationId as string;
      const digest = await hash(encoder.encode(canonical(archive)));
      let operation = await env.DB.prepare('SELECT * FROM campaign_operations WHERE id=?').bind(operationId).first<Operation>();
      if (operation) {
        if (operation.owner_id !== owner || operation.save_id !== saveId || operation.content_hash !== digest || operation.expected_revision !== data.revision) return failure('Save operation does not match. Start a new save.', 409);
        if (operation.committed_at !== null && !(await env.DB.prepare('SELECT id FROM campaign_saves WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(saveId, owner).first())) return failure('Save not found.', 404);
        if (operation.committed_at !== null) return json({ save: { id: saveId, name: operation.name, revision: operation.committed_revision, updatedAt: operation.committed_at } });
        if (operation.created_at <= now - lifetime) return failure('Upload expired. Start a new save.', 410);
      }
      if (!id) {
        await env.DB.prepare(`INSERT INTO campaign_saves (id,owner_id,name,updated_at)
          SELECT ?,?,?,? WHERE (SELECT count(*) FROM campaign_saves WHERE owner_id=? AND deleted_at IS NULL)<?
          ON CONFLICT(id) DO NOTHING RETURNING id`).bind(saveId, owner, archive.campaigns[0].name, now, owner, CLOUD_MAX_SAVES).first();
        save = await env.DB.prepare('SELECT * FROM campaign_saves WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(saveId, owner).first<SaveRow>();
        if (!save) {
          const retired = await env.DB.prepare('SELECT id FROM campaign_saves WHERE id=? AND owner_id=? AND deleted_at IS NOT NULL').bind(saveId, owner).first();
          return retired ? failure('Upload expired or save deleted. Start a new cloud copy.', 410) : failure('Cloud save limit reached (20 saves). Delete a save or export a local backup.', 409);
        }
      }
      if (!save || save.revision !== data.revision) return failure('This save changed on another device. Reload it, save a new copy, or export your local work.', 409);
      const stripped = structuredClone(archive);
      const images: { row: Art; bytes: Uint8Array }[] = [];
      for (const map of stripped.campaigns[0].maps) {
        if (!map.backgroundImage) continue;
        const [prefix, encoded] = map.backgroundImage.split(',');
        const binary = atob(encoded), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        const imageDigest = await hash(bytes);
        images.push({ row: { map_id: map.id, object_key: `campaign-art/${await hash(encoder.encode(owner))}/${operationId}/${imageDigest}`, mime: prefix.slice(5, -7), digest: imageDigest }, bytes });
        delete map.backgroundImage;
      }
      // 64K UTF-16 slices stay below 256 KB per D1 row even for non-ASCII content.
      const content = JSON.stringify(stripped), chunks: string[] = [];
      for (let i = 0; i < content.length;) {
        let end = Math.min(content.length, i + 64000);
        if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1])) end++;
        chunks.push(content.slice(i, end)); i = end;
      }
      if (!operation) {
        await env.DB.prepare(`INSERT INTO campaign_operations (id,save_id,owner_id,expected_revision,content_hash,name,byte_size,chunk_count,created_at)
          SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM campaign_operations WHERE owner_id=? AND created_at>?)<40
          ON CONFLICT(id) DO NOTHING RETURNING id`)
          .bind(operationId, saveId, owner, data.revision as number, digest, archive.campaigns[0].name, encoder.encode(JSON.stringify(archive)).length, chunks.length, now, owner, now - lifetime).first();
        operation = await env.DB.prepare('SELECT * FROM campaign_operations WHERE id=?').bind(operationId).first<Operation>();
        if (!operation) {
          // A rate-limited new copy never acquired an operation. Release only an
          // unused reservation; another in-flight upload or complete save owns its slot.
          await env.DB.prepare(`DELETE FROM campaign_saves WHERE id=? AND owner_id=? AND revision=0
            AND NOT EXISTS(SELECT 1 FROM campaign_operations WHERE save_id=campaign_saves.id) RETURNING id`)
            .bind(saveId, owner).first();
          return failure('Daily cloud save limit reached. Export locally and try again tomorrow.', 429);
        }
        if (operation.owner_id !== owner || operation.save_id !== saveId || operation.content_hash !== digest || operation.expected_revision !== data.revision) return failure('Save operation does not match.', 409);
      }
      await env.DB.batch([
        ...chunks.map((chunk, i) => env.DB.prepare('INSERT INTO campaign_chunks (operation_id,position,content) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(operationId, i, chunk)),
        ...images.map(({ row: a }) => env.DB.prepare('INSERT INTO campaign_art (operation_id,map_id,object_key,mime,digest) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING')
          .bind(operationId, a.map_id, a.object_key, a.mime, a.digest)),
      ]);
      for (const image of images) await env.BUCKET.put(image.row.object_key, image.bytes);
      const published = await env.DB.batch([
        env.DB.prepare(`UPDATE campaign_saves SET operation_id=?,revision=revision+1,name=?,updated_at=?
          WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL
          AND EXISTS(SELECT 1 FROM campaign_operations WHERE id=? AND created_at>?) RETURNING *`)
          .bind(operationId, archive.campaigns[0].name, now, saveId, owner, data.revision as number, operationId, now - lifetime),
        env.DB.prepare(`UPDATE campaign_operations SET committed_at=?,committed_revision=? WHERE id=? AND committed_at IS NULL
          AND EXISTS(SELECT 1 FROM campaign_saves WHERE id=? AND operation_id=?) RETURNING id`)
          .bind(now, (data.revision as number) + 1, operationId, saveId, operationId),
      ]);
      const updated = published[0].results[0] as SaveRow | undefined;
      if (!updated) {
        const completed = await env.DB.prepare('SELECT * FROM campaign_operations WHERE id=?').bind(operationId).first<Operation>();
        if (completed?.committed_at != null) return json({ save: { id: saveId, name: completed.name, revision: completed.committed_revision, updatedAt: completed.committed_at } });
        return failure('This save changed on another device. Reload it, save a new copy, or export your local work.', 409);
      }
      return json({ save: metadata(updated) }, id ? 200 : 201);
    }
    return failure('Method not allowed.', 405);
  } catch {
    return failure('Cloud operation could not finish. Your local campaigns and the last complete cloud save are preserved. Retry or export a local backup.', 503);
  }
}
