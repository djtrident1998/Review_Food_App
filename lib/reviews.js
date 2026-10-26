// Review validation shared by the API (authoritative) and the browser's local-only mode.
import { restById, SUBS, VISITS } from './catalog.js';

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_CHARS = 120000; // one resized JPEG as a data URL

const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const photoOk = s => typeof s === 'string' && s.length <= MAX_PHOTO_CHARS && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);

/* The fields a reviewer controls. Returns {value} or {error}. */
export function cleanInput(d){
  if (!d || typeof d !== 'object') return {error:'Missing review.'};
  const rest = restById(d.restaurantId);
  if (!rest) return {error:'Unknown restaurant.'};
  const rating = Number(d.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return {error:'Choose a star rating from 1 to 5.'};
  const authorName = str(d.authorName, 60);
  if (!authorName) return {error:'Add your name.'};
  const text = str(d.text, 1000);
  if (text.length < 10) return {error:'Write at least 10 characters.'};
  const sub = d.subRatings && typeof d.subRatings === 'object' ? d.subRatings : {};
  const subRatings = Object.fromEntries(SUBS.map(([k]) => { const v = Number(sub[k]); return [k, Number.isInteger(v) && v >= 1 && v <= 5 ? v : 0]; }));
  return {value: {
    restaurantId: rest.id, rating, authorName, text,
    title: str(d.title, 100),
    visitType: VISITS.includes(d.visitType) ? d.visitType : 'Dine-in',
    dishes: Array.isArray(d.dishes) ? [...new Set(d.dishes.filter(x => rest.popularDishes.includes(x)))] : [],
    subRatings: SUBS.some(([k]) => subRatings[k]) ? subRatings : null,
    photos: Array.isArray(d.photos) ? d.photos.filter(photoOk).slice(0, MAX_PHOTOS) : []
  }};
}

/* A stored review, read back defensively. */
export function readStored(r){
  if (!r || typeof r !== 'object' || typeof r.id !== 'string') return null;
  const c = cleanInput(r);
  if (c.error) return null;
  return Object.assign(c.value, {id: r.id, authorId: typeof r.authorId === 'string' ? r.authorId : null,
    baseHelpful: Math.max(0, Math.floor(Number(r.baseHelpful) || 0)), createdAt: Number(r.createdAt) || 0, updatedAt: Number(r.updatedAt) || 0});
}

export function seedToReview(s, now){
  return {id:s.id, restaurantId:s.restaurantId, authorId:null, authorName:s.authorName, rating:s.rating, title:s.title, text:s.text, visitType:s.visitType,
    dishes:s.dishes, subRatings:s.subRatings, photos:[], baseHelpful:s.baseHelpful, createdAt: Math.round(now - s.hoursAgo * 36e5), updatedAt:0};
}

export const newId = now => 'u-' + now.toString(36) + Math.random().toString(36).slice(2, 8);
