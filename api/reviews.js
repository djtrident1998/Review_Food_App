// POST /api/reviews creates a review, PUT /api/reviews?id= edits your own, DELETE /api/reviews?id= removes your own (or any, for the admin).
import { redis, K, MAX_REVIEWS, HttpError, requireUser, isAdmin, rateLimit, getReview, body, handler } from '../lib/server.js';
import { cleanInput, newId } from '../lib/reviews.js';

export default handler({POST:1, PUT:1, DELETE:1}, async req => {
  const me = requireUser(req);
  await rateLimit(me);
  const now = Date.now();

  if (req.method === 'POST') {
    const c = cleanInput(body(req));
    if (c.error) throw new HttpError(400, c.error);
    const [count] = await redis([['HLEN', K.reviews]]);
    if (count >= MAX_REVIEWS) throw new HttpError(507, 'The review store is full.');
    const review = Object.assign(c.value, {id: newId(now), authorId: me, baseHelpful: 0, createdAt: now, updatedAt: 0});
    await redis([['HSET', K.reviews, review.id, JSON.stringify(review)]]);
    return {id: review.id};
  }

  const existing = await getReview(String(req.query.id || ''));
  if (!existing) throw new HttpError(404, 'That review no longer exists.');
  const own = existing.authorId === me;

  if (req.method === 'PUT') {
    if (!own) throw new HttpError(403, 'You can only edit your own reviews.');
    const c = cleanInput(Object.assign(body(req), {restaurantId: existing.restaurantId}));
    if (c.error) throw new HttpError(400, c.error);
    const review = Object.assign({}, existing, c.value, {updatedAt: now});
    await redis([['HSET', K.reviews, review.id, JSON.stringify(review)]]);
    return {id: review.id};
  }

  if (!own && !isAdmin(req)) throw new HttpError(403, 'You can only delete your own reviews.');
  await redis([['HDEL', K.reviews, existing.id], ['DEL', K.votes(existing.id)], ['DEL', K.reports(existing.id)]]);
  return {deleted: existing.id};
});
