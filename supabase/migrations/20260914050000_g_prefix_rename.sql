-- 게임 관련 DB 객체 이름을 g_ 접두사로 통일: g_game, g_visit, g_record, g_share / RPC g_add_*
-- 공유 수 컬럼(share_count)은 두지 않는다. 공유 수는 g_share 행 수로 센다

alter table public.games rename to g_game;
alter table public.game_visits rename to g_visit;
alter table public.game_records rename to g_record;
alter table public.game_shares rename to g_share;

alter table public.g_game drop column share_count;

alter index public.game_visits_game_id_visited_at_idx rename to g_visit_game_id_visited_at_idx;
alter index public.game_visits_session_id_idx rename to g_visit_session_id_idx;
alter index public.game_records_game_id_score_idx rename to g_record_game_id_score_idx;
alter index public.game_records_session_id_idx rename to g_record_session_id_idx;
alter index public.game_shares_game_id_shared_at_idx rename to g_share_game_id_shared_at_idx;
alter index public.game_shares_session_id_idx rename to g_share_session_id_idx;

drop function public.record_game_visit(text, uuid);
drop function public.submit_game_record(text, uuid, numeric, jsonb);
drop function public.record_game_share(text, uuid, text);

create function public.g_add_visit(p_slug text, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
begin
  update public.g_game
    set visit_count = visit_count + 1,
        last_visited_at = now()
    where slug = p_slug
    returning id into v_game_id;

  if v_game_id is null then
    return;
  end if;

  insert into public.g_visit (game_id, session_id) values (v_game_id, p_session_id);
end;
$$;

create function public.g_add_record(p_slug text, p_session_id uuid, p_score numeric, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id bigint;
begin
  select id into v_game_id from public.g_game where slug = p_slug;

  if v_game_id is null then
    return;
  end if;

  insert into public.g_record (game_id, session_id, score, data)
  values (v_game_id, p_session_id, p_score, p_data);
end;
$$;

create function public.g_add_share(p_slug text, p_session_id uuid, p_method text)
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

  select id into v_game_id from public.g_game where slug = p_slug;

  if v_game_id is null then
    return;
  end if;

  insert into public.g_share (game_id, session_id, method) values (v_game_id, p_session_id, p_method);
end;
$$;

revoke execute on function public.g_add_visit(text, uuid) from public, anon, authenticated;
revoke execute on function public.g_add_record(text, uuid, numeric, jsonb) from public, anon, authenticated;
revoke execute on function public.g_add_share(text, uuid, text) from public, anon, authenticated;
grant execute on function public.g_add_visit(text, uuid) to anon, authenticated;
grant execute on function public.g_add_record(text, uuid, numeric, jsonb) to anon, authenticated;
grant execute on function public.g_add_share(text, uuid, text) to anon, authenticated;
