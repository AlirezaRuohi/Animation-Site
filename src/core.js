import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const formats = Object.freeze({ landscape: [1280, 720], portrait: [720, 1280], square: [960, 960] });
const themes = new Set(['midnight', 'light', 'sunset']);
const visuals = new Set(['headline', 'stats', 'product']);
export const MAX_SCENES = 10;
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && [...v].length <= max;
const color = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

export function validateStory(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Storyboard must be an object.');
  if (!text(raw.title, 120)) throw Error('title is required (1–120 characters).');
  if (!Object.hasOwn(formats, raw.format)) throw Error('format must be landscape, portrait, or square.');
  if (!Array.isArray(raw.scenes) || raw.scenes.length < 1 || raw.scenes.length > MAX_SCENES) throw Error('Use 1–10 scenes.');
  const scenes = raw.scenes.map((s, i) => {
    if (!s || !text(s.title, 140)) throw Error(`Scene ${i+1}: title is required (max 140).`);
    if (s.subtitle != null && (typeof s.subtitle !== 'string' || [...s.subtitle].length > 320)) throw Error(`Scene ${i+1}: subtitle too long.`);
    if (!Number.isInteger(s.duration) || s.duration < 2 || s.duration > 12) throw Error(`Scene ${i+1}: duration must be an integer 2–12 seconds.`);
    const theme = s.theme ?? 'midnight';
    const visual = s.visual ?? 'headline';
    if (!themes.has(theme) || !visuals.has(visual)) throw Error(`Scene ${i+1}: invalid theme or visual.`);
    if (s.accent != null && !color(s.accent)) throw Error(`Scene ${i+1}: accent must be #RRGGBB.`);
    return { title: s.title.trim(), subtitle: (s.subtitle ?? '').trim(), duration: s.duration, theme, visual, accent: s.accent ?? '#67E8F9' };
  });
  if (scenes.reduce((n, s) => n + s.duration, 0) > 60) throw Error('Video cannot exceed 60 seconds in this release.');
  return { title: raw.title.trim(), format: raw.format, fps: 24, width: formats[raw.format][0], height: formats[raw.format][1], scenes };
}

export class StudioStore {
  constructor(dataDir) { this.dir = path.resolve(dataDir); }
  async init() { await mkdir(path.join(this.dir, 'projects'), {recursive: true}); await mkdir(path.join(this.dir, 'outputs'), {recursive: true}); await mkdir(path.join(this.dir, 'work'), {recursive: true}); }
  file(id) { if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id)) throw Error('Invalid project ID.'); return path.join(this.dir, 'projects', `${id}.json`); }
  async save(value) { const file = this.file(value.id); const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(value, null, 2)); await rename(tmp,file); return value; }
  async create(raw) { const video = validateStory(raw); const now = new Date().toISOString(); return this.save({ id: randomUUID(), revision: 1, status: 'draft', created_at: now, updated_at: now, ...video }); }
  async get(id) { try { return JSON.parse(await readFile(this.file(id), 'utf8')); } catch(e) { if (e.code === 'ENOENT') throw Error('Project not found.'); throw e; } }
  async update(id, raw) { const old = await this.get(id); if (old.status === 'rendering' || old.status === 'queued') throw Error('Cannot edit while rendering.'); const video = validateStory(raw); return this.save({ ...old, ...video, revision: old.revision+1, status:'draft', error: null, updated_at: new Date().toISOString() }); }
  async list() { const names = (await readdir(path.join(this.dir, 'projects'))).filter(n=>n.endsWith('.json')).slice(0,200); const rows = await Promise.all(names.map(async n=> { try { return await this.get(n.slice(0,-5)); } catch { return null; }})); return rows.filter(Boolean).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,30).map(({id,title,format,status,revision,created_at,updated_at})=>({id,title,format,status,revision,created_at,updated_at})); }
}
export function validBearer(header, key) {
  if (!key) return false;
  const match = /^Bearer ([^\s]+)$/i.exec(header || '');
  if (!match) return false;
  const a = Buffer.from(match[1]); const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a,b);
}
export function signedPath(secret, id, kind, ttlSeconds=3600, now=Date.now()) {
  const expiry = Math.floor(now / 1000) + ttlSeconds;
  const resource = `/downloads/${id}.${kind}`;
  const value = `${resource}:${expiry}`;
  const sig = createHmac('sha256', secret).update(value).digest('hex');
  return `${resource}?expires=${expiry}&sig=${sig}`;
}
export function verifySignedPath(secret, resource, expires, sig, now=Date.now()) {
  if (!/^\/downloads\/[a-f0-9-]+\.(mp4|png)$/.test(resource)) return false;
  if (!/^\d{10,12}$/.test(String(expires)) || Number(expires) < Math.floor(now/1000)) return false;
  if (!/^[a-f0-9]{64}$/.test(sig || '')) return false;
  const expected = createHmac('sha256',secret).update(`${resource}:${expires}`).digest('hex');
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
