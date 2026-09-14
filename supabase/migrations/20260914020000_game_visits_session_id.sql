-- 입장 기록에 session_id(브라우저 탭 단위 UUID, sessionStorage) 추가. 로그인이 생기면 user_id를 따로 붙인다

alter table public.game_visits add column session_id uuid not null;

create index game_visits_session_id_idx on public.game_visits (session_id);

drop function public.record_game_visit(text);

create function public.record_game_visit(p_slug text, p_session_id uuid)
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

  insert into public.game_visits (game_id, session_id) values (v_game_id, p_session_id);
end;
$$;

revoke execute on function public.record_game_visit(text, uuid) from public, anon, authenticated;
grant execute on function public.record_game_visit(text, uuid) to anon, authenticated;
