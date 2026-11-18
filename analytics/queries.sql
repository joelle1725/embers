-- Embers analytics. Run in Supabase: SQL Editor > New query.
-- Tables: parties, guests, photos. "Verified" means the guest confirmed the emailed 6 digit code.

-- 1. Guests, photos and use of the roll per gathering
select p.code, p.name,
       count(distinct g.id)                                  as joined,
       count(distinct g.id) filter (where g.verified)        as verified,
       count(ph.id)                                          as photos,
       round(count(ph.id)::numeric / nullif(count(distinct g.id) filter (where g.verified), 0), 1) as photos_per_guest,
       round(100.0 * avg(g.shots_used) filter (where g.verified) / max(p.max_shots), 0)            as pct_of_roll_used
from parties p
left join guests g  on g.party_id = p.id
left join photos ph on ph.party_id = p.id
group by p.id
order by p.created_at desc;

-- 2. Join funnel: signed up, verified the code, took at least one photo
select p.code,
       count(*)                                              as signed_up,
       count(*) filter (where g.verified)                    as verified,
       count(*) filter (where g.shots_used > 0)              as shot_one,
       round(100.0 * count(*) filter (where g.verified) / count(*), 0)   as pct_verified,
       round(100.0 * count(*) filter (where g.shots_used > 0) / nullif(count(*) filter (where g.verified), 0), 0) as pct_verified_who_shot
from parties p join guests g on g.party_id = p.id
group by p.id;

-- 3. Roll use: how many guests stop at each shot count (histogram)
select shots_used, count(*) as guests
from guests where verified
group by shots_used order by shots_used;

-- 4. Time from sign up to first photo, per guest (median and 90th percentile, in minutes)
with first_shot as (
  select g.id, g.created_at, min(ph.taken_at) as first_photo
  from guests g join photos ph on ph.guest_id = g.id
  group by g.id
)
select count(*) as guests,
       round((percentile_cont(0.5) within group (order by extract(epoch from first_photo - created_at)) / 60)::numeric, 1) as median_min,
       round((percentile_cont(0.9) within group (order by extract(epoch from first_photo - created_at)) / 60)::numeric, 1) as p90_min
from first_shot;

-- 5. Photo concentration: share of a gathering's photos taken by its top 3 photographers
with per_guest as (
  select party_id, guest_id, count(*) as n,
         row_number() over (partition by party_id order by count(*) desc) as rnk
  from photos group by party_id, guest_id
)
select p.code,
       sum(n) as photos,
       round(100.0 * sum(n) filter (where rnk <= 3) / sum(n), 0) as pct_from_top3
from per_guest join parties p on p.id = per_guest.party_id
group by p.code;

-- 6. Gallery open rate within 48 hours of the email, by gathering
select p.code,
       count(*) filter (where g.emailed_at is not null)       as emailed,
       count(*) filter (where g.gallery_opened_at <= g.emailed_at + interval '48 hours') as opened_48h,
       round(100.0 * count(*) filter (where g.gallery_opened_at <= g.emailed_at + interval '48 hours')
             / nullif(count(*) filter (where g.emailed_at is not null), 0), 0) as pct_opened_48h
from parties p join guests g on g.party_id = p.id
group by p.id;

-- 7. Email experiment: A (plain subject) vs B (personal photo count). Metric: opened within 48 hours.
--    Two proportion z-test. |z| above 1.96 is significant at the 95% level.
with v as (
  select gallery_variant as variant,
         count(*) as n,
         count(*) filter (where gallery_opened_at <= emailed_at + interval '48 hours') as opened
  from guests
  where gallery_variant is not null
  group by 1
), ab as (
  select a.n as n_a, a.opened as o_a, b.n as n_b, b.opened as o_b
  from v a, v b where a.variant = 'A' and b.variant = 'B'
), stats as (
  select *, o_a::float / n_a as p_a, o_b::float / n_b as p_b,
         (o_a + o_b)::float / (n_a + n_b) as p
  from ab
)
select n_a, o_a, round((100 * p_a)::numeric, 1) as pct_a,
       n_b, o_b, round((100 * p_b)::numeric, 1) as pct_b,
       round((100 * (p_b - p_a))::numeric, 1) as lift_points,
       round(((p_b - p_a) / nullif(sqrt(p * (1 - p) * (1.0 / n_a + 1.0 / n_b)), 0))::numeric, 2) as z
from stats;
