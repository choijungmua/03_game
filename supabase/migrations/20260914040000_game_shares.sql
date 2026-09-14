-- 게임 공유 수: games.share_count(기본 0) + game_shares(공유 1건 = 1행)
-- method: native(기기 공유 창으로 공유 완료) / clipboard(링크 복사 완료). 공유 창을 닫은 경우는 세지 않는다

alter table public.games add column share_count bigint not null default 0;

create table public.game_shares (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games (id) on delete restrict,
  session_id uuid not null,
  method text not null check (method in ('native', 'clipboard')),
  shared_at timestamptz not null default now()
);

create index game_shares_game_id_shared_at_idx on public.game_shares (game_id, shared_at desc);
create index game_shares_session_id_idx on public.game_shares (session_id);

alter table public.game_shares enable row level security;

create function public.record_game_share(p_slug text, p_session_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
begin
  if p_method not in ('native', 'clipboard') then
    return;
  end if;

  update public.games
    set share_count = share_count + 1
    where slug = p_slug
    returning id into v_game_id;

  if v_game_id is null then
    return;
  end if;

  insert into public.game_shares (game_id, session_id, method) values (v_game_id, p_session_id, p_method);
end;
$$;

revoke execute on function public.record_game_share(text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_game_share(text, uuid, text) to anon, authenticated;
