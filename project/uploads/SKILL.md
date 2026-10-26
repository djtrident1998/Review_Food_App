---
name: restaurant-review-app
description: Design and build a restaurant discovery app where users browse restaurants, give star ratings, and write reviews. Use when asked to build a food review, restaurant rating, or Zomato-style app.
---

# Restaurant Review & Rating App

Build a mobile-first restaurant discovery app where people can browse restaurants, rate them, and write reviews. Use an original app name, logo and color palette. Do not copy Zomato's name, logo, red branding, or any proprietary assets.

## Goal

Let a user find a restaurant, read what others think, and post their own star rating and written review in under 30 seconds.

## Core features (must have)

1. **Home / restaurant list**
   - Cards showing: photo, name, cuisine tags, average rating (e.g. 4.3 with star), review count, price range (₹ / ₹₹ / ₹₹₹), distance or area, open/closed status.
   - Search bar (by restaurant name or cuisine).
   - Filters: cuisine, minimum rating (3+, 4+, 4.5+), price range, veg-only toggle.
   - Sort: top rated, most reviewed, price low to high, newest.

2. **Restaurant detail page**
   - Hero photo, name, cuisine, address, hours, price range.
   - Large average rating with a rating-distribution bar chart (5★ to 1★ counts).
   - Popular dishes list.
   - Reviews list (newest first, with option to sort by highest/lowest/most helpful).
   - Sticky "Write a review" button.

3. **Write a review**
   - Interactive 1-5 star rating (tap or click, with hover preview, half-stars optional).
   - Fields: reviewer name, review title (optional), review text (min 10 characters, max 1000, with live counter).
   - Optional: dishes tried (tags), visit type (Dine-in / Delivery / Takeaway), sub-ratings for Food, Service, Ambience, Value.
   - Optional photo upload (up to 3 images, preview thumbnails).
   - Validation with clear inline messages. Disable submit until rating and minimum text are provided.
   - Success state after posting; the new review appears instantly at the top and the average rating updates.

4. **Reviews behavior**
   - Each review card: avatar initials, name, star rating, date ("2 days ago"), visit type, text, photos, dishes tried.
   - "Helpful" button with count (one vote per user per review).
   - Users can edit or delete their own reviews.
   - Report button on every review.

5. **Persistence**
   - Reviews, ratings and helpful votes must be saved and survive page reloads. Reviews should be shared across viewers if the platform supports shared storage; otherwise use per-browser storage wrapped in try/catch with an in-memory fallback.
   - Recalculate average rating and distribution from the stored reviews. Never hard-code averages.

## Nice to have

- Favorites / bookmark restaurants, with a "Saved" tab.
- "My Reviews" tab listing everything the user has written.
- Add a new restaurant form.
- Dark mode following system preference.
- Empty states: no results, no reviews yet ("Be the first to review").
- Skeleton loaders.

## Seed data

Pre-load 8-10 realistic fictional restaurants (invented names only, no real businesses) across varied cuisines: North Indian, South Indian, Chinese, Italian, Cafe, Biryani, Street Food, Desserts. Give each 3-6 sample reviews with a realistic spread of ratings (not all 5 stars), and varied review lengths. Use invented reviewer names. Use tasteful placeholder images (gradients or illustrations) if real photos are unavailable.

## Data model

```
Restaurant { id, name, cuisines[], priceRange (1-3), area, address, hours, isVeg, photo, popularDishes[] }
Review     { id, restaurantId, authorName, rating (1-5), title?, text, visitType, dishes[], subRatings?{food,service,ambience,value}, photos[], helpfulCount, helpfulVoters[], createdAt, updatedAt? }
```

Derived values (computed, never stored): average rating (1 decimal), review count, distribution per star.

## Design direction

- Mobile-first, responsive up to desktop (single column on phones, 2-3 column grid on wide screens).
- Choose a distinctive, appetizing palette (for example warm saffron/charcoal or deep green/cream) and a clear type pairing. Avoid generic template looks and avoid red-and-white Zomato styling.
- Rating color scale: green for 4+, amber for 3-3.9, orange/red below 3, always paired with the number so color is not the only signal.
- Large tap targets (min 44px), visible focus states, labels on all inputs, `aria-label`s on star buttons, keyboard-operable star rating (arrow keys).
- Smooth but restrained motion: star fill animation, card hover lift, toast on successful submit.

## Behavior rules

- Prevent duplicate rapid submissions (disable button while saving).
- Trim whitespace, escape all user text before rendering (no HTML injection).
- Relative timestamps with full date on hover/tap.
- Keep the page working with no network once loaded.

## Acceptance checklist

- [ ] Can search, filter and sort restaurants.
- [ ] Can open a restaurant and see its rating breakdown and reviews.
- [ ] Can submit a review with stars + text and see it appear immediately.
- [ ] Average rating and distribution update after a new review.
- [ ] Reviews persist after reload.
- [ ] Can edit and delete own review; helpful vote works once per review.
- [ ] Validation errors are clear; no console errors.
- [ ] Usable at 375px wide and at desktop width.
- [ ] No Zomato branding or assets anywhere.
