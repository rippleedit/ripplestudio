-- RippleStudio update 2: your profile picture.
-- Stored with your profile as a small square image (a data URL), as in RippleReview.
-- Adds a column; changes no existing data.
alter table public.profiles add column if not exists avatar text;
