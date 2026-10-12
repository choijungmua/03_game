"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { GameControls } from "@/components/games/game-controls/game-controls";
import { Dialog } from "@/components/overlay/dialog";
import { Button } from "@/components/ui/button";
import { advanceGame, applyCommand, CELLS, CLASSES, createGame, DAMAGE_MATCHUPS, getCollectionProgress, getUnitPoint, getUnitStats, getUpgradeCost, getWaveInfo, KILL_MILESTONES, RARITIES, RULES, startGame } from "./engine";
import type { DefenseClass, DefenseCommand, DefenseState, DefenseUnit } from "./engine";
import { createDefenseRenderer } from "./renderer";
import { createDefenseAudio } from "./audio";
import { useDefenseTeam } from "./use-defense-team";
import { getDefenseReward, getNextDefenseGoal } from "./defense-feedback";
import { CAPYBARA_SPRITE, getBattlePressure, getDefenderVisual } from "./defense-visuals";
import styles from "./capybara-defense.module.css";

const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 4 });
const classLabel = (id: DefenseClass) => CLASSES.find(item => item.id === id)?.label ?? id;
const rarityLabel = (id: string) => RARITIES.find(item => item.id === id)?.label ?? id;
const unitLabel = (unit: DefenseUnit) => `${rarityLabel(unit.rarity)} ${classLabel(unit.classId)} #${unit.id}`;
const abilityLabel = { lockdown: "락다운", ensnare: "인스네어", emp: "EMP" };
const sizeLabel = { small: "소형", medium: "중형", large: "대형" };
type Panel = "commands" | "economy" | "collection" | "stats" | "team" | null;

export function CapybaraDefense({ seed }: Readonly<{ seed?: number }>) {
  const [solo, setSolo] = useState(() => createGame(seed ?? 1));
  const engine = useRef(solo);
  const team = useDefenseTeam();
  const [teamMode, setTeamMode] = useState(false);
  const state = team.view?.state ?? solo;
  const teamActive = teamMode || team.inRoom || team.view !== null || team.status === "connecting";
  const runtime = useRef({ state, teamActive });
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<ReturnType<typeof createDefenseAudio> | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const [additive, setAdditive] = useState(false);
  const [groups, setGroups] = useState<number[][]>([[], [], []]);
  const [panel, setPanel] = useState<Panel>(null);
  const [feedback, setFeedback] = useState("10원으로 뽑으면 중앙에 나타납니다. 수비대를 선택해 이동하세요.");
  const [reward, setReward] = useState<ReturnType<typeof getDefenseReward>>(null);
  const room = team.view?.code ?? null;
  useEffect(() => { if (!reward) return; const timer = setTimeout(() => setReward(null), 2400); return () => clearTimeout(timer); }, [reward]);
  const observed = useRef({ state, room, connection: team.status });
  const observeRewards = useEffectEvent(() => {
    const before = observed.current;
    observed.current = { state, room, connection: team.status };
    if (before.room !== room || before.connection !== team.status) setReward(null);
    else {
      const received = getDefenseReward(before.state, state);
      if (received) { setReward(received); const newest = received.units.at(-1); if (team.view?.mode === "survival" && newest) { selectedRef.current = [newest.id]; setSelectedIds([newest.id]); } }
    }
  });
  useEffect(() => { observeRewards(); }, [state, room, team.status]);
  const [saleOpen, setSaleOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [wasFinished, setWasFinished] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [exchangeClass, setExchangeClass] = useState<DefenseClass>("warrior");
  const [roomCode, setRoomCode] = useState("");
  const [x, setX] = useState("360");
  const [y, setY] = useState("240");
  const [gasAmount, setGasAmount] = useState("1");
  const retry = useRef<HTMLButtonElement>(null);
  const summonButton = useRef<HTMLButtonElement>(null);
  const saleButton = useRef<HTMLButtonElement>(null);
  const active = state.phase === "playing";
  const finished = state.phase === "won" || state.phase === "lost";
  if (finished !== wasFinished) {
    setWasFinished(finished);
    if (finished) { setPanel(null); setSaleOpen(false); }
  }
  const selected = state.units.find(unit => unit.id === selectedIds[0]);
  const stats = selected ? getUnitStats(state, selected) : null;
  const saleValue = RARITIES.find(item => item.id === selected?.rarity)?.sellGold ?? 0;
  const wave = getWaveInfo(state.round);
  const pressure = getBattlePressure(state.enemies.length, RULES.enemyLimit);
  const nextGoal = getNextDefenseGoal(state.round);
  const collections = getCollectionProgress(state);
  const readyCollections = collections.filter(collection => collection.ready).length;
  const rewardMessage = reward ? [
    reward.bossDefeated ? "보스 처치" : "",
    ...reward.milestones.map(kills => `${number.format(kills)}마리 처치 보상`),
    ...reward.collections.map(id => `${collections.find(collection => collection.id === id)?.label ?? id} 등록 완료`),
    ...reward.units.map(unit => `${unitLabel(unit)} 획득`),
    ...reward.tickets.map(ticket => `${rarityLabel(ticket.rarity)} 선택권 획득`),
    reward.units.length ? "전장 중앙에 등장 · 선택해 이동하세요." : "",
  ].filter(Boolean).join(" · ") : feedback;
  if (targetId && !state.enemies.some(enemy => String(enemy.id) === targetId && enemy.hp > 0)) setTargetId("");
  const bossDeadline = Math.min(...state.enemies.flatMap(enemy => enemy.deadlineMs === null ? [] : [enemy.deadlineMs]));
  const host = team.view !== null && team.view.you === team.view.host;
  const connected = (team.view?.players.length ?? 0) >= 2 && team.view?.players.every(player => player.connected);
  const ready = connected && team.view?.players.every(player => player.ready);
  const standing = team.view?.players.find(player => player.slot === team.view?.you);
  const matchFinished = team.view?.matchPhase === "finished";
  useEffect(() => { runtime.current = { state, teamActive }; }, [state, teamActive]);
  function publish(next: DefenseState) { engine.current = next; runtime.current.state = next; setSolo(next); }
  function select(ids: number[]) { setReward(null); selectedRef.current = ids; setSelectedIds(ids); }
  function choose(id: number, extend = additive) { select(extend ? selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id] : [id]); }
  function unlock() { audio.current ??= createDefenseAudio(); audio.current.unlock(); }
  function command(value: DefenseCommand, message = "명령을 실행했습니다.") {
    unlock();
    setReward(null);
    if (teamActive) { void team.send(value).then(() => setFeedback(message)).catch(() => setFeedback("명령을 보내지 못했어요. 연결 상태를 확인해 주세요.")); return; }
    const before = engine.current;
    const result = applyCommand(before, value);
    publish(result.state); setFeedback(result.error ?? message);
    const newest = result.state.units.at(-1);
    if ((value.type === "summon" || value.type === "ticket") && !result.error && newest) select([newest.id]);
    if (value.type === "exchange" && !result.error) {
      const prior = before.units.find(unit => unit.id === value.unitId);
      const next = result.state.units.find(unit => unit.id === value.unitId);
      setFeedback(prior === next ? "교환 실패 · 비용만 사용하고 기존 수비대와 배치는 유지됩니다." : "교환 성공 · 같은 등급의 수비대로 교환했습니다.");
    }
  }
  function begin() { unlock(); publish(startGame(createGame(seed ?? crypto.getRandomValues(new Uint32Array(1))[0]))); select([]); setGroups([[], [], []]); setReward(null); setFeedback("수비대를 소환하고 배치하세요."); setPanel(null); }
  function move(px: number, py: number) { command({ type: "move", unitIds: selectedIds, x: px, y: py }, `${selectedIds.length}마리 이동 · ${Math.round(px)}, ${Math.round(py)}`); }
  function group(index: number, save: boolean) {
    setReward(null);
    if (save) { setGroups(current => current.map((ids, i) => i === index ? [...selectedIds] : ids)); setFeedback(`${index + 1}번 부대에 ${selectedIds.length}마리를 저장했습니다.`); }
    else { select(groups[index].filter(id => state.units.some(unit => unit.id === id))); setFeedback(`${index + 1}번 부대를 선택했습니다.`); }
  }
  const keyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && (event.target.matches("input,select,textarea") || event.target.isContentEditable) || event.altKey || event.metaKey) return;
    if (event.key.toLowerCase() === "c") { event.preventDefault(); setPanel(current => current === "stats" ? null : "stats"); }
    const groupKey = /^Digit[123]$/.test(event.code) ? event.code.slice(-1) : event.key;
    if (["1", "2", "3"].includes(groupKey) && active) { event.preventDefault(); group(Number(groupKey) - 1, event.ctrlKey || event.shiftKey); }
  });
  useEffect(() => { window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard); }, []);
  useEffect(() => {
    const body = document.body.style.overflow, root = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden"; document.documentElement.style.overflow = "hidden";
    return () => { document.body.style.overflow = body; document.documentElement.style.overflow = root; };
  }, []);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (element && ctx) { element.width = RULES.boardWidth * dpr; element.height = RULES.boardHeight * dpr; ctx.scale(dpr, dpr); }
    const draw = ctx ? createDefenseRenderer(ctx) : null, motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0, published = 0;
    function animate(now: number) {
      const current = runtime.current, before = current.teamActive ? current.state : engine.current;
      const next = current.teamActive ? before : advanceGame(before, last === 0 ? 0 : Math.min(now - last, 100)); last = now;
      if (!current.teamActive) engine.current = next;
      draw?.(next, selectedRef.current, motion?.matches ?? false); audio.current?.observe(next, now);
      if (!current.teamActive && next !== before && (now - published >= 200 || next.phase !== before.phase)) { setSolo(next); published = now; }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); audio.current = null; };
  }, []);
  useEffect(() => { if (finished) retry.current?.focus(); }, [finished]);
  const asyncTeam = (action: () => Promise<void>) => { unlock(); void action().catch(() => setFeedback("팀 연결을 확인한 뒤 다시 시도해 주세요.")); };
  const connectTeam = (action: () => Promise<void>) => { setTeamMode(true); runtime.current.teamActive = true; select([]); setGroups([[], [], []]); asyncTeam(action); };
  const panelTitle = panel === "commands" ? "수비대 명령" : panel === "economy" ? "자원과 선택권" : panel === "collection" ? "컬렉션과 처치 보상" : panel === "stats" ? "통계와 확률" : "생존 경쟁전";

  return <section className={`${styles.shell} dark`} aria-label="카피바라 디펜스" data-phase={state.phase} data-mode={teamActive ? "team" : "solo"} onPointerDownCapture={unlock} onKeyDownCapture={unlock}>
    <GameControls leaveConfirm={active || state.phase === "paused" ? "진행 중인 수비에서 나갈까요?" : undefined} pause={!teamActive && (active || state.phase === "paused") ? { paused: state.phase === "paused", onPause: () => command({ type: "pause" }), onResume: () => command({ type: "resume" }), onRestart: begin } : undefined} />
    <header className={styles.hud} aria-label="전투 현황">
      <div><span>라운드</span><strong data-testid="round">{state.round}<small> / 120</small></strong></div><div><span>금화</span><strong data-testid="gold">{number.format(state.gold)}</strong></div><div><span>가스</span><strong data-testid="gas">{number.format(state.gas)}</strong></div><div className={styles.pressure} data-pressure={pressure.level}><span>{pressure.label}</span><strong>{state.enemies.length}<small> / {RULES.enemyLimit}</small></strong><meter aria-label="전장에 누적된 적" min={0} max={RULES.enemyLimit} value={state.enemies.length} low={32} high={60} optimum={0} /></div>
      <div className={styles.waveClock}><span>{wave.bonus ? "보너스 · 처치 수입 증가" : wave.bossCount ? `${wave.bossName} · ${wave.bossCount}마리` : wave.name}</span><small>{Number.isFinite(bossDeadline) ? `보스 ${Math.max(0, Math.ceil((bossDeadline - state.elapsedMs) / 1000))}초` : state.round === 120 ? "마지막 적까지 처치" : `다음 ${Math.max(0, Math.ceil((RULES.roundDurationMs - state.roundElapsedMs) / 1000))}초`}</small>{nextGoal && <small className={styles.nextGoal} data-testid="next-goal">{nextGoal.round}라운드 {nextGoal.bonus ? "보너스 · 처치 수입 증가" : `${nextGoal.bossName} ${nextGoal.bossCount}마리 · ${rarityLabel(nextGoal.rewardRarity)} 선택권`}</small>}</div>
    </header>
    <main className={styles.stage}><div className={styles.board} data-testid="battlefield" onClick={event => {
      if (!active || !selectedIds.length || event.target !== event.currentTarget && event.target !== canvas.current) return;
      const rect = event.currentTarget.getBoundingClientRect(); move((event.clientX - rect.left) / rect.width * RULES.boardWidth, (event.clientY - rect.top) / rect.height * RULES.boardHeight);
    }}><canvas ref={canvas} aria-hidden="true" /><div className={styles.unitBadges} aria-hidden="true">{state.units.map(unit => { const point = getUnitPoint(unit); if (!point) return null; const visual = getDefenderVisual(unit.rarity); return <span key={unit.id} className={styles.unitBadge} data-rarity={unit.rarity} data-selected={selectedIds.includes(unit.id)} style={{ left: `${point.x / RULES.boardWidth * 100}%`, top: `${(point.y + 14 - visual.size) / RULES.boardHeight * 100}%`, borderColor: visual.color }} title={unitLabel(unit)}>{rarityLabel(unit.rarity)}</span>; })}</div><div className={styles.cells} aria-label="수비대 배치" inert={!active}>
      {CELLS.map(cell => { const units = state.units.filter(unit => { const p = getUnitPoint(unit); return p?.x === cell.x && p.y === cell.y; }); const unit = units[0];
        return <button key={cell.index} type="button" data-cell={cell.index} data-unit-id={unit?.id} data-selected={unit && selectedIds.includes(unit.id)} data-available={selectedIds.length > 0} className={styles.cell} style={{ left: `${cell.x / RULES.boardWidth * 100}%`, top: `${cell.y / RULES.boardHeight * 100}%` }} aria-label={`${cell.index + 1}번 배치 칸${unit ? ` · ${unitLabel(unit)}${units.length > 1 ? ` 외 ${units.length - 1}마리` : ""}` : " · 비어 있음"}`} onClick={event => { event.stopPropagation(); if (selectedIds.length) move(cell.x, cell.y); else if (unit) choose(unit.id, event.shiftKey); else { setReward(null); setFeedback("먼저 수비대를 소환하거나 선택하세요."); } }}><span aria-hidden="true">{unit && selectedIds.includes(unit.id) ? "✓" : "+"}</span></button>;
      })}
    </div>{(state.phase === "idle" || finished || teamActive && state.phase === "paused") && <div className={styles.overlay}><div className={styles.message}>
      <h1>{teamActive ? finished ? matchFinished ? standing?.rank === 1 && state.phase === "won" ? "생존전 우승" : `생존전 ${standing?.rank ?? "—"}위` : state.phase === "won" ? "120라운드 생존 성공" : "탈락 · 경기 진행 중" : "생존 경쟁전 대기" : finished ? state.phase === "won" ? "120라운드 클리어" : "수비 종료" : "카피바라 디펜스"}</h1>
      <p>{finished ? state.resultReason : teamActive ? "2~4명이 각자의 전장에서 경쟁합니다. 모두 준비하면 방장이 시작하세요." : "10원으로 수비대를 뽑고, 배치·강화로 120라운드를 지키세요."}</p>
      {finished && <p>{state.round}라운드 · {number.format(state.kills)}마리 처치 · {Math.floor(state.elapsedMs / 60000)}분 {Math.floor(state.elapsedMs / 1000) % 60}초</p>}
      {teamActive ? <><p>방 코드 <strong>{team.view?.code ?? "연결 중…"}</strong></p>{state.phase === "idle" && team.view && <><p className={styles.teamSeats}>{team.view.players.map(player => <span key={player.slot}>{player.slot === team.view?.you ? "나" : `${player.slot + 1}번`} · {player.connected ? player.ready ? "준비 완료" : "준비 전" : "연결 끊김"}</span>)}{team.view.players.length < 2 && <span>참가자를 기다리는 중…</span>}</p><Button onClick={() => asyncTeam(() => team.send({ type: "ready" }))}>준비 {team.view.players.find(player => player.slot === team.view?.you)?.ready ? "취소" : "완료"}</Button>{host && <Button disabled={!ready} onClick={() => command({ type: "start" }, "생존전 시작")}>생존전 시작</Button>}</>}<Button ref={retry} variant="outline" onClick={() => setPanel("team")}>참가자 · 순위</Button></> : <><Button ref={retry} className={styles.start} onClick={begin}>{finished ? "다시 도전" : "수비 시작"}</Button><Button variant="outline" onClick={() => setPanel("team")}>생존 경쟁전</Button><small>2~4명이 각자의 전장에서 끝까지 살아남기</small></>}
    </div></div>}{reward && !team.error && active && <div className={styles.drawResult} data-celebration={reward.celebrated} role="status">{reward.units.length > 0 && <span className={styles.drawPortrait} aria-hidden="true" style={{ backgroundImage: `url(${CAPYBARA_SPRITE})` }} />}<strong>{rewardMessage}</strong></div>}</div></main>
    <footer className={styles.deck}>
      {teamActive && team.view && <div className={styles.standings} aria-label="생존전 순위">{team.view.players.map(player => <span key={player.slot} data-you={player.slot === team.view?.you}>{player.slot === team.view?.you ? "나" : `${player.slot + 1}번`} · {player.rank ? `${player.rank}위` : player.phase === "won" ? "생존 성공" : player.phase === "lost" ? "탈락" : `${player.round ?? 0}R · 적 ${player.enemies ?? 0}`}{!player.connected ? " · 연결 끊김" : ""}</span>)}</div>}
      <div className={styles.commandRow}><Button ref={summonButton} className={styles.summon} disabled={!active || state.gold < RULES.summonCost || state.units.length >= RULES.maxUnits} onClick={() => command({ type: "summon" })}>랜덤 소환 <span>{RULES.summonCost} G</span></Button><div className={styles.selection}><strong>{selectedIds.length > 1 ? `${selectedIds.length}마리 선택` : selected ? unitLabel(selected) : "수비대 선택"}</strong><span>{stats ? `공격 ${number.format(stats.damage)} · 사거리 ${stats.range}` : `${state.units.length} / ${RULES.maxUnits}마리`}</span></div><Button ref={saleButton} variant="outline" disabled={!active || !selected || saleValue === 0} onClick={() => setSaleOpen(true)}>판매<span className={styles.salePrice}> +{saleValue} G</span></Button></div>
      <div className={styles.reserves} aria-label="수비대 목록">{state.units.length === 0 ? <span className={styles.empty}>10원으로 뽑은 수비대가 중앙에 등장합니다.</span> : state.units.map(unit => <button type="button" key={unit.id} className={styles.reserve} data-unit-id={unit.id} data-rarity={unit.rarity} aria-pressed={selectedIds.includes(unit.id)} disabled={!active} onClick={event => choose(unit.id, additive || event.shiftKey)}><strong>{classLabel(unit.classId)} #{unit.id}{getUnitPoint(unit) ? " · 배치" : " · 대기"}</strong><span>{rarityLabel(unit.rarity)}</span></button>)}</div>
      <div className={styles.toolbar}><Button variant="outline" disabled={!active || !state.gas} onClick={() => command({ type: "convert", amount: state.gas }, "모든 가스를 전환했습니다.")}>가스 모두 전환</Button><Button variant="outline" onClick={() => setPanel("commands")}>명령 · {selectedIds.length}</Button><Button variant="outline" onClick={() => setPanel("economy")}>자원 · 선택권 {state.tickets.length}</Button><Button variant="outline" onClick={() => setPanel("collection")}>컬렉션{readyCollections > 0 ? ` · 등록 ${readyCollections}` : ""}</Button><Button variant="outline" onClick={() => setPanel("stats")}>통계 · 확률</Button><Button variant="outline" onClick={() => setPanel("team")}>{teamActive ? `생존전 ${team.view?.code ?? "연결 중"}` : "생존전"}</Button><div className={styles.speed} aria-label="배속" hidden={teamActive}>{([1, 2, 4] as const).map(speed => <button key={speed} aria-pressed={state.speed === speed} disabled={!active} onClick={() => command({ type: "speed", speed }, `${speed}배속`)}>{speed}배속</button>)}</div></div>
      <p className={styles.feedback} role={reward && !team.error ? undefined : "status"}>{team.error ?? (reward ? "수비대를 선택해 이동하거나 강화하세요." : feedback)}</p>
    </footer>
    <Dialog open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }}><Dialog.Content className={styles.panel} onCloseAutoFocus={event => { if (finished) { event.preventDefault(); retry.current?.focus(); } }}><Dialog.Title>{panelTitle}</Dialog.Title><Dialog.Description>{panel === "commands" ? "Shift로 추가 선택 · Ctrl 또는 Shift+1~3 저장 · 1~3 부대 선택" : panel === "team" ? "각자 전장과 자원으로 경쟁합니다. 동일한 시작 자원·적 난이도 · 배속·일시정지 없음 · 연결 끊김 30초 후 탈락 · 120라운드 생존자는 공동 우승" : "이 게임의 규칙과 현재 진행 상황입니다."}</Dialog.Description>
      {panel === "commands" && <>
        <div className={styles.cluster}><Button variant="outline" aria-pressed={additive} onClick={() => setAdditive(!additive)}>여러 마리 선택 {additive ? "켜짐" : "꺼짐"}</Button><Button variant="outline" onClick={() => select(state.units.map(unit => unit.id))}>전체 선택</Button><Button variant="outline" onClick={() => select([])}>선택 해제</Button></div>
        {groups.map((ids, i) => <div className={styles.cluster} key={i}><span>{i + 1}번 부대 · {ids.filter(id => state.units.some(unit => unit.id === id)).length}마리</span><Button variant="outline" disabled={!selectedIds.length} onClick={() => group(i, true)}>{i + 1}번 저장</Button><Button variant="outline" disabled={!ids.length} onClick={() => { group(i, false); setPanel(null); }}>{i + 1}번 선택</Button></div>)}
        <form className={styles.cluster} onSubmit={event => { event.preventDefault(); move(Number(x), Number(y)); }}><label>X 좌표<input name="x" type="number" min="0" max={RULES.boardWidth} value={x} onChange={event => setX(event.target.value)} /></label><label>Y 좌표<input name="y" type="number" min="0" max={RULES.boardHeight} value={y} onChange={event => setY(event.target.value)} /></label><Button type="submit" disabled={!active || !selectedIds.length}>선택 부대 이동</Button></form>
        <p className={styles.help}>창을 닫고 전장의 원하는 위치를 눌러도 이동합니다. 같은 위치에 여러 마리를 배치할 수 있어요.</p>
        <label className={styles.field}>공격 대상<select name="enemy" value={targetId} onChange={event => setTargetId(event.target.value)}><option value="">대상을 선택하세요</option>{state.enemies.map(enemy => <option key={enemy.id} value={enemy.id}>{enemy.name} #{enemy.id} · {sizeLabel[enemy.size]} · HP {Math.ceil(enemy.hp)} · 실드 {Math.ceil(enemy.shield)} · 방어 {enemy.armor}</option>)}</select></label>
        <div className={styles.cluster}><Button disabled={!active || !targetId || !selectedIds.length} onClick={() => command({ type: "focus", unitIds: selectedIds, enemyId: Number(targetId) }, "선택한 적을 집중 공격합니다.")}>집중 공격</Button><Button variant="outline" disabled={!active || !selectedIds.length} onClick={() => command({ type: "focus", unitIds: selectedIds, enemyId: null }, "자동 공격으로 돌아갑니다.")}>자동 공격</Button></div>
        {selected && stats && <div className={styles.details}><h2>{unitLabel(selected)}</h2><p>공격 {number.format(stats.damage)} · 사거리 {stats.range} · 공격 간격 {stats.attackMs}ms · 범위 {stats.splashRadius} · {stats.attackType === "normal" ? "일반형" : stats.attackType === "explosive" ? "폭발형" : "진동형"}</p><p>마나 {Math.floor(selected.mana)} / {RULES.maxMana} · {stats.bypassArmor ? "방어 무시" : "방어 적용"}</p><p>{stats.ability ? `${abilityLabel[stats.ability]} · 마나 ${RULES.abilityMana} · ${stats.ability === "emp" ? "대상의 실드를 제거합니다." : stats.ability === "lockdown" ? "대상의 이동을 멈춥니다." : "대상의 이동을 느리게 합니다."}` : "에픽 등급부터 계열 지원 기술을 사용합니다."}</p><Button disabled={!active || !stats.ability || selected.mana < RULES.abilityMana || !targetId} onClick={() => command({ type: "ability", unitId: selected.id, enemyId: Number(targetId) }, "지원 기술을 사용했습니다.")}>{stats.ability ? abilityLabel[stats.ability] : "지원 기술"} 사용</Button></div>}
      </>}
      {panel === "economy" && <>
        <h2>계열 강화</h2><div className={styles.upgrades}>{CLASSES.map(item => <Button key={item.id} variant="outline" disabled={!active || state.gold < getUpgradeCost(state, item.id) || state.classLevels[item.id] >= RULES.maxUpgradeLevel} onClick={() => command({ type: "upgrade", classId: item.id }, `${item.label} 계열 강화 완료`)}><span>{item.label} +{state.classLevels[item.id]}</span><small>{getUpgradeCost(state, item.id)} G</small></Button>)}</div>
        <h2>가스 전환</h2><p>가스 1 → 금화 {RULES.gasGoldRate} · 보유 가스 {state.gas}</p><form className={styles.cluster} onSubmit={event => { event.preventDefault(); command({ type: "convert", amount: Number(gasAmount) }, "가스를 금화로 전환했습니다."); }}><label>전환할 가스<input name="gas" type="number" min="1" max={state.gas} value={gasAmount} onChange={event => setGasAmount(event.target.value)} /></label><Button type="submit" disabled={!active || state.gas === 0}>가스 전환</Button><Button type="button" variant="outline" disabled={!active || state.gas === 0} onClick={() => command({ type: "convert", amount: state.gas }, "모든 가스를 전환했습니다.")}>모두 전환</Button></form>
        <h2>동급 교환</h2><p>{selected ? unitLabel(selected) : "먼저 수비대를 선택하세요."} · {RULES.exchangeCost} G · 성공 {percent.format(RULES.exchangeChance)}</p><p className={styles.help}>실패하면 비용만 사용하고 기존 수비대와 배치는 유지됩니다. 전설 이상은 판매할 수 없으며 교환을 이용하세요.</p><div className={styles.cluster}><label>교환 계열<select name="exchange-class" value={exchangeClass} onChange={event => { const item = CLASSES.find(item => item.id === event.target.value); if (item) setExchangeClass(item.id); }}>{CLASSES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><Button disabled={!active || !selected || state.gold < RULES.exchangeCost} onClick={() => selected && command({ type: "exchange", unitId: selected.id, classId: exchangeClass }, "교환 결과를 확인하세요. 실패 시 기존 수비대가 유지됩니다.")}>동급 교환</Button></div>
        <h2>보스 선택권 · {state.tickets.length}장</h2><p className={styles.help}>계열 선택은 표시 등급 확정. 도박은 {percent.format(RULES.ticketGambleChance)} 확률로 한 등급 상승하며 계열은 무작위입니다.</p>{state.tickets.length === 0 && <p>보스 처치·컬렉션·처치 보상으로 선택권을 얻습니다.</p>}{state.tickets.map(ticket => <div className={styles.details} key={ticket.id}><strong>{rarityLabel(ticket.rarity)} 선택권 #{ticket.id}</strong><div className={styles.cluster}>{CLASSES.map(item => <Button key={item.id} variant="outline" disabled={!active || state.units.length >= RULES.maxUnits} onClick={() => command({ type: "ticket", ticketId: ticket.id, classId: item.id }, "선택권을 사용했습니다.")}>{item.label} 선택</Button>)}<Button disabled={!active || state.units.length >= RULES.maxUnits} onClick={() => command({ type: "ticket", ticketId: ticket.id, classId: "gamble" }, "선택권 도박 결과를 확인하세요.")}>등급 도박</Button></div></div>)}
      </>}
      {panel === "collection" && <><h2>컬렉션 등록</h2>{collections.map(collection => <div key={collection.id} className={styles.details}><strong>{collection.label} · {collection.current} / {collection.required}</strong><p>{RARITIES[collection.minimumRank].label} 이상 계열별 1마리 · {CLASSES.map(item => `${item.label} ${collection.classes.includes(item.id) ? "충족" : "필요"}`).join(" · ")}</p><p>보상 {collection.gold} G + {rarityLabel(collection.ticket)} 선택권 · 유닛은 유지됩니다.</p><Button disabled={!active || !collection.ready} onClick={() => command({ type: "collection", collectionId: collection.id }, "컬렉션 등록 완료 · 보상을 받았습니다.")}>{collection.registered ? "등록 완료" : `${collection.label} 등록`}</Button></div>)}<h2>누적 처치 · {state.kills}마리</h2>{KILL_MILESTONES.map(milestone => <p key={milestone.kills}>{milestone.kills}마리 · {milestone.gold} G + {rarityLabel(milestone.ticket)} 선택권 · {state.killMilestones.includes(milestone.kills) ? "지급 완료" : `${Math.max(0, milestone.kills - state.kills)}마리 남음`}</p>)}</>}
      {panel === "stats" && <>
        <h2>수비대 통계 · {state.units.length} / {RULES.maxUnits}</h2><p>{CLASSES.map(item => `${item.label} ${state.units.filter(unit => unit.classId === item.id).length}마리 / 강화 +${state.classLevels[item.id]}`).join(" · ")}</p><div className={styles.tableWrap}><table><caption>등급별 소환 확률과 보유 수</caption><thead><tr><th>등급</th><th>소환 확률</th><th>보유</th><th>판매</th></tr></thead><tbody>{RARITIES.map(item => <tr key={item.id}><th>{item.label}</th><td>{percent.format(item.weight / RARITIES.reduce((sum, rarity) => sum + rarity.weight, 0))}</td><td>{state.units.filter(unit => unit.rarity === item.id).length}</td><td>{item.sellGold ? `${item.sellGold} G` : "교환 전용"}</td></tr>)}</tbody></table></div><p>소환 계열은 각 1/3 확률. 교환 성공 {percent.format(RULES.exchangeChance)} · 선택권 도박 승급 {percent.format(RULES.ticketGambleChance)} (최고 등급 유지).</p>
        <div className={styles.tableWrap}><table><caption>공격 상성 · 소형 / 중형 / 대형</caption><thead><tr><th>계열</th><th>소형</th><th>중형</th><th>대형</th></tr></thead><tbody>{CLASSES.map(item => <tr key={item.id}><th>{item.label}</th>{(["small", "medium", "large"] as const).map(size => <td key={size}>{percent.format(DAMAGE_MATCHUPS[item.attackType][size])}</td>)}</tr>)}</tbody></table></div>
        <p className={styles.help}>태초·종말은 모든 계열이 일반형 공격으로 소형·중형·대형에 100% 피해를 줍니다. 선택한 유닛의 실제 공격 유형은 명령 창에서 확인하세요.</p>
        <h2>현재 적 구성</h2><p>{wave.name} · {sizeLabel[wave.size]} · 방어 {wave.armor} · {wave.bonus ? "보너스 처치 수입" : "일반 처치 수입"}</p>{wave.bossCount > 0 && <p>{wave.bossName} {wave.bossCount}마리 · {wave.bossDurationMs / 1000}초 · {rarityLabel(wave.rewardRarity)} 선택권</p>}<h2>보유 유닛 상세</h2>{state.units.length === 0 && <p>아직 수비대가 없습니다.</p>}{state.units.map(unit => { const spec = getUnitStats(state, unit); return <p key={unit.id}>{unitLabel(unit)} · 공격 {number.format(spec.damage)} / 사거리 {spec.range} / {spec.attackMs}ms / 범위 {spec.splashRadius} / 마나 {Math.floor(unit.mana)}{spec.ability ? ` / ${abilityLabel[spec.ability]}` : ""}{spec.bypassArmor ? " / 방어 무시" : ""}</p>; })}
      </>}
      {panel === "team" && <>
        {team.view ? <><p>방 코드 <strong data-testid="room-code">{team.view.code}</strong> · {host ? "방장" : "참가자"}</p>{team.view.players.map(player => <p key={player.slot}>{player.slot + 1}번 {player.slot === team.view?.you ? "나" : "참가자"} · {player.connected ? "연결됨" : "연결 끊김"} · {player.rank ? `${player.rank}위` : player.ready ? "준비 완료" : "준비 전"}</p>)}{state.phase === "idle" && <div className={styles.cluster}><Button onClick={() => asyncTeam(() => team.send({ type: "ready" }))}>준비 {team.view.players.find(player => player.slot === team.view?.you)?.ready ? "취소" : "완료"}</Button>{host && <Button disabled={!ready} onClick={() => { command({ type: "start" }, "생존전 시작"); setPanel(null); }}>생존전 시작</Button>}</div>}<Button variant="outline" onClick={() => setLeaveOpen(true)}>방 나가기</Button><p className={styles.help}>경기는 계속 진행됩니다. 30초 안에 이 탭으로 재접속하면 복귀할 수 있습니다. 새 판은 방을 나간 뒤 만들어 주세요.</p></> : <><p>2~4인 생존 경쟁전 · 마지막 생존자가 우승합니다.</p><Button disabled={team.status === "connecting" || active || state.phase === "paused"} onClick={() => connectTeam(team.create)}>{team.status === "connecting" ? "연결 중… " : ""}생존전 방 만들기</Button><form className={styles.cluster} onSubmit={event => { event.preventDefault(); connectTeam(() => team.join(roomCode.trim())); }}><label>방 코드<input name="room-code" autoComplete="off" spellCheck={false} value={roomCode} onChange={event => setRoomCode(event.target.value)} placeholder="예: ABCD1234…" /></label><Button type="submit" disabled={team.status === "connecting" || active || state.phase === "paused"}>방 참가</Button></form></>}
        {team.error && <p role="alert">{team.error}</p>}{!team.view && teamActive && <Button variant="outline" onClick={() => setLeaveOpen(true)}>연결 종료</Button>}
      </>}
      <p role="status" className={styles.help} data-celebration={!team.error && reward?.celebrated || undefined}>{team.error ?? rewardMessage}</p>
    </Dialog.Content></Dialog>
    <Dialog open={saleOpen && active} onOpenChange={setSaleOpen}><Dialog.Content className={styles.panel} showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); (saleButton.current?.disabled ? summonButton.current : saleButton.current)?.focus(); }}><Dialog.Title>선택한 수비대를 판매할까요?</Dialog.Title><Dialog.Description>{selected ? unitLabel(selected) : "수비대"} 판매 시 {saleValue} G를 돌려받습니다.</Dialog.Description><Button variant="outline" onClick={() => setSaleOpen(false)}>취소</Button><Button onClick={() => { if (selected) command({ type: "sell", unitId: selected.id }, "수비대를 판매했습니다."); select([]); setSaleOpen(false); }}>판매 확정</Button></Dialog.Content></Dialog>
    <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}><Dialog.Content className={styles.panel}><Dialog.Title>생존전에서 나갈까요?</Dialog.Title><Dialog.Description>경기 중 나가면 기권 처리됩니다. 다른 참가자의 경기는 계속됩니다.</Dialog.Description><Button variant="outline" onClick={() => setLeaveOpen(false)}>취소</Button><Button onClick={() => { asyncTeam(async () => { try { await team.leave(); } finally { setTeamMode(false); runtime.current.teamActive = false; publish(createGame(seed ?? 1)); select([]); setGroups([[], [], []]); setSaleOpen(false); setPanel("team"); } }); setLeaveOpen(false); }}>방 나가기 확정</Button></Dialog.Content></Dialog>
  </section>;
}
