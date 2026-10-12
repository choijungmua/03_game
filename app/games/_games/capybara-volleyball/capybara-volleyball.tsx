"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { GameControls } from "@/components/games/game-controls";
import { Button } from "@/components/inputs/button";
import { API_URL } from "@/lib/api-url";
import { GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound } from "@/lib/lobby/settings";

import {
  BALL_R,
  botKeys,
  createGame,
  type GameEvent,
  GROUND,
  HEIGHT,
  KEY,
  NET_HALF,
  NET_TOP,
  NET_X,
  PLAYER_R,
  type Side,
  step,
  type VolleyState,
  WIDTH,
  WIN_SCORE,
} from "./logic";

const SLUG = "capybara-volleyball";
const WS_URL = `${API_URL.replace(/^http/, "ws")}/api/games/${SLUG}/ws`;
const STEP_MS = 1000 / 60;
const ASSET = "/assets/images/games/capybara-board";
const NAMES = ["갈색 카피바라", "흰 카피바라"] as const;

/** 왼쪽 선수 WASD + F(스파이크), 오른쪽 선수 방향키 + Enter. 혼자 할 때는 둘 다 내 선수 */
const LEFT_KEYS: Record<string, number> = { KeyA: KEY.left, KeyD: KEY.right, KeyW: KEY.up, KeyS: KEY.down, KeyF: KEY.hit, Space: KEY.hit };
const RIGHT_KEYS: Record<string, number> = {
  ArrowLeft: KEY.left,
  ArrowRight: KEY.right,
  ArrowUp: KEY.up,
  ArrowDown: KEY.down,
  Enter: KEY.hit,
};

type Mode =
  | { kind: "cpu" }
  | { kind: "local" }
  | { kind: "online"; side: Side | null; code: string | null; status: "connecting" | "waiting" | "playing" | "closed"; message?: string };

const SOUNDS: Record<GameEvent, readonly Parameters<typeof playGameSound>[0][]> = {
  bump: [GAME_SOUNDS.hit],
  spike: [GAME_SOUNDS.whoosh, GAME_SOUNDS.hit],
  wall: [GAME_SOUNDS.place],
  point: [GAME_SOUNDS.correct],
  win: [GAME_SOUNDS.success],
};

function play(events: GameEvent[]) {
  for (const event of new Set(events)) for (const layers of SOUNDS[event]) playGameSound(layers);
}

function draw(context: CanvasRenderingContext2D, state: VolleyState, sprites: (HTMLImageElement | null)[]) {
  const sky = context.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#7cc4f0");
  sky.addColorStop(1, "#cdeefd");
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = "#e9c98a";
  context.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
  context.fillStyle = "#c9a564";
  context.fillRect(0, GROUND, WIDTH, 3);
  // 네트
  context.fillStyle = "#6b4a2b";
  context.fillRect(NET_X - NET_HALF, NET_TOP, NET_HALF * 2, GROUND - NET_TOP);
  context.fillStyle = "#fff8e7";
  context.fillRect(NET_X - NET_HALF - 2, NET_TOP - 4, NET_HALF * 2 + 4, 6);

  const { ball } = state;
  // 그림자로 공이 떨어질 자리를 알 수 있게
  context.fillStyle = "rgba(80, 50, 20, 0.25)";
  for (const x of [ball.x, ...state.players.map((player) => player.x)]) {
    context.beginPath();
    context.ellipse(x, GROUND + 4, 20, 5, 0, 0, Math.PI * 2);
    context.fill();
  }
  state.players.forEach((player, side) => {
    const sprite = sprites[side];
    const size = PLAYER_R * 2.3;
    if (sprite?.complete && sprite.naturalWidth) context.drawImage(sprite, player.x - size / 2, player.y - size / 2, size, size);
    else {
      context.fillStyle = side === 0 ? "#8b5a2b" : "#f3ead8";
      context.beginPath();
      context.arc(player.x, player.y, PLAYER_R, 0, Math.PI * 2);
      context.fill();
    }
    if (player.spike > 0) {
      context.strokeStyle = "#ffcf33";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER_R + 4, 0, Math.PI * 2);
      context.stroke();
    }
  });
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#e05a3a";
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(ball.x - BALL_R, ball.y);
  context.quadraticCurveTo(ball.x, ball.y - BALL_R * 0.8, ball.x + BALL_R, ball.y);
  context.stroke();
}

export function CapybaraVolleyball() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [winner, setWinner] = useState<Side | null>(null);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<VolleyState>(createGame());
  const pressed = useRef(new Set<string>());
  const touchKeys = useRef(0);
  const remoteKeys = useRef(0);
  const socket = useRef<WebSocket | null>(null);
  /** 온라인 손님(오른쪽)으로 들어와 있는지. 손님만 키 입력을 보낸다 */
  const guest = useRef(false);
  /** 컴퓨터가 낙하 지점을 잘못 읽는 정도. 점수가 날 때마다 새로 정한다 */
  const botError = useRef(0);
  const sprites = useRef<(HTMLImageElement | null)[]>([null, null]);

  const online = mode?.kind === "online" ? mode : null;
  const playing = mode !== null && winner === null && (!online || online.status === "playing");
  useLockPageScroll(playing);

  useEffect(() => {
    sprites.current = ["stone-black", "stone-white"].map((name) => {
      const image = new Image();
      image.src = `${ASSET}/${name}.webp`;
      return image;
    });
  }, []);

  const keysOf = (map: Record<string, number>) => {
    let keys = 0;
    for (const code of pressed.current) keys |= map[code] ?? 0;
    return keys;
  };
  const myKeys = () => keysOf(LEFT_KEYS) | keysOf(RIGHT_KEYS) | touchKeys.current;

  function reset() {
    game.current = createGame();
    botError.current = 0;
    setScore([0, 0]);
    setWinner(null);
    setPaused(false);
  }

  function apply(state: VolleyState, events: GameEvent[]) {
    game.current = state;
    play(events);
    if (events.includes("point") || events.includes("win")) {
      setScore(state.score);
      botError.current = (Math.random() - 0.5) * 50;
    }
    if (state.winner !== null) setWinner(state.winner);
  }

  // 한 프레임: 혼자/같이 하기와 온라인 방장은 물리를 돌리고, 온라인 손님은 내 키만 보낸다
  const tick = useEffectEvent(() => {
    if (!mode || paused) return;
    const state = game.current;
    if (mode.kind === "online") {
      if (mode.status !== "playing") return;
      if (mode.side === 1) return;
      const { state: next, events } = step(state, [myKeys(), remoteKeys.current]);
      apply(next, events);
      socket.current?.send(JSON.stringify({ type: "state", state: next, events }));
      return;
    }
    const keys: [number, number] =
      mode.kind === "cpu" ? [myKeys(), botKeys(state, 1, botError.current)] : [keysOf(LEFT_KEYS) | touchKeys.current, keysOf(RIGHT_KEYS)];
    const { state: next, events } = step(state, keys);
    apply(next, events);
  });

  const render = useEffectEvent(() => {
    const context = canvas.current?.getContext("2d");
    if (context) draw(context, game.current, sprites.current);
  });

  useEffect(() => {
    if (!mode) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const loop = (now: number) => {
      // 탭을 오래 떠났다 오면 밀린 프레임을 한꺼번에 돌리지 않는다
      carry = Math.min(carry + now - last, STEP_MS * 5);
      last = now;
      while (carry >= STEP_MS) {
        tick();
        carry -= STEP_MS;
      }
      render();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  // 손님은 키가 바뀔 때만 보낸다 (이벤트 처리 중에만 부른다)
  function sendKeys() {
    if (guest.current && socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "input", keys: myKeys() }));
  }
  const sendKeysEvent = useEffectEvent(sendKeys);

  useEffect(() => {
    if (!mode) return;
    const handled = new Set([...Object.keys(LEFT_KEYS), ...Object.keys(RIGHT_KEYS)]);
    const down = (event: KeyboardEvent) => {
      if (!handled.has(event.code) || event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      pressed.current.add(event.code);
      sendKeysEvent();
    };
    const up = (event: KeyboardEvent) => {
      pressed.current.delete(event.code);
      sendKeysEvent();
    };
    const clear = () => pressed.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [mode]);

  function connect(code?: string) {
    socket.current?.close();
    reset();
    setCopied(false);
    setMode({ kind: "online", side: null, code: null, status: "connecting" });
    const ws = new WebSocket(code ? `${WS_URL}?code=${encodeURIComponent(code.trim().toUpperCase())}` : WS_URL);
    socket.current = ws;
    guest.current = false;
    const update = (patch: Partial<Extract<Mode, { kind: "online" }>>) =>
      setMode((current) => (current?.kind === "online" && socket.current === ws ? { ...current, ...patch } : current));
    ws.onmessage = (event) => {
      let message: { type?: string; code?: string; side?: Side; keys?: number; state?: VolleyState; events?: GameEvent[] };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === "room" && message.code) {
        guest.current = message.side === 1;
        update({ code: message.code, side: message.side ?? 0, status: message.side === 1 ? "playing" : "waiting" });
        window.history.replaceState(null, "", `?code=${message.code}`);
      } else if (message.type === "start") {
        playGameSound(GAME_SOUNDS.start);
        update({ status: "playing" });
      } else if (message.type === "input" && typeof message.keys === "number") {
        remoteKeys.current = message.keys;
      } else if (message.type === "state" && message.state) {
        apply(message.state, message.events ?? []);
      } else if (message.type === "restart") {
        reset();
      }
    };
    ws.onclose = (event) => {
      const reason =
        event.code === 4004
          ? "방을 찾을 수 없어요. 코드를 확인해 주세요"
          : event.code === 4009
            ? "이미 두 명이 들어간 방이에요"
            : event.code === 1013
              ? "지금 방이 너무 많아요. 잠시 후 다시 시도해 주세요"
              : "연결이 끊겼어요. 상대가 나갔거나 서버에 연결할 수 없어요";
      update({ status: "closed", message: reason });
    };
  }

  const joinFromUrl = useEffectEvent(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) connect(code);
  });
  useEffect(() => {
    // 초대 링크(?code=)로 들어오면 바로 참가. 한 틱 미뤄서, 개발 모드가 마운트를 두 번 돌릴 때
    // 첫 연결이 열렸다 닫히며 방을 끝내 버리지 않게 한다 (한 명이 나가면 방이 사라진다)
    const timer = setTimeout(joinFromUrl);
    return () => {
      clearTimeout(timer);
      socket.current?.close();
    };
  }, []);

  function start(next: Mode) {
    playGameSound(GAME_SOUNDS.start);
    reset();
    setMode(next);
  }

  function restart() {
    reset();
    playGameSound(GAME_SOUNDS.start);
    if (online) socket.current?.send(JSON.stringify({ type: "restart" }));
  }

  function toMenu() {
    socket.current?.close();
    socket.current = null;
    guest.current = false;
    setMode(null);
    reset();
    window.history.replaceState(null, "", window.location.pathname);
  }

  function copyInvite() {
    if (!online?.code) return;
    const link = `${window.location.origin}${window.location.pathname}?code=${online.code}`;
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(link))
      .then(() => setCopied(true), () => setCopied(false));
  }

  function pressTouch(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    touchKeys.current |= Number(event.currentTarget.dataset.bit);
    sendKeys();
  }
  function releaseTouch(event: ReactPointerEvent<HTMLButtonElement>) {
    touchKeys.current &= ~Number(event.currentTarget.dataset.bit);
    sendKeys();
  }
  const touchProps = { onPointerDown: pressTouch, onPointerUp: releaseTouch, onPointerLeave: releaseTouch, onPointerCancel: releaseTouch };

  if (!mode) {
    return (
      <div className="flex min-h-dvh w-dvw flex-col items-center justify-center bg-background px-4">
        <GameControls />
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-title-2 font-bold text-text-primary">{GAME_TITLES[SLUG]}</h1>
          <p className="text-body-2 text-text-alternative">네트 너머 상대 바닥에 공을 떨어뜨리면 1점, {WIN_SCORE}점을 먼저 내면 이겨요</p>
          <Button className="w-full" onClick={() => start({ kind: "cpu" })}>
            컴퓨터와 하기
          </Button>
          <Button className="w-full" variant="outline" onClick={() => start({ kind: "local" })}>
            한 키보드로 둘이 하기
          </Button>
          <Button className="w-full" variant="outline" onClick={() => connect()}>
            친구 초대하기 (온라인)
          </Button>
          <form
            className="flex w-full gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (joinCode.trim()) connect(joinCode);
            }}
          >
            <input
              aria-label="초대 코드"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              maxLength={4}
              placeholder="초대 코드"
              className="min-w-0 flex-1 rounded-lg border border-border-default bg-card px-3 text-body-2 text-text-primary"
            />
            <Button type="submit" variant="outline">
              참가
            </Button>
          </form>
          <ul className="text-caption-1 text-text-caption">
            <li>왼쪽: A·D 이동, W 점프, F 스파이크 (S 누르며 치면 꽂기)</li>
            <li>오른쪽: ←·→ 이동, ↑ 점프, Enter 스파이크 (↓ 누르며 치면 꽂기)</li>
            <li>혼자·온라인에서는 어느 키든, 휴대폰은 아래 버튼으로</li>
          </ul>
        </div>
      </div>
    );
  }

  const label = (side: Side) =>
    mode.kind === "cpu" ? (side === 0 ? "나" : "컴퓨터") : online ? (online.side === side ? "나" : "상대") : NAMES[side];
  const iWon = winner !== null && (mode.kind === "local" || winner === (online?.side ?? 0));

  return (
    <div className="relative flex h-dvh w-dvw touch-none flex-col items-center justify-center bg-[#7cc4f0] select-none">
      <GameControls
        leaveConfirm={online?.status === "playing" && winner === null ? "나가면 이 판이 끝나요. 나갈까요?" : undefined}
        pause={
          mode.kind !== "online" && winner === null
            ? { paused, onPause: () => setPaused(true), onResume: () => setPaused(false), onRestart: restart }
            : undefined
        }
      />
      <div className="pointer-events-none absolute top-3 flex gap-6 text-title-3 font-bold text-white drop-shadow">
        <span>
          {label(0)} {score[0]}
        </span>
        <span>
          {score[1]} {label(1)}
        </span>
      </div>
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        aria-label="카피바라 배구 코트"
        className="max-h-full w-full object-contain [image-rendering:auto]"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      />

      {mode.kind !== "local" && (
        <div className="absolute inset-x-0 bottom-4 flex justify-between px-4 sm:hidden">
          <div className="flex gap-3">
            <button type="button" aria-label="왼쪽" className={TOUCH} data-bit={KEY.left} {...touchProps}>
              ←
            </button>
            <button type="button" aria-label="오른쪽" className={TOUCH} data-bit={KEY.right} {...touchProps}>
              →
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" aria-label="스파이크" className={TOUCH} data-bit={KEY.hit | KEY.down} {...touchProps}>
              💥
            </button>
            <button type="button" aria-label="점프" className={TOUCH} data-bit={KEY.up} {...touchProps}>
              ↑
            </button>
          </div>
        </div>
      )}

      {online && online.status !== "playing" && (
        <Overlay>
          {online.status === "connecting" && <p className="text-body-1 text-text-primary">연결하는 중…</p>}
          {online.status === "waiting" && (
            <>
              <p className="text-body-2 text-text-alternative">친구에게 코드를 알려주세요</p>
              <p className="text-title-1 font-bold tracking-widest text-text-primary">{online.code}</p>
              <Button onClick={copyInvite}>{copied ? "링크를 복사했어요" : "초대 링크 복사"}</Button>
              <p className="text-caption-1 text-text-caption">친구가 들어오면 바로 시작해요</p>
            </>
          )}
          {online.status === "closed" && <p className="text-body-1 text-text-primary">{online.message}</p>}
          <Button variant="outline" onClick={toMenu}>
            메뉴로
          </Button>
        </Overlay>
      )}

      {winner !== null && (
        <Overlay>
          <p className="text-title-2 font-bold text-text-primary">
            {mode.kind === "local" ? `${NAMES[winner]} 승리!` : iWon ? "이겼어요!" : "졌어요"}
          </p>
          <p className="text-body-1 text-text-alternative">
            {score[0]} : {score[1]}
          </p>
          {(!online || online.side === 0) && online?.status !== "closed" && <Button onClick={restart}>다시 하기</Button>}
          {online?.side === 1 && <p className="text-caption-1 text-text-caption">방장이 다시 하기를 누르면 시작해요</p>}
          <Button variant="outline" onClick={toMenu}>
            메뉴로
          </Button>
          <div className="mt-6 w-full">
            <AdSlot placement="game-over" />
          </div>
        </Overlay>
      )}
    </div>
  );
}

const TOUCH = "size-16 rounded-full bg-black/25 text-title-2 text-white active:bg-black/40";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-background/90 p-6 text-center shadow-lg backdrop-blur">
        {children}
      </div>
    </div>
  );
}
