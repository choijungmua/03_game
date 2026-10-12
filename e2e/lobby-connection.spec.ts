import type { Page, WebSocketRoute } from '@playwright/test';
import type { LobbyMessage, PresenceRequest } from '@/lib/lobby/presence';
import { createWorld, LOBBY_SEED, playerBodyBlocked } from '@/lib/lobby/world';
import { GAMES } from '@/lib/games/registry';
import { LIST_ONLY_GAMES } from '@/lib/games/constants';
import { expect, test } from './support';

const world = createWorld(LOBBY_SEED, GAMES.filter((game) => !LIST_ONLY_GAMES.includes(game.slug)).map(({ slug, title }) => ({ slug, title })));
function corridor() {
  for (let y = 1200; y < 2600; y += 48) {
    for (let x = -1800; x < 1800; x += 48) {
      if (Array.from({ length: 60 }, (_, step) => x - 16 + step * 16).every((px) => !playerBodyBlocked(world.blockedAt, { x: px, y }))) return { x, y };
    }
  }
  throw new Error('Missing walkable test corridor');
}

function reply(request: PresenceRequest, corrected = false): LobbyMessage {
  return { you: { ...request, id: 'me', name: '테스트바라', stunMs: 0, attackMs: 0, chat: '', chatMs: 0 }, players: [], online: 1, hit: null, corrected, ...(request.sequence !== undefined && { ack: request.sequence }) };
}

const canvas = (page: Page) => page.getByRole('img', { name: /카피바라 온천 습지 마을 로비/ });
const xOf = async (page: Page) => Number(await canvas(page).getAttribute('data-player-x'));

async function start(page: Page) {
  await page.route('**/api/**', (route) => route.fulfill({ json: { ok: true } }));
  const point = corridor();
  await page.addInitScript((position) => sessionStorage.setItem('lobby-position-v3', JSON.stringify(position)), point);
  await page.goto('/?lobby-geometry-test=1');
  await expect(canvas(page)).toHaveAttribute('data-player-x', /-?\d/);
  return point;
}

for (const legacy of [false, true]) {
  test(`delayed ${legacy ? 'legacy' : 'acknowledged'} correction does not rewind normal walking`, async ({ page }) => {
    let held: { socket: WebSocketRoute; request: PresenceRequest } | undefined;
    await page.routeWebSocket(/\/api\/lobby\/ws/, (socket) => socket.onMessage((raw) => {
      const request: PresenceRequest = JSON.parse(String(raw));
      held ??= { socket, request };
    }));
    const origin = await start(page);
    await expect.poll(() => Boolean(held)).toBe(true);
    await page.keyboard.down('ArrowRight');
    await expect.poll(() => xOf(page)).toBeGreaterThan(origin.x + 260);
    await page.keyboard.up('ArrowRight');
    const before = await xOf(page);
    if (!held) throw new Error('Missing initial request');
    const message = reply({ ...held.request, x: held.request.x - 8 }, true);
    if (legacy) delete message.ack;
    held.socket.send(JSON.stringify(message));
    await expect(page.getByText('테스트바라', { exact: true }).first()).toBeVisible();
    await expect.poll(() => xOf(page)).toBeGreaterThanOrEqual(before - 16);
  });
}

test('an open socket with no replies reconnects and registers the current position', async ({ page }) => {
  await page.addInitScript(() => {
    const sockets: WebSocket[] = [];
    Object.defineProperty(window, '__lobbyTestSockets', { value: sockets });
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).includes('/api/lobby/ws')) sockets.push(this);
      }
    };
  });
  let connections = 0;
  let recovered: PresenceRequest | undefined;
  await page.routeWebSocket(/\/api\/lobby\/ws/, (socket) => {
    const index = ++connections;
    socket.onMessage((raw) => {
      const request: PresenceRequest = JSON.parse(String(raw));
      if (index === 1) return;
      recovered = request;
      socket.send(JSON.stringify(reply(request)));
    });
  });
  const origin = await start(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => xOf(page)).toBeGreaterThan(origin.x + 260);
  await page.keyboard.up('ArrowRight');
  await expect.poll(() => connections, { timeout: 17_000 }).toBe(2);
  await expect.poll(() => recovered?.x).toBeGreaterThan(origin.x + 260);
  expect(Math.abs((recovered?.x ?? 0) - await xOf(page))).toBeLessThan(16);
  await page.evaluate(() => {
    const sockets: unknown = Reflect.get(window, '__lobbyTestSockets');
    if (!Array.isArray(sockets) || !(sockets[0] instanceof WebSocket)) throw new Error('Missing old socket');
    sockets[0].dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ you: { x: 0, y: 0, name: '낡은 연결' }, players: [], corrected: true }) }));
    sockets[0].dispatchEvent(new CloseEvent('close', { code: 1006 }));
    sockets[0].dispatchEvent(new Event('open'));
  });
  await page.waitForTimeout(1500);
  expect(connections).toBe(2);
  await expect(page.getByText('낡은 연결', { exact: true })).toHaveCount(0);
});

test('healthy idle heartbeats do not reconnect', async ({ page }) => {
  let connections = 0;
  let requests = 0;
  await page.routeWebSocket(/\/api\/lobby\/ws/, (socket) => {
    connections++;
    socket.onMessage((raw) => {
      requests++;
      socket.send(JSON.stringify(reply(JSON.parse(String(raw)))));
    });
  });
  await start(page);
  await expect.poll(() => requests, { timeout: 18_000 }).toBeGreaterThanOrEqual(4);
  expect(connections).toBe(1);
});

test('a genuine correction preserves later movement and is not applied twice', async ({ page }) => {
  const held: { socket: WebSocketRoute; request: PresenceRequest }[] = [];
  await page.routeWebSocket(/\/api\/lobby\/ws/, (socket) => socket.onMessage((raw) => held.push({ socket, request: JSON.parse(String(raw)) })));
  const origin = await start(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => xOf(page)).toBeGreaterThan(origin.x + 260);
  await page.keyboard.up('ArrowRight');
  const before = await xOf(page);
  const first = held[0];
  const second = held[1];
  if (!first || !second) throw new Error('Missing movement requests');
  first.socket.send(JSON.stringify(reply({ ...first.request, x: first.request.x + 200 }, true)));
  await expect.poll(() => xOf(page)).toBeGreaterThanOrEqual(before + 195);
  const corrected = await xOf(page);
  first.socket.send(JSON.stringify(reply({ ...first.request, x: first.request.x + 200 }, true)));
  second.socket.send(JSON.stringify(reply({ ...second.request, x: second.request.x + 200 }, true)));
  await page.waitForTimeout(150);
  expect(Math.abs(await xOf(page) - corrected)).toBeLessThan(8);
});

for (const fault of ['connecting', 'backpressure'] as const) {
  test(`recovers a socket stuck in ${fault}`, async ({ page }) => {
    await page.addInitScript((mode) => {
      const NativeWebSocket = window.WebSocket;
      let first = true;
      window.WebSocket = class extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          if (first && String(url).includes('/api/lobby/ws')) {
            first = false;
            const property = mode === 'connecting' ? 'readyState' : 'bufferedAmount';
            Object.defineProperty(this, property, { configurable: true, get: () => mode === 'connecting' ? NativeWebSocket.CONNECTING : 300_000, set: () => undefined });
          }
        }
      };
    }, fault);
    let connections = 0;
    await page.routeWebSocket(/\/api\/lobby\/ws/, (socket) => {
      connections++;
      socket.onMessage((raw) => socket.send(JSON.stringify(reply(JSON.parse(String(raw))))));
    });
    await start(page);
    await expect.poll(() => connections, { timeout: 17_000 }).toBe(2);
    await expect(page.getByText('테스트바라', { exact: true }).first()).toBeVisible();
  });
}
