-- 게임 한 판 기록(순위) 적재. score = 순위 기준 값(게임마다 높을수록/낮을수록 좋은지 다름), data = 기록 전체
-- 반응속도 ms(낮을수록 좋음), 클릭 스피드 count, 비행기 슈팅 score, 통나무 피하기 timeMs

create table public.game_records (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games (id) on delete restrict,
  session_id uuid not null,
  score numeric not null,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 4096),
  played_at timestamptz not null default now()
);

create index game_records_game_id_score_idx on public.game_records (game_id, score);
create index game_records_session_id_idx on public.game_records (session_id);

alter table public.game_records enable row level security;

create function public.submit_game_record(p_slug text, p_session_id uuid, p_score numeric, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
begin
  select id into v_game_id from public.games where slug = p_slug;

  if v_game_id is null then
    return;
  end if;

  insert into public.game_records (game_id, session_id, score, data)
  values (v_game_id, p_session_id, p_score, p_data);
end;
$$;

revoke execute on function public.submit_game_record(text, uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.submit_game_record(text, uuid, numeric, jsonb) to anon, authenticated;
