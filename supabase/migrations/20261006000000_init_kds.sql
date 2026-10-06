-- Halloween Mini Games — KDS : scores (public leaderboard) + user_themes (private)
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Players are Supabase ANONYMOUS-auth users (role `authenticated`, auth.uid() set).

-- ============ scores: 1 user + 1 game = 1 best score ============
create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game        text not null check (game in ('run','hunt','memory')),
  score       integer not null,
  player_name text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),   -- moves only when the best score improves (tie-break)
  constraint scores_user_game_key unique (user_id, game),
  constraint scores_name_len check (char_length(player_name) between 1 and 24),
  constraint scores_range check (score >= 0 and score <= case game when 'hunt' then 5000 else 300000 end)
);
create index if not exists scores_board_idx on public.scores (game, score desc, updated_at asc);

alter table public.scores enable row level security;

drop policy if exists "scores readable by everyone"  on public.scores;
drop policy if exists "players insert own score"     on public.scores;
drop policy if exists "players update own score"     on public.scores;

create policy "scores readable by everyone" on public.scores
  for select to anon, authenticated using (true);
create policy "players insert own score" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "players update own score" on public.scores
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- no DELETE policy: scores cannot be deleted from the client

-- Guard trigger: immutable owner/game, score can never go down, updated_at only moves on improvement.
create or replace function public.scores_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  if new.user_id <> old.user_id or new.game <> old.game then
    raise exception 'user_id and game are immutable' using errcode = '42501';
  end if;
  new.id := old.id; new.created_at := old.created_at;
  if new.score > old.score then
    new.updated_at := now();
  else
    new.score := old.score; new.updated_at := old.updated_at;   -- never lower the best score
  end if;
  return new;
end $$;
drop trigger if exists scores_guard_trg on public.scores;
create trigger scores_guard_trg before insert or update on public.scores
  for each row execute function public.scores_guard();

-- Submit a score: insert, or raise the best score. SECURITY INVOKER => RLS still applies.
create or replace function public.submit_score(p_game text, p_score integer, p_name text)
returns public.scores language plpgsql security invoker set search_path = public as $$
declare r public.scores; nm text := left(btrim(coalesce(p_name,'')), 24);
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if nm = '' then raise exception 'player name required' using errcode = '23514'; end if;
  insert into public.scores (user_id, game, score, player_name)
  values (auth.uid(), p_game, p_score, nm)
  on conflict (user_id, game) do update
    set score = greatest(public.scores.score, excluded.score), player_name = excluded.player_name
  returning * into r;
  return r;
end $$;

-- Rank of the current player in a game (score desc, then earlier updated_at wins ties)
create or replace function public.my_rank(p_game text)
returns table (rank bigint, score integer, player_name text)
language sql stable security invoker set search_path = public as $$
  select (select count(*) from public.scores o
           where o.game = p_game and (o.score > m.score or (o.score = m.score and o.updated_at < m.updated_at))) + 1,
         m.score, m.player_name
  from public.scores m where m.user_id = auth.uid() and m.game = p_game;
$$;

-- ============ user_themes: 1 user = 1 private personal theme ============
create table if not exists public.user_themes (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme_data jsonb not null check (jsonb_typeof(theme_data) = 'object' and length(theme_data::text) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_themes enable row level security;

drop policy if exists "theme select own" on public.user_themes;
drop policy if exists "theme insert own" on public.user_themes;
drop policy if exists "theme update own" on public.user_themes;
drop policy if exists "theme delete own" on public.user_themes;
create policy "theme select own" on public.user_themes for select to authenticated using (user_id = (select auth.uid()));
create policy "theme insert own" on public.user_themes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "theme update own" on public.user_themes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "theme delete own" on public.user_themes for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.themes_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then raise exception 'user_id is immutable' using errcode = '42501'; end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists themes_guard_trg on public.user_themes;
create trigger themes_guard_trg before insert or update on public.user_themes
  for each row execute function public.themes_guard();

-- ============ privileges (least privilege for the Data API) ============
revoke all on public.scores      from anon, authenticated;
revoke all on public.user_themes from anon, authenticated;
grant select on public.scores to anon, authenticated;
grant insert, update on public.scores to authenticated;
grant select, insert, update, delete on public.user_themes to authenticated;
revoke execute on function public.submit_score(text,integer,text) from public, anon;
revoke execute on function public.my_rank(text) from public, anon;
grant  execute on function public.submit_score(text,integer,text) to authenticated;
grant  execute on function public.my_rank(text) to authenticated;
