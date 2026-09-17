import { SHORTCUT_FLASH_MS } from "./constants";

type DialogKeyEvent = Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">;

export function trapDialogFocus(event: DialogKeyEvent, dialog: HTMLElement) {
  if (event.key !== "Tab") return;
  const controls = dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href]");
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

/** 로비 단축키(P 프로필·M 소리·, 이모티콘)로 처리할 키인지. 채팅 입력 중·조합키(Ctrl·Cmd·Alt)·꾹 눌러 반복되는 입력은 무시한다 */
export function isShortcutKey(event: KeyboardEvent, code: string) {
  if (event.code !== code || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  return !(event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]"));
}

const flashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * 단축키로 누른 버튼에 hover와 같은 아이콘을 잠깐 띄운다. 요소에 data-flash를 붙였다 떼고, 아이콘은 group-data-flash로 보인다.
 * 연달아 누르면 마지막 입력부터 다시 센다. 게임 루프에서도 부르니 state 대신 DOM에 직접 쓴다
 */
export function flashButton(element: HTMLElement | null) {
  if (!element) return;
  clearTimeout(flashTimers.get(element));
  element.dataset.flash = "";
  flashTimers.set(
    element,
    setTimeout(() => {
      delete element.dataset.flash;
    }, SHORTCUT_FLASH_MS),
  );
}
