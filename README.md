# Plate Index

A restaurant discovery and review site for Bengaluru, built from the Claude Design hand-off in `project/Plate Index v2.dc.html`. Browse ten kitchens, filter by cuisine, rating, price and diet, and post star ratings and reviews that every visitor can read.

- **Frontend:** Vite + React (`src/`), styled with the Modernist tokens from the design.
- **API:** Vercel serverless functions (`api/`) backed by Upstash Redis.
- **Shared code:** the restaurant catalogue, sample reviews and review validation (`lib/`) run in both the browser and the API.

## Deploy to Vercel

1. Push this repo to GitHub, then in Vercel choose **Add New → Project** and import it. The defaults are already set in `vercel.json` (Vite, `npm run build`, output `dist`).
2. In the new project, open **Storage → Create Database → Upstash (Redis)** and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Optional: under **Settings → Environment Variables**, add `ADMIN_TOKEN` with a long random value (at least 12 characters).
4. Redeploy so the functions pick up the variables.

On the first request the API loads the 38 sample reviews from the design. Until Redis is connected, the site still works, but each visitor's reviews are saved in their own browser only, and a notice says so.

## Run locally

```bash
npm install
npm run serve:local   # builds, then serves the site and API at http://localhost:3000
```

`serve:local` uses an in-memory store unless `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, so local data disappears when you stop it. `npm run dev` runs the Vite dev server for frontend work. It has no API, so the app falls back to browser-only storage.

## How it works

| Endpoint | What it does |
| --- | --- |
| `GET /api/state` | All reviews with helpful counts, plus which ones you voted on, reported or wrote |
| `POST /api/reviews` | Post a review |
| `PUT /api/reviews?id=` | Edit your own review |
| `DELETE /api/reviews?id=` | Delete your own review (the admin can delete any) |
| `POST /api/vote` | Toggle your helpful vote (not on your own review) |
| `POST /api/report` | Report a review |

- **Identity:** each browser gets a random key, kept in `localStorage` and sent as `x-plate-key`. The server stores only a hash of it as the author id, so nobody can edit, delete or vote as someone else. Clearing site data means losing edit rights to your old reviews.
- **Moderation:** open the site with `#admin=<ADMIN_TOKEN>` once. That browser can then delete any review and see how many times each one was reported.
- **Limits:** 30 writes a minute per browser, 5,000 reviews in total, and up to 3 photos per review. Photos are resized in the browser before upload.
- **Saved restaurants** stay in each visitor's browser.
- **The site refreshes reviews** every 20 seconds and whenever the tab regains focus.

## Not done yet

- **Food photos:** restaurant, cuisine and dish images are coloured placeholder plates. The design's Wikimedia photos couldn't be downloaded from the build environment. Drop images into `public/` and swap the `Plate` component in `src/main.js` to use them.
- **Add-a-restaurant form:** not built. The catalogue is fixed in `lib/catalog.js`.

## Other folders

- `project/`, `chats/`, `HANDOFF.md`: the original Claude Design hand-off.
- `artifact/plate-index.html`: the earlier single-file version published as a claude.ai artifact.
