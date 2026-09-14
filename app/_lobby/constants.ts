/** 말풍선 한 줄 최대 글자 폭(px) */
export const BUBBLE_TEXT_WIDTH = 160;
/** 말풍선 줄 높이(px) */
export const BUBBLE_LINE = 16;
/** 말풍선 안 카피바라 이모티콘 그림 크기(px) */
export const EMOTE_SIZE = 60;
/** 채팅 알약의 이모티콘 버튼에 보이는 이모티콘 번호 (선글라스 카피바라) */
export const EMOTE_PICKER_ICON = 3;
/** 이모티콘 창 한 쪽에 보이는 개수 (4×2). 세로로 넘기면 다음 쪽 */
export const EMOTES_PER_PAGE = 8;
/** 앉기·때리기 버튼과 같은 나무 테두리 (punch.webp에서 테두리만 오려낸 그림). 프로필·효과음 원 위에 덮는다 */
export const FRAME_SRC = "/assets/images/ui/lobby/frame.webp";
/** 물가에서 뜨는 낚시 버튼 그림 (나무 테·펠트 판 위 낚싯대와 찌) */
export const FISH_BUTTON_SRC = "/assets/images/ui/lobby/fish.webp";
/** 오른쪽 위 낚시 가방 버튼 그림 (나무 테·펠트 판 위 잎 바구니) */
export const FISH_BAG_SRC = "/assets/images/ui/lobby/fish-bag.webp";
/** 단축키(F·Space·P·M)로 누른 버튼에 hover 아이콘을 잠깐 띄우는 시간(ms) */
export const SHORTCUT_FLASH_MS = 300;

/** \ 키 조작법 창에 그리는 키보드 글자 줄 (Space·방향키 줄은 창에서 따로 그린다) */
export const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"],
] as const;

/** 조작법 창의 키별 설명. 여기 있는 키가 키보드 그림에서 강조된다 */
export const LOBBY_KEY_GUIDE = [
  { keys: ["W", "A", "S", "D", "↑", "←", "↓", "→"], label: "걷기" },
  { keys: ["F", "J"], label: "때리기" },
  { keys: ["Space"], label: "통나무 앞에서 앉기 · 물가에서 계속 낚시(한 번 더 누르면 그만)" },
  { keys: ["Enter"], label: "채팅 · 오두막 문 앞이면 바로 입장" },
  { keys: [","], label: "이모티콘" },
  { keys: ["P"], label: "프로필(옷장)" },
  { keys: ["I"], label: "낚시 가방" },
  { keys: ["M"], label: "소리 켜고 끄기" },
  { keys: ["Esc"], label: "채팅 멈추기 · 창 닫기" },
  { keys: ["\\"], label: "이 조작법 창 열고 닫기" },
] as const;

/** 로비 하단에 늘 보이는 사이트 정보 링크 (애드센스 심사에서 찾을 수 있어야 한다) */
export const SITE_LINKS = [
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/guestbook", label: "방명록" },
  { href: "/contact", label: "문의" },
] as const;
