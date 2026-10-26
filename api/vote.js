// POST /api/vote {reviewId}: toggle your "helpful" vote. One vote per person per review; not on your own.
import { redis, K, HttpError, requireUser, rateLimit, getReview, body, handler } from '../lib/server.js';

export default handler({POST:1}, async req => {
  const me = requireUser(req);
  await rateLimit(me);
  const review = await getReview(body(req).reviewId);
  if (!review) throw new HttpError(404, 'That review no longer exists.');
  if (review.authorId === me) throw new HttpError(403, 'You can’t vote on your own review.');
  const [has] = await redis([['SISMEMBER', K.votes(review.id), me]]);
  const [, n] = await redis([[has ? 'SREM' : 'SADD', K.votes(review.id), me], ['SCARD', K.votes(review.id)]]);
  return {voted: !has, helpfulCount: review.baseHelpful + n};
});
