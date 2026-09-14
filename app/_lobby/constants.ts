/** 말풍선 한 줄 최대 글자 폭(px) */
export const BUBBLE_TEXT_WIDTH = 160;
/** 말풍선 줄 높이(px) */
export const BUBBLE_LINE = 16;
/** 말풍선 안 카피바라 이모티콘 그림 크기(px) */
export const EMOTE_SIZE = 60;
/** 채팅 알약의 이모티콘 버튼에 보이는 이모티콘 번호 (선글라스 카피바라) */
export const EMOTE_PICKER_ICON = 3;
/** 앉기·때리기 버튼과 같은 나무 테두리 (punch.webp에서 테두리만 오려낸 그림). 프로필·효과음 원 위에 덮는다 */
export const FRAME_SRC = "/assets/images/ui/lobby/frame.webp";
/** 단축키(F·Space·P·M)로 누른 버튼에 hover 아이콘을 잠깐 띄우는 시간(ms) */
export const SHORTCUT_FLASH_MS = 300;

/** 로비 하단에 늘 보이는 사이트 정보 링크 (애드센스 심사에서 찾을 수 있어야 한다) */
export const SITE_LINKS = [
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/contact", label: "문의" },
] as const;
