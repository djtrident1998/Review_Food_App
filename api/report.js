// POST /api/report {reviewId}: flag a review for the admin.
import { redis, K, HttpError, requireUser, rateLimit, getReview, body, handler } from '../lib/server.js';

export default handler({POST:1}, async req => {
  const me = requireUser(req);
  await rateLimit(me);
  const review = await getReview(body(req).reviewId);
  if (!review) throw new HttpError(404, 'That review no longer exists.');
  await redis([['SADD', K.reports(review.id), me]]);
  return {reported: true};
});
