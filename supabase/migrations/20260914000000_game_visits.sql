-- 게임 입장 수: game_stats(게임별 누적, 기본 0) + game_visits(입장 1건 = 1행, 입장 시각)
-- 브라우저는 테이블에 직접 접근 못 하고(RLS, 정책 없음) record_game_visit RPC로만 기록한다

create table public.game_stats (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  visit_count bigint not null default 0,
  last_visited_at timestamptz
);

create table public.game_visits (
  id bigint generated always as identity primary key,
  slug text not null references public.game_stats (slug) on delete cascade,
  visited_at timestamptz not null default now()
);

create index game_visits_slug_visited_at_idx on public.game_visits (slug, visited_at desc);

alter table public.game_stats enable row level security;
alter table public.game_visits enable row level security;

insert into public.game_stats (slug) values
  ('reaction-time'),
  ('click-speed'),
  ('capybara-sneak'),
  ('capybara-plane-shooter'),
  ('capybara-baduk'),
  ('capybara-gomoku'),
  ('capybara-alkkagi'),
  ('capybara-log-dodge');

-- 새 게임은 첫 입장 때 행이 자동 생성된다 (registry에 추가하면 끝, 시드 불필요)
create function public.record_game_visit(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_stats as s (slug, visit_count, last_visited_at)
  values (p_slug, 1, now())
  on conflict (slug) do update
    set visit_count = s.visit_count + 1,
        last_visited_at = now();

  insert into public.game_visits (slug) values (p_slug);
end;
$$;

revoke execute on function public.record_game_visit(text) from public, anon, authenticated;
grant execute on function public.record_game_visit(text) to anon, authenticated;
