// Talks to the /api functions. When the deployment has no storage connected, falls back to this browser's localStorage.
import { SEED_REVIEWS } from '../lib/seed.js';
import { cleanInput, readStored, seedToReview, newId } from '../lib/reviews.js';

export const LS = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};

let memKey = null;
function browserKey(){
  let k = LS.get('plateindex.key');
  if (typeof k === 'string' && /^[a-f0-9]{32}$/.test(k)) return k;
  k = memKey || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  memKey = k; LS.set('plateindex.key', k);
  return k;
}

/* "#admin=<token>" in the address bar turns on moderation for this browser. */
export function adminToken(){
  const m = location.hash.match(/^#admin=([A-Za-z0-9_-]{12,200})$/);
  if (m) { LS.set('plateindex.admin', m[1]); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  const t = LS.get('plateindex.admin');
  return typeof t === 'string' ? t : null;
}

export class ApiError extends Error { constructor(status, message){ super(message); this.status = status; } }

async function call(method, path, payload){
  const headers = {'x-plate-key': browserKey()};
  const admin = adminToken();
  if (admin) headers['x-plate-admin'] = admin;
  if (payload) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch(path, {method, headers, body: payload ? JSON.stringify(payload) : undefined}); }
  catch (e) { throw new ApiError(0, 'Couldn’t reach the server. Check your connection and try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'The server returned an error (' + res.status + ').');
  return data;
}

export const remote = {
  kind: 'live',
  load: () => call('GET', '/api/state'),
  create: input => call('POST', '/api/reviews', input),
  edit: (id, input) => call('PUT', '/api/reviews?id=' + encodeURIComponent(id), input),
  remove: id => call('DELETE', '/api/reviews?id=' + encodeURIComponent(id)),
  vote: id => call('POST', '/api/vote', {reviewId: id}),
  report: id => call('POST', '/api/report', {reviewId: id})
};

const LKEY = 'plateindex.local';
function localData(){
  let d = LS.get(LKEY);
  if (!d || !Array.isArray(d.reviews)) { const now = Date.now(); d = {reviews: SEED_REVIEWS.map(s => seedToReview(s, now)), votes: [], reports: []}; LS.set(LKEY, d); }
  return d;
}
function saveLocal(d){ if (!LS.set(LKEY, d)) throw new ApiError(507, 'This browser’s storage is full. Remove a photo and try again.'); }

export const local = {
  kind: 'local',
  async load(){
    const d = localData();
    return {admin: false, reviews: d.reviews.map(readStored).filter(Boolean).map(r => Object.assign(r, {
      mine: r.authorId === 'local', voted: d.votes.includes(r.id), reported: d.reports.includes(r.id), helpfulCount: r.baseHelpful + (d.votes.includes(r.id) ? 1 : 0)}))};
  },
  async create(input){
    const c = cleanInput(input); if (c.error) throw new ApiError(400, c.error);
    const d = localData(), now = Date.now(), id = newId(now);
    d.reviews.unshift(Object.assign(c.value, {id, authorId: 'local', baseHelpful: 0, createdAt: now, updatedAt: 0}));
    saveLocal(d); return {id};
  },
  async edit(id, input){
    const d = localData(), i = d.reviews.findIndex(r => r.id === id && r.authorId === 'local');
    if (i < 0) throw new ApiError(404, 'That review no longer exists.');
    const c = cleanInput(Object.assign({}, input, {restaurantId: d.reviews[i].restaurantId})); if (c.error) throw new ApiError(400, c.error);
    d.reviews[i] = Object.assign({}, d.reviews[i], c.value, {updatedAt: Date.now()});
    saveLocal(d); return {id};
  },
  async remove(id){ const d = localData(); d.reviews = d.reviews.filter(r => !(r.id === id && r.authorId === 'local')); d.votes = d.votes.filter(x => x !== id); saveLocal(d); return {deleted: id}; },
  async vote(id){ const d = localData(); const has = d.votes.includes(id); d.votes = has ? d.votes.filter(x => x !== id) : d.votes.concat(id); saveLocal(d); return {voted: !has}; },
  async report(id){ const d = localData(); if (!d.reports.includes(id)) d.reports.push(id); saveLocal(d); return {reported: true}; }
};
