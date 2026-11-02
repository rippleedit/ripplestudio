-- RippleStudio update 4: two new time-tracking stages.
-- "Title & thumbnail ideation" and "Thumbnail creation", for the thumbnail
-- package. No logged time is touched: this only widens the list of stage names
-- the time_entries table is willing to accept. If Supabase warns about a
-- "destructive operation", it means the rule replaced below, not your data.

-- The old rule named ten stages and so would reject the two new ones. Drop it by
-- whatever name Postgres gave it, then put the wider rule back.
do $$
declare existing text;
begin
  for existing in
    select conname from pg_constraint
    where conrelid = 'public.time_entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%stage%'
  loop
    execute format('alter table public.time_entries drop constraint %I', existing);
  end loop;
end $$;

alter table public.time_entries add constraint time_entries_stage_check
  check (stage is null or stage in ('project_setup','sync','rough_cut','fine_cut','animation','color','audio','captions','export_upload','revisions','title_thumbnail_ideation','thumbnail_creation'));

-- Proof it took: this should list all twelve stage names.
select pg_get_constraintdef(oid) as stages_now_allowed
from pg_constraint
where conrelid = 'public.time_entries'::regclass and conname = 'time_entries_stage_check';
