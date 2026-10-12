# Capybara defense — battlefield contract

## 2026-10-12 requested character and tension revision

Preserve the existing cover layout, semantic shell tokens, native controls and approved forest/earth/cream art palette. The signature is the repository's plush capybara sprite (`capybara-stand-down-right.webp`), with class equipment, contact shadow and an written rarity badge above the head. Reuse the original face/body texture; do not replace it with a generic vector mascot. Character image boxes are uniformly 46 logical pixels, while the board scales responsively. Rarity labels are DOM text at12 CSS pixels, independent of canvas zoom, and remain visible with reduced motion. Selected defender draws last; equal-position units retain real shared coordinates.

Canvas-only rarity effects escalate from a quiet grounding ring to gold double rings, orbiting sparks and a radiant crown for the highest tiers. Attack trails inherit actual rarity and class; effects are bounded to96 retained attacks and160ms duration, use engine time, freeze on pause and disappear in reduced-motion mode. The static rarity badge/ring always carries the same meaning. No camera shake, flashing full-screen layer, blocked input or new dependency. Shared press feedback stays120ms/scale(.97); beui button ownership remains the interaction reference.

HUD adds an honest enemy-pressure meter, derived only from living enemy count and the80-enemy defeat threshold; labels distinguish stable/pressured/danger rather than implying scripted near-defeat. A warm wood-tinted command deck, cream counters and restrained grove background extend existing material tokens. Multiplayer is real 2–4-player survival competition with separate boards and resources. Readiness and rankings are visible; verify four independent clients after balance synchronization.

Player tasks: identify grade on the field, select/place a defender, recognize high-tier power, react to rising enemy pressure, invite/ready/start with a friend. Keyboard and muted/reduced-motion players get identical information. No new accepted accessibility debt. Physical-device and human-enjoyment claims require separate evidence.

## 1. Scope and reference
Solo 120-round defense and 2–4-player survival competition with ten rarities and free positioning. The supplied StarCraft Maple Luck Defense reference informs the central placement field, closed enemy loop, compact resource strip, and command deck. No source artwork or old game UI is reused. The repository `.design` owns shared controls, typography, focus, and dialog behavior.

## 2. Color and material
Shell uses existing background, foreground, muted-foreground, border, primary, and ring tokens. The game drawing owns a small illustrated palette: forest ink #152820, meadow #294637, grass #385741, stone #827b61, stone light #aaa181, earth #514a39, capybara brown #b47d50, lit fur #d9ad78, muzzle #ebc494, dark feature #302b23, cream #fff1ca. Unit class accents are warrior #e6bd79, archer #8fc9a0, mage #bfa4ec. Rarity accents are common #ddd7bb, rare #80c4e4, epic #c5a0ee, legendary #f7cc71. Monsters use plum #835883, moss #78966c, rust #b87967. Shadows use translucent forest ink; terrain has upper-left light and a darker outer edge. No dashboard cards, slogans, or decorative product labels.

## 3. Typography and spacing
Use inherited Pretendard/system font. HUD and commands use 12/14/16px sizes from the shared caption/body scale, tabular figures. Start and result heading use the shared 24px title scale. Spacing is 4/8/12/16/24px. Shell maximum width is 1120px; battlefield geometry is engine-owned 720×480. UI border radius follows the shared base token.

## 4. Layout and responsive behavior
Adopt the [StyleGallery cover pattern](https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/cover.md): HUD, flexible battlefield, command deck. A fixed viewport shell owns height and prevents page movement. The unit reel and command toolbar scroll horizontally; wide statistics tables own horizontal scrolling inside their dialog. Battlefield aspect ratio stays 3:2 and is sized within its center region; the 24 placement controls have at least 44×44 CSS pixel targets. At short landscape widths the command deck docks right, preserving playable height. Top HUD leaves room for shared back, sound, and pause controls. Safe-area insets protect all edges. No ads are mounted in this game.

## 5. Primitives and states
- Shared Button: primary summon/start/retry; secondary upgrades; disabled when phase/funds/capacity prohibit an action.
- Shared GameControls: back, sound, pause, focus-trapped pause dialog, manual resume, hidden-tab pause.
- Shared Dialog: sale confirmation; cancel is non-destructive and returns focus.
- Battlefield: native cell buttons in row-major order; idle, available, occupied, selected, focus-visible. Selected unit displays range; selection is indicated by a check as well as color.
- Reserve reel: native buttons with class, rarity, unit ID; empty state keeps fixed height.
- HUD: round, gold, enemy count, next round or final-wave label, boss deadline.
- Result overlay: won/lost heading, reason, round, elapsed time and kills; unit counts and class levels remain in the statistics panel. Solo retry starts a new run; survival replay starts from a new room.

## 6. Interaction and motion
Actions act immediately. CSS press feedback uses transform scale(.97), 120ms ease-out; reduced motion removes it. The [beui button reference](https://beui.dev/r/button/raw) was consulted for press/state ownership; existing shared buttons remain the implementation. Actual combat draws hit feedback and class-colored attacks; reduced motion suppresses decorative bob/attack flashes while preserving HP changes and range. Canvas renders via RAF, engine advances in its fixed ticks, React HUD snapshots publish at most every 200ms except direct actions and terminal changes. Pause freezes engine time. No idle autoplay animation.

## 7. Accessibility constraints
Touch targets ≥44px, visible focus rings, text alternatives for every cell/reserve button, keyboard activation, polite action feedback, status not color-only, no gesture-only controls, no browser zoom restriction. Canvas is decorative alongside the accessible HUD/cell controls. Confirm before sale; restarting a paused run is explicit. Dialogs use shared focus management. Solo hidden tabs pause and require resume. Survival matches continue at fixed 1× speed; disconnected players have 30 seconds to reconnect before forfeit.

## 8. Full mechanics extension
Solo and 2–4-player survival competition use the illustrated battlefield. Each player owns an independent server-authoritative board and economy; a compact live standings row shows opponents’ round, enemy count and elimination rank. A compact toolbar opens shared Dialog panels for command detail, resources, collections, statistics/probabilities and team status; each panel owns its bounded vertical scroll. The battlefield never scrolls. The unit reel includes deployed and reserve units, with explicit additive selection and group save/recall controls. Twenty-four placement shortcuts and numeric coordinates provide keyboard alternatives to arbitrary pointer placement. Target selection has a native enemy select control. No gesture is required.

Rarity colors retain the existing four accents and reuse class/material accents for ancient, relic, saga, mythic, primordial and apocalypse; written rarity labels carry meaning independently of color. Resource and spell feedback use the existing polite status line. Survival waiting states show room code, readiness, connection and host authority; all players run at 1× without pause or local restart. Existing shared sound settings own mute/volume; synthesized combat feedback is capped at one attack sound per 180ms and starts only after user input. No extra dependencies are introduced in this owned lane.

## 9. Verification and debt
Component tests use the real seeded engine; only the unavailable jsdom canvas context is stubbed. Browser verification must cover portrait 390×844, laptop 1366×768, ultrawide 2560×1440, short landscape, keyboard placement, pause and reduced motion. Parent owns route/full-run browser evidence and final visual review. No new dependencies/tooling installed per task scope. No accepted accessibility debt. Solo runs are transient; survival runs reconnect with the same tab's stored membership while the server room exists. Server process restart, room expiry or lost membership prevents recovery.

## 10. Reward and next-goal feedback
The existing polite status line names newly acquired rarity, class and unit ID, tickets, and earned kill/collection rewards from accepted state changes. Legendary-and-higher rewards use foreground-weight emphasis and the existing secondary surface, in a nonblocking central draw result lasting 2.4 seconds. Draw results appear centrally and yield to the next action; ordinary command errors retain priority. Summons cost 10 gold and appear at logical (360,240); ticket units appear there too. The new defender is selected for movement. Characters are uniformly compact at 46 logical pixels, with 12 CSS pixel labels above the head. Rarity is conveyed through labels, rings, sparks and stronger attacks instead of increased size. Sale proceeds stay below summon cost. Survival rewards only change the owner's selection. Initial room snapshots and reconnect baselines do not replay prior rewards.

The existing wave HUD previews the next boss or bonus round using engine wave data, including the boss ticket rarity or bonus income. Nothing after round 120 is advertised. The collection toolbar shows the number of currently registerable collections. Mobile status may wrap to two 20px lines so the acquisition and placement instruction remain readable. No new palette, blocking modal or dependency is introduced; reduced motion uses the same static emphasis.
