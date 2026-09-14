-- 게임 목록은 코드(lib/games/registry.ts)가 기준. `pnpm games:sync`로 games 테이블에 반영한다
-- game_visits.game_id -> games.id FK. registry에 없는 slug는 기록되지 않는다

drop function public.record_game_visit(text);
drop table public.game_visits;
drop table public.game_stats;

create table public.games (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  title text not null,
  visit_count bigint not null default 0,
  last_visited_at timestamptz
);

create table public.game_visits (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games (id) on delete restrict,
  visited_at timestamptz not null default now()
);

create index game_visits_game_id_visited_at_idx on public.game_visits (game_id, visited_at desc);

alter table public.games enable row level security;
alter table public.game_visits enable row level security;

create function public.record_game_visit(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
begin
  update public.games
    set visit_count = visit_count + 1,
        last_visited_at = now()
    where slug = p_slug
    returning id into v_game_id;

  if v_game_id is null then
    return;
  end if;

  insert into public.game_visits (game_id) values (v_game_id);
end;
$$;

revoke execute on function public.record_game_visit(text) from public, anon, authenticated;
grant execute on function public.record_game_visit(text) to anon, authenticated;
