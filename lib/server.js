// Server-side helpers for the Vercel functions in /api: Upstash Redis over REST, identity, and responses.
import { createHash } from 'node:crypto';
import { SEED_REVIEWS } from './seed.js';
import { readStored, seedToReview } from './reviews.js';

const env = () => ({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
});

export const K = {
  reviews: 'pi:reviews',             // hash: review id -> review JSON
  seeded: 'pi:seeded',
  votes: id => 'pi:votes:' + id,     // set of author ids who found a review helpful
  reports: id => 'pi:reports:' + id, // set of author ids who reported a review
  rate: (who, min) => 'pi:rl:' + who + ':' + min
};
export const MAX_REVIEWS = 5000;

export class HttpError extends Error { constructor(status, message){ super(message); this.status = status; } }

/* Run Redis commands in one round trip. Returns each command's result. */
export async function redis(cmds){
  const {url, token} = env();
  if (!url || !token) throw new HttpError(503, 'storage_not_configured');
  const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {method:'POST', headers:{Authorization:'Bearer ' + token, 'Content-Type':'application/json'}, body: JSON.stringify(cmds)});
  if (!r.ok) throw new HttpError(502, 'Storage error (' + r.status + ').');
  const out = await r.json();
  return out.map(x => { if (x && x.error) throw new HttpError(502, 'Storage error: ' + x.error); return x ? x.result : null; });
}

/* Each browser keeps a random secret; its public author id is a hash of it, so nobody can act as someone else. */
export function whoIs(req){
  const key = String(req.headers['x-plate-key'] || '');
  if (!/^[a-f0-9]{32,64}$/.test(key)) return null;
  return 'a_' + createHash('sha256').update('plate-index:' + key).digest('hex').slice(0, 24);
}
export function isAdmin(req){
  const t = process.env.ADMIN_TOKEN;
  return !!t && t.length >= 12 && req.headers['x-plate-admin'] === t;
}
export function requireUser(req){
  const me = whoIs(req);
  if (!me) throw new HttpError(401, 'Missing or malformed x-plate-key header.');
  return me;
}

/* At most 30 writes a minute per person. */
export async function rateLimit(me){
  const k = K.rate(me, Math.floor(Date.now() / 60000));
  const [n] = await redis([['INCR', k], ['EXPIRE', k, 120]]);
  if (n > 30) throw new HttpError(429, 'Too many changes in a minute. Wait a moment and try again.');
}

export async function ensureSeeded(){
  const [ok] = await redis([['SET', K.seeded, '1', 'NX']]);
  if (ok !== 'OK') return;
  const now = Date.now();
  const args = SEED_REVIEWS.flatMap(s => [s.id, JSON.stringify(seedToReview(s, now))]);
  await redis([['HSET', K.reviews, ...args]]);
}

export async function getReview(id){
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id)) return null;
  const [raw] = await redis([['HGET', K.reviews, id]]);
  return raw ? readStored(safeJson(raw)) : null;
}

export const safeJson = s => { try { return JSON.parse(s); } catch (e) { return null; } };

export function body(req){
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return safeJson(req.body) || {};
  return {};
}

/* Wrap a handler: JSON errors, no caching. */
export function handler(methods, fn){
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods[req.method]) { res.setHeader('Allow', Object.keys(methods).join(', ')); return res.status(405).json({error:'Method not allowed.'}); }
    try { const out = await fn(req, res); if (!res.headersSent) res.status(200).json(out); }
    catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.status(status).json({error: status === 500 ? 'Something went wrong on the server.' : e.message});
    }
  };
}
