// GET /api/state: every review with helpful counts, plus what the caller has voted on or reported.
import { redis, K, ensureSeeded, whoIs, isAdmin, safeJson, handler } from '../lib/server.js';
import { readStored } from '../lib/reviews.js';

export default handler({GET:1}, async req => {
  await ensureSeeded();
  const me = whoIs(req), admin = isAdmin(req);
  const [flat] = await redis([['HGETALL', K.reviews]]);
  const reviews = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) { const r = readStored(safeJson(flat[i + 1])); if (r) reviews.push(r); }
  if (reviews.length) {
    const per = 1 + (me ? 2 : 0) + (admin ? 1 : 0);
    const cmds = reviews.flatMap(r => [['SCARD', K.votes(r.id)]]
      .concat(me ? [['SISMEMBER', K.votes(r.id), me], ['SISMEMBER', K.reports(r.id), me]] : [])
      .concat(admin ? [['SCARD', K.reports(r.id)]] : []));
    const out = await redis(cmds);
    reviews.forEach((r, i) => {
      const o = out.slice(i * per, (i + 1) * per);
      r.helpfulCount = r.baseHelpful + (o[0] || 0);
      r.voted = me ? o[1] === 1 : false;
      r.reported = me ? o[2] === 1 : false;
      if (admin) r.reports = o[per - 1] || 0;
      r.mine = !!me && r.authorId === me;
      delete r.authorId;
    });
  }
  return {reviews, admin, signedIn: !!me};
});
