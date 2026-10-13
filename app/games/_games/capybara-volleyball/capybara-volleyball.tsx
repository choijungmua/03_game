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
  PLAYER_Y,
  type Side,
  step,
  type VolleyState,
  WIDTH,
  WIN_SCORE,
} from "./logic";

const SLUG = "capybara-volleyball";
const WS_URL = `${API_URL.replace(/^http/, "ws")}/api/games/${SLUG}/ws`;
const STEP_MS = 1000 / 60;
const ASSET = "/assets/images/games/capybara-volleyball";
const POSES = ["ready", "jump", "spike", "dive"] as const;
type Pose = (typeof POSES)[number];
const IMAGES = ["court", "net", "ball", ...["brown", "white"].flatMap((color) => POSES.map((pose) => `${color}-${pose}`))];
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
  jump: [],
  land: [],
  dive: [GAME_SOUNDS.whoosh],
  point: [GAME_SOUNDS.correct],
  win: [GAME_SOUNDS.success],
};

function play(events: GameEvent[]) {
  for (const event of new Set(events)) for (const layers of SOUNDS[event]) playGameSound(layers);
}

type Sprites = Record<string, HTMLImageElement>;
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}
/** 그리기 전용 연출 상태. 물리와 따로 두어 온라인 손님도 받은 상태·이벤트로 똑같이 만든다 */
interface Fx {
  shake: number;
  flash: number;
  spin: number;
  trail: { x: number; y: number }[];
  particles: Particle[];
  /** 선수별 찌그러짐 (1 착지 납작, -1 점프 길쭉) */
  squash: [number, number];
  /** 선수별 남은 스파이크 자세 프레임 */
  swing: [number, number];
}
const newFx = (): Fx => ({ shake: 0, flash: 0, spin: 0, trail: [], particles: [], squash: [0, 0], swing: [0, 0] });
const SAND = "#d9b877";

function burst(fx: Fx, x: number, y: number, count: number, color: string, speed: number, upOnly = true) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * (upOnly ? 1 : 2);
    const power = speed * (0.4 + Math.random() * 0.8);
    const max = 18 + Math.random() * 14;
    fx.particles.push({ x, y, vx: Math.cos(angle) * power, vy: -Math.sin(angle) * power, life: max, max, size: 2 + Math.random() * 3, color });
  }
}

/** 이번 프레임 이벤트로 흔들림·불꽃·모래·진동을 건다 */
function react(fx: Fx, state: VolleyState, prev: VolleyState, events: GameEvent[]) {
  const { ball } = state;
  for (const side of [0, 1] as const) {
    const player = state.players[side];
    const before = prev.players[side];
    if (before.y < PLAYER_Y && player.y >= PLAYER_Y) {
      fx.squash[side] = 1;
      burst(fx, player.x, GROUND, 6, SAND, 2);
    }
    if (before.y >= PLAYER_Y && player.y < PLAYER_Y) {
      fx.squash[side] = -1;
      burst(fx, player.x, GROUND, 4, SAND, 1.5);
    }
    if (player.dive > before.dive) burst(fx, player.x, GROUND, 10, SAND, 3);
  }
  if (events.includes("spike")) {
    fx.shake = 9;
    fx.flash = 1;
    fx.swing[ball.vx > 0 ? 0 : 1] = 16;
    burst(fx, ball.x, ball.y, 18, "#ffd23f", 5, false);
    burst(fx, ball.x, ball.y, 8, "#ffffff", 3.5, false);
    navigator.vibrate?.(30);
  } else if (events.includes("bump")) {
    fx.shake = Math.max(fx.shake, 2.5);
    burst(fx, ball.x, ball.y, 7, "#fff3c4", 2.5, false);
  }
  if (events.includes("point") || events.includes("win")) {
    fx.shake = Math.max(fx.shake, 6);
    burst(fx, ball.x, GROUND, 24, SAND, 4);
    navigator.vibrate?.(60);
  }
}

function poseOf(state: VolleyState, side: Side, fx: Fx): Pose {
  const player = state.players[side];
  if (player.dive > 0) return "dive";
  if (fx.swing[side] > 0) return "spike";
  return player.y < PLAYER_Y - 2 ? "jump" : "ready";
}

const loaded = (image: HTMLImageElement | undefined): image is HTMLImageElement => Boolean(image?.complete && image.naturalWidth);

function draw(context: CanvasRenderingContext2D, state: VolleyState, sprites: Sprites, fx: Fx) {
  context.save();
  if (fx.shake > 0.3) context.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  fx.shake *= 0.85;

  // 흔들려도 가장자리가 비지 않게 배경을 조금 크게
  if (loaded(sprites.court)) context.drawImage(sprites.court, -8, -8, WIDTH + 16, HEIGHT + 16);
  else {
    context.fillStyle = "#9fd6f5";
    context.fillRect(-8, -8, WIDTH + 16, HEIGHT + 16);
    context.fillStyle = "#e9c98a";
    context.fillRect(-8, GROUND, WIDTH + 16, HEIGHT - GROUND + 8);
  }

  const { ball } = state;
  // 공이 떨어질 자리: 공이 낮을수록 크고 진하게
  const closeness = 1 - Math.min(1, Math.max(0, GROUND - ball.y) / GROUND);
  context.fillStyle = `rgba(80, 50, 20, ${0.12 + closeness * 0.25})`;
  context.beginPath();
  context.ellipse(ball.x, GROUND + 3, 8 + closeness * 12, 2 + closeness * 3, 0, 0, Math.PI * 2);
  context.fill();
  for (const player of state.players) {
    const lift = Math.min(1, (PLAYER_Y - player.y) / 120);
    context.fillStyle = `rgba(80, 50, 20, ${0.3 - lift * 0.15})`;
    context.beginPath();
    context.ellipse(player.x, GROUND + 3, 24 - lift * 8, 5 - lift * 2, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (loaded(sprites.net)) {
    const height = GROUND - NET_TOP + 18;
    const width = (sprites.net.naturalWidth / sprites.net.naturalHeight) * height;
    context.drawImage(sprites.net, NET_X - width / 2, NET_TOP - 14, width, height);
  } else {
    context.fillStyle = "#6b4a2b";
    context.fillRect(NET_X - NET_HALF, NET_TOP, NET_HALF * 2, GROUND - NET_TOP);
  }

  state.players.forEach((player, index) => {
    const side = index as Side;
    const sprite = sprites[`${side === 0 ? "brown" : "white"}-${poseOf(state, side, fx)}`];
    const squash = fx.squash[side];
    fx.squash[side] *= 0.78;
    fx.swing[side] = Math.max(0, fx.swing[side] - 1);
    const size = PLAYER_R * 2.8;
    context.save();
    context.translate(player.x, player.y + PLAYER_R);
    context.scale(1 + squash * 0.18, 1 - squash * 0.18);
    if (loaded(sprite)) context.drawImage(sprite, -size / 2, -size, size, size);
    else {
      context.fillStyle = side === 0 ? "#8b5a2b" : "#f3ead8";
      context.beginPath();
      context.arc(0, -PLAYER_R, PLAYER_R, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    // 스파이크 준비 중: 금빛 고리가 줄어들며 사라진다
    if (player.spike > 0) {
      context.strokeStyle = `rgba(255, 207, 51, ${player.spike / 14})`;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER_R + 2 + player.spike, 0, Math.PI * 2);
      context.stroke();
    }
  });

  // 공 잔상: 빠를수록 길고 뜨겁게
  const speed = Math.hypot(ball.vx, ball.vy);
  const fast = speed > 9;
  fx.trail.unshift({ x: ball.x, y: ball.y });
  fx.trail.length = Math.min(fx.trail.length, fast ? 8 : 3);
  fx.trail.forEach((point, index) => {
    if (index === 0) return;
    context.fillStyle = fast ? `rgba(255, 170, 50, ${0.4 - index * 0.045})` : `rgba(255, 255, 255, ${0.2 - index * 0.06})`;
    context.beginPath();
    context.arc(point.x, point.y, BALL_R * (1 - index * 0.08), 0, Math.PI * 2);
    context.fill();
  });
  fx.spin += ball.vx * 0.05;
  context.save();
  context.translate(ball.x, ball.y);
  context.rotate(fx.spin);
  if (loaded(sprites.ball)) context.drawImage(sprites.ball, -BALL_R, -BALL_R, BALL_R * 2, BALL_R * 2);
  else {
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#e05a3a";
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(0, 0, BALL_R, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();

  fx.particles = fx.particles.filter((particle) => {
    particle.life -= 1;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.15;
    context.globalAlpha = Math.max(0, particle.life / particle.max);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
    return particle.life > 0;
  });
  context.globalAlpha = 1;
  context.restore();

  if (fx.flash > 0.02) {
    context.fillStyle = `rgba(255, 255, 240, ${fx.flash * 0.35})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    fx.flash *= 0.7;
  }
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
  const sprites = useRef<Sprites>({});
  const fx = useRef<Fx>(newFx());
  /** 방금 점수 낸 쪽 (점수판 튀기기) */
  const [scored, setScored] = useState<Side | null>(null);

  const online = mode?.kind === "online" ? mode : null;
  const playing = mode !== null && winner === null && (!online || online.status === "playing");
  useLockPageScroll(playing);

  useEffect(() => {
    sprites.current = Object.fromEntries(
      IMAGES.map((name) => {
        const image = new Image();
        image.src = `${ASSET}/${name}.webp`;
        return [name, image];
      }),
    );
  }, []);

  const keysOf = (map: Record<string, number>) => {
    let keys = 0;
    for (const code of pressed.current) keys |= map[code] ?? 0;
    return keys;
  };
  const myKeys = () => keysOf(LEFT_KEYS) | keysOf(RIGHT_KEYS) | touchKeys.current;

  function reset() {
    game.current = createGame();
    fx.current = newFx();
    botError.current = 0;
    setScore([0, 0]);
    setWinner(null);
    setPaused(false);
  }

  function apply(state: VolleyState, events: GameEvent[]) {
    react(fx.current, state, game.current, events);
    game.current = state;
    play(events);
    if (events.includes("point") || events.includes("win")) {
      setScore(state.score);
      setScored(state.server);
      botError.current = (Math.random() - 0.5) * 24;
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
    if (context) draw(context, game.current, sprites.current, fx.current);
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
      <div
        className="flex min-h-dvh w-dvw flex-col items-center justify-center bg-[#9fd6f5] bg-cover bg-center px-4"
        style={{ backgroundImage: `url(${ASSET}/court.webp)` }}
      >
        <GameControls />
        <div className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col items-center gap-4 overflow-y-auto rounded-3xl bg-background/85 p-6 text-center shadow-lg backdrop-blur">
          <div className="flex items-end gap-2 [@media(max-height:520px)]:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- 투명 배경이 재인코딩에 깨지지 않게 그대로 쓴다 */}
            <img src={`${ASSET}/brown-spike.webp`} alt="" className="size-20 animate-bounce [animation-duration:1.4s]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSET}/ball.webp`} alt="" className="mb-10 size-8 animate-spin [animation-duration:3s]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSET}/white-ready.webp`} alt="" className="size-20" />
          </div>
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
            <li>땅에서 스파이크 키를 누르면 몸을 날려 낮은 공을 살려요</li>
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
    <div className="relative flex h-dvh w-dvw touch-none flex-col items-center justify-center select-none" style={{ background: COURT_FILL }}>
      <GameControls
        leaveConfirm={online?.status === "playing" && winner === null ? "나가면 이 판이 끝나요. 나갈까요?" : undefined}
        pause={
          mode.kind !== "online" && winner === null
            ? { paused, onPause: () => setPaused(true), onResume: () => setPaused(false), onRestart: restart }
            : undefined
        }
      />
      <div className="pointer-events-none absolute top-2 left-1/2 z-10 w-[clamp(7rem,22dvh,13rem)] -translate-x-1/2">
        <div className="relative aspect-[512/346] w-full bg-contain bg-no-repeat" style={{ backgroundImage: `url(${ASSET}/scoreboard.webp)` }}>
          {([0, 1] as const).map((side) => (
            <span
              key={`${side}-${score[side]}`}
              className={`absolute top-[36%] bottom-[19%] flex items-center justify-center text-[clamp(0.9rem,4dvh,1.6rem)] font-bold text-[#5a3a1e] tabular-nums ${side === 0 ? "left-[10%] right-[55%]" : "left-[55%] right-[11%]"} ${scored === side ? "animate-score-pop" : ""}`}
            >
              {score[side]}
            </span>
          ))}
        </div>
        <div className="flex text-caption-2 font-bold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
          <span className="flex-1 truncate text-center">{label(0)}</span>
          <span className="flex-1 truncate text-center">{label(1)}</span>
        </div>
      </div>
      <canvas
        ref={canvas}
        width={WIDTH}
        height={HEIGHT}
        aria-label="카피바라 배구 코트"
        className="max-h-full w-full object-contain [image-rendering:auto]"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      />

      <p className="pointer-events-none absolute bottom-28 hidden text-caption-1 font-bold text-[#7a5228] portrait:pointer-coarse:block">
        휴대폰을 가로로 돌리면 코트가 더 크게 보여요
      </p>

      {mode.kind !== "local" && (
        <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-between px-4 pointer-fine:hidden">
          <div className="flex gap-3">
            <button type="button" aria-label="왼쪽" className={TOUCH} data-bit={KEY.left} {...touchProps}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ASSET}/btn-left.webp`} alt="" draggable={false} className="size-full" />
            </button>
            <button type="button" aria-label="오른쪽" className={TOUCH} data-bit={KEY.right} {...touchProps}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ASSET}/btn-right.webp`} alt="" draggable={false} className="size-full" />
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" aria-label="스파이크" className={TOUCH} data-bit={KEY.hit | KEY.down} {...touchProps}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ASSET}/btn-spike.webp`} alt="" draggable={false} className="size-full" />
            </button>
            <button type="button" aria-label="점프" className={TOUCH} data-bit={KEY.up} {...touchProps}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ASSET}/btn-jump.webp`} alt="" draggable={false} className="size-full" />
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

/** 캔버스 높이(화면에 맞춰 줄어든)에서 모래 선 위치(그림 기준 83.5%)에 하늘·모래 경계를 둔다 */
const COURT_H = `min(100dvh, 100vw * ${HEIGHT / WIDTH})`;
const COURT_FILL = `linear-gradient(#6cc3f7 calc(50% + ${COURT_H} * 0.335), #f2b575 0)`;
const TOUCH = "size-18 [@media(max-height:520px)]:size-14 rounded-full opacity-90 drop-shadow-md transition-transform active:scale-90 active:brightness-90";

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl bg-background/90 p-6 text-center shadow-lg backdrop-blur">
        {children}
      </div>
    </div>
  );
}
