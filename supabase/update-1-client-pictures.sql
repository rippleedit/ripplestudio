-- RippleStudio update 1: client pictures.
-- Stored with the client as a small square image (a data URL), the same way
-- RippleReview stores profile pictures. Adds a column; changes no existing data.
alter table public.clients add column if not exists avatar text;
