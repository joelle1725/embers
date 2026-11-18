# Experiment: does a personal email get more guests to open the gallery?

## Question
The whole product ends in one email. If guests do not open the gallery, the night is lost. Does telling a guest how many photos are theirs get more of them to open it than a plain "your photos are ready"?

## Setup
- **Variant A (control):** subject "Gathering name: your photos are ready", body "the photos are ready".
- **Variant B:** subject "N photos from Gathering name, K of them yours", body repeats the counts.
- **Assignment:** a stable hash of the guest id, so the split is about 50/50 and a re-send never moves a guest.
- **Metric:** share of emailed guests who open the gallery from their personal link within 48 hours.
- **Tracking:** `guests.gallery_variant`, `emailed_at`, `gallery_opened_at`, set by the server. Only the first send counts.
- **Analysis:** query 7 in `analytics/queries.sql` (two proportion z-test).

## Decision rule (set before running)
Ship B for everyone if it beats A by at least 10 points with |z| above 1.96. Otherwise keep A, since B costs one more query.

## Honest limits
- A single gathering has roughly 10 to 20 guests, so one night cannot reach significance. Pool at least 6 gatherings (about 80 guests) before reading the result.
- Opens from the sign in form (code plus email) are not counted, only the emailed link, so the open rate is a floor.
- Email clients that block link tracking do not matter here, because the open is the gallery page load, not a tracking pixel.

## Result
Not run yet. Fill in after the first gatherings: n per variant, open rates, lift, z, decision.
