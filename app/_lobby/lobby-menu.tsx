"use client";

import { Menu, X } from "lucide-react";
import NextImage from "next/image";
import { createContext, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useContext, useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "@/lib";

import { LOBBY_MENU_TABS, type LobbyPanelId, PROFILE_BUTTON_SRC } from "./constants";
import { isShortcutKey, trapDialogFocus } from "./shortcut";

type LobbyMenuProps = {
  readonly name: string;
  /** 탭마다 보여 줄 패널 내용 */
  readonly panels: Record<LobbyPanelId, ReactNode>;
};

type LobbyMenuState = {
  open: boolean;
  active: LobbyPanelId;
  openTab: (id: LobbyPanelId) => void;
};

const LobbyMenuContext = createContext<LobbyMenuState | null>(null);

/** 패널 안에서 쓴다: 지금 이 탭이 보이는지(메뉴가 열려 있고 선택된 탭), 이 탭을 여는 함수 */
export function useLobbyMenuPanel(id: LobbyPanelId) {
  const context = useContext(LobbyMenuContext);
  return { open: context?.open === true && context.active === id, openTab: () => context?.openTab(id) };
}

const tabId = (id: LobbyPanelId) => `lobby-menu-tab-${id}`;
const panelId = (id: LobbyPanelId) => `lobby-menu-panel-${id}`;

/**
 * 오른쪽 위 "내 카피바라" 메뉴. 카피바라 버튼 하나로 열고, 안에서는 옷장·가방·소리·이름 탭을 오간다.
 * 모바일은 아래에서 올라오는 시트, md 이상은 버튼 자리에서 펼쳐지는 카드. 탭 줄은 엄지가 닿는 맨 아래에 두고 내용은 그 위에 쌓는다.
 * 높이는 보이는 탭 내용만큼이고, 화면보다 길면 내용 영역 안에서만 스크롤된다
 */
export function LobbyMenu({ name, panels }: LobbyMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<LobbyPanelId>("wardrobe");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef(new Map<LobbyPanelId, HTMLButtonElement>());
  const activeIndex = LOBBY_MENU_TABS.findIndex((tab) => tab.id === active);

  const openTab = (id: LobbyPanelId) => {
    setActive(id);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (open && event.key === "Escape") {
      close();
      return;
    }
    const tab = LOBBY_MENU_TABS.find((item) => item.code && isShortcutKey(event, item.code));
    if (!tab) return;
    event.preventDefault();
    // 같은 탭 단축키를 한 번 더 누르면 닫는다
    if (open && active === tab.id) close();
    else openTab(tab.id);
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 열리면 선택된 탭으로 포커스 — 방향키로 바로 탭을 옮길 수 있다
  useEffect(() => {
    // 마우스·터치로 열었을 때 키보드용 테두리가 켜지지 않게 focusVisible: false (TS DOM 타입엔 아직 없어 더해 준다. 모르는 브라우저는 무시)
    const options: FocusOptions & { focusVisible?: boolean } = { preventScroll: true, focusVisible: false };
    if (open) tabRefs.current.get(active)?.focus(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열리는 순간에만 옮긴다 (단축키로 탭만 바꿀 땐 포커스를 뺏지 않는다)
  }, [open]);

  // WAI-ARIA 탭: ←→로 옮기면 바로 그 탭을 보여 준다 (Home·End는 처음·끝)
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const last = LOBBY_MENU_TABS.length - 1;
    const next =
      event.key === "ArrowRight" ? (activeIndex + 1) % (last + 1)
      : event.key === "ArrowLeft" ? (activeIndex + last) % (last + 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const id = LOBBY_MENU_TABS[next].id;
    setActive(id);
    tabRefs.current.get(id)?.focus();
  };

  return (
    <div className="pointer-events-none absolute right-[max(1.25rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-20">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="내 카피바라 메뉴"
        aria-expanded={open}
        aria-controls="lobby-menu-panel"
        className={cn(
          "group pointer-events-auto relative block size-14 touch-manipulation rounded-full transition-[opacity,scale] duration-150 focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-90 motion-reduce:transition-none md:size-18",
          open && "pointer-events-none scale-75 opacity-0",
        )}
      >
        <NextImage src={PROFILE_BUTTON_SRC} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
        <span
          aria-hidden
          className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          <Menu className="size-6 md:size-7" />
        </span>
      </button>

      {/* 모바일은 시트 아래 맵을 어둡게 덮고, 누르면 닫힌다 */}
      <div
        aria-hidden="true"
        onClick={close}
        className={cn(
          "fixed inset-0 z-[-1] bg-overlay/45 opacity-0 transition-opacity duration-200 motion-reduce:transition-none md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none",
        )}
      />

      <section
        id="lobby-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-menu-title"
        inert={!open}
        onKeyDown={(event) => trapDialogFocus(event, event.currentTarget)}
        className={cn(
          "pointer-events-auto fixed inset-x-0 bottom-0 flex max-h-[calc(100dvh-4.5rem)] flex-col gap-3 overflow-hidden rounded-t-3xl border-t border-border-default bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-text-strong shadow-xl backdrop-blur-md transition-[opacity,translate,scale] duration-200 ease-out motion-reduce:transition-none",
          "md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-0 md:max-h-[calc(100dvh-1.5rem)] md:w-[25rem] md:origin-top-right md:rounded-3xl md:border md:p-4",
          open ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0 md:translate-y-0 md:scale-95",
        )}
      >
        {/* 아래에서 올라온 시트라는 표시 (모바일만). 끌지는 않고 보기용 */}
        <span aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border-default md:hidden" />

        <header className="flex min-w-0 items-center gap-3">
          <NextImage src={PROFILE_BUTTON_SRC} alt="" width={96} height={96} unoptimized draggable={false} className="size-10 shrink-0 drop-shadow-sm" />
          <div className="min-w-0 flex-1">
            <h2 id="lobby-menu-title" className="text-title-3 font-bold leading-tight text-text-strong">
              내 카피바라
            </h2>
            <p className="truncate text-caption-1 text-text-caption">{name || "이름을 정해 주세요"}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-muted text-text-caption transition-[background-color,color,scale] duration-150 hover:bg-border-default hover:text-text-strong focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-90 motion-reduce:transition-none"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <LobbyMenuContext.Provider value={{ open, active, openTab }}>
          {/* 선택된 패널만 보인다. 시트·카드는 내용 높이만큼만 커지고(탭 줄 위치는 그대로), 화면보다 길면 이 안에서만 스크롤된다 */}
          <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-1">
            {LOBBY_MENU_TABS.map((tab) => (
              <div key={tab.id} id={panelId(tab.id)} role="tabpanel" aria-labelledby={tabId(tab.id)} hidden={tab.id !== active}>
                {panels[tab.id]}
              </div>
            ))}
          </div>
        </LobbyMenuContext.Provider>
        {/* 맨 아래 탭 줄. 알약 트랙 위를 판(선택 표시)이 미끄러진다 — 판은 탭 한 칸 폭이라 translateX 100%씩 옮기면 된다 */}
        <div role="tablist" aria-label="메뉴 탭" onKeyDown={onTabKeyDown} className="relative grid shrink-0 grid-cols-4 rounded-2xl bg-muted p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-xl bg-card shadow-md ring-1 ring-border-default transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {LOBBY_MENU_TABS.map((tab) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  if (element) tabRefs.current.set(tab.id, element);
                  else tabRefs.current.delete(tab.id);
                }}
                id={tabId(tab.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(tab.id)}
                aria-label={tab.title}
                aria-keyshortcuts={tab.shortcut ?? undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "group relative flex min-h-[4.25rem] min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl text-caption-2 font-semibold transition-[color,scale] duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-95 motion-reduce:transition-none",
                  selected ? "text-text-strong" : "text-text-caption hover:text-text-strong",
                )}
              >
                <NextImage
                  src={tab.icon}
                  alt=""
                  width={96}
                  height={96}
                  unoptimized
                  draggable={false}
                  className={cn(
                    "size-10 drop-shadow-sm transition-[scale,opacity,filter] duration-200 motion-reduce:transition-none",
                    selected ? "scale-110" : "opacity-55 saturate-50 group-hover:opacity-100 group-hover:saturate-100",
                  )}
                />
                <span aria-hidden>{tab.label}</span>
              </button>
            );
          })}
        </div>

      </section>
    </div>
  );
}
