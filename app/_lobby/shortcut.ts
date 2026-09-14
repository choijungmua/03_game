/** 로비 단축키(P 프로필·M 소리·, 이모티콘)로 처리할 키인지. 채팅 입력 중·약관 패널이 열린 중·조합키(Ctrl·Cmd·Alt)·꾹 눌러 반복되는 입력은 무시한다 */
export function isShortcutKey(event: KeyboardEvent, code: string) {
  if (event.code !== code || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  return !(event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable], dialog[open]"));
}
