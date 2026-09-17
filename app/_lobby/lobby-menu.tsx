"use client";

import { Menu, X } from "lucide-react";
import NextImage from "next/image";
import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useEffect, useRef, useState } from "react";

import { cn } from "@/lib";

import { PROFILE_BUTTON_SRC } from "./constants";
import { isShortcutKey } from "./shortcut";

type LobbyMenuProps = {
  readonly name: string;
  readonly children: ReactNode;
};

type LobbyPanelId = "wardrobe" | "fish" | "sound" | "profile";
type LobbyMenuPanelState = {
  active: LobbyPanelId | null;
  host: HTMLDivElement | null;
  setActive: Dispatch<SetStateAction<LobbyPanelId | null>>;
};

const LobbyMenuPanelContext = createContext<LobbyMenuPanelState | null>(null);

export function useLobbyMenuPanel(id: LobbyPanelId) {
  const context = useContext(LobbyMenuPanelContext);
  const open = context?.active === id;
  const setOpen: Dispatch<SetStateAction<boolean>> = (next) => {
    if (!context) return;
    const value = typeof next === "function" ? next(open) : next;
    context.setActive(value ? id : null);
  };
  return { open, panelHost: context?.host ?? null, setOpen };
}

export function LobbyMenu({ name, children }: LobbyMenuProps) {
  const [open, setOpen] = useState(false);
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const [activePanel, setActivePanel] = useState<LobbyPanelId | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const close = () => {
    setActivePanel(null);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (open && event.key === "Tab") {
        const controls = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href]") ?? [],
        ).filter((control) => !control.closest("[inert]"));
        if (controls.length === 0) return;
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
      if (["KeyP", "KeyI", "KeyM"].some((code) => isShortcutKey(event, code))) setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

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
          "group pointer-events-auto relative block size-14 touch-manipulation rounded-full focus-visible:outline-2 focus-visible:outline-primary md:size-18",
          open && "pointer-events-none opacity-0",
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

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 z-[-1] bg-overlay/45 opacity-0 transition-opacity duration-200 motion-reduce:transition-none md:hidden",
          open && "opacity-100",
        )}
      />

      <section
        id="lobby-menu-panel"
        role="dialog"
        ref={panelRef}
        aria-modal="true"
        aria-labelledby="lobby-menu-title"
        inert={!open}
        className={cn(
          "pointer-events-auto fixed inset-x-0 top-0 flex max-h-[min(38rem,calc(100dvh-env(safe-area-inset-bottom)))] origin-top flex-col gap-4 overflow-hidden rounded-b-2xl border border-border-default bg-card p-4 pt-[max(1rem,env(safe-area-inset-top))] text-text-strong shadow-lg transition-opacity duration-200 ease-out motion-reduce:transition-none",
          "md:absolute md:inset-auto md:right-0 md:top-0 md:max-h-[calc(100dvh-1.5rem)] md:w-96 md:rounded-2xl md:p-4",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="lobby-menu-title" className="text-title-3 font-bold text-text-strong">
              내 카피바라
            </h2>
            <p className="truncate text-caption-1 text-text-caption">{name || "이름을 정해 주세요"}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="닫기"
            className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-text-caption hover:bg-muted hover:text-text-strong focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <LobbyMenuPanelContext.Provider value={{ active: activePanel, host: panelHost, setActive: setActivePanel }}>
          <div className="grid shrink-0 grid-cols-4 items-start gap-2">{children}</div>
        </LobbyMenuPanelContext.Provider>
        <div ref={setPanelHost} className="min-h-0 overflow-hidden empty:hidden" />
      </section>
    </div>
  );
}
