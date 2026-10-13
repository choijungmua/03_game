# 게임 운영 등록

새 게임 배포 전 코드 레지스트리와 운영 `g_game` 등록을 함께 확인한다. 등록되지 않은 게임은 방문·기록이 저장되지 않고 텔레메트리의 `game_id`가 비게 된다.

저장소 루트에서 서버용 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`가 있는 환경 파일을 사용한다. 비밀 키를 프런트엔드 환경 변수나 저장소에 넣지 않는다.

```powershell
node --env-file=<서버 환경 파일> scripts/games-sync.mjs
node --env-file=<서버 환경 파일> scripts/games-sync.mjs --apply
node --env-file=<서버 환경 파일> scripts/games-sync.mjs
```

기본 명령은 읽기 전용이며 누락이 있으면 종료 코드 1을 반환한다. `--apply`는 현재 게임 중 누락된 slug와 제목만 한 번에 삽입하고 중복은 무시한다. 기존 ID·제목·통계·이전 게임을 수정하거나 삭제하지 않는다. 마지막 검사에서 `missing: []`를 확인한다.

2026-10-13 운영 점검에서 런·배구·바라매치·수박 게임 4개의 누락을 발견했다. 이 등록은 이후 이벤트부터 적용되며 이미 게임 ID 없이 저장된 과거 이벤트를 추측해서 수정하지 않는다.
