# 귀여운 게임 목소리·효과음 조사 (2026-10-13)

## 요약
지금 목소리가 기계 같은 이유는 **TTS로 또박또박 "말"을 하기 때문**이다. 귀엽게 들리는 게임(동물의 숲, Celeste, Undertale)은
알아들을 수 있는 말을 하지 않고, **사람 목소리 조각을 짧게 자르고 빠르게·높게 이어 붙인 "중얼거림"**을 쓰고 뜻은 화면 글자로 보여 준다.
→ 권장: 대사 TTS를 **카피바라 중얼거림(animalese 방식)**으로 바꾸고, 효과음은 **각진 소리 제거 + 높고 둥근 소리**로 다듬는다.

## 1. 동물의 숲식 중얼거림 (animalese) — 가장 권장 (신뢰도: 높음)
- 원리: 실제 사람 목소리를 글자(일본판은 가나 음절) 단위로 잘라 빠르게 이어 붙인 것. 캐릭터마다 음높이가 다르고,
  기쁘면 높게, 슬프면 낮게 말한다. [Nookipedia](https://nookipedia.com/wiki/Animalese), [Matinee](https://matinee.co.uk/blog/video-game-languages/)
- 바로 쓸 수 있는 라이브러리: **animalese-tts** (MIT, 브라우저 Web Audio 지원, **한국어 분석기 있음** — 초성·중성·종성 분해).
  음성 스프라이트 WAV 하나를 음소별로 잘라 쓰고, pitch·speed·randomness·melody 조절 가능. [README](https://cdn.jsdelivr.net/npm/animalese-tts@1.1.3/readme.md), [jsDelivr](https://www.jsdelivr.com/package/npm/animalese-tts)
- 참고 구현: Acedio/animalese.js (라이선스 미확인) [HF 데모](https://huggingface.co/spaces/Blane187/animalese-js/blob/main/index.html)

## 2. Celeste 방식 (신뢰도: 중간 — 개발자 본인 설명)
- 캐릭터마다 단순한 음 + 포먼트(모음 공명) EQ로 "말하는 듯한" 소리. 같은 음절 두 번 연속 금지, 감정은 음높이 곡선으로 표현.
  [TheGamer](https://www.thegamer.com/celeste-sound-designer-reveals-how-the-games-dialogue-audio-was-created/), [Kevin Regamey 스레드](https://threadreaderapp.com/scrolly/1416483583053602816)
- 무료 자료: [talking synthesizer (CC-BY)](https://opengameart.org/content/talking-synthesizer), [8-bit voice blips](https://construct.net/game-assets/sounds/sound-effects/8-bit-voice-blips-664)

## 3. 한국어 신경망 TTS (신뢰도: 중간)
- **MeloTTS-Korean** (MIT, 상업 가능) — Heami보다 자연스러울 가능성. "귀여운" 음색은 샘플을 들어봐야 앎. [HF](https://huggingface.co/myshell-ai/MeloTTS-Korean)
- Kokoro (Apache 2.0, 한국어 지원 주장 — 직접 확인 필요), Coqui XTTS v2는 상업 불가. [BentoML](https://www.bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models), [Eden AI](https://www.edenai.co/post/top-free-text-to-speech-tools-apis-and-open-source-models)
- 한계: 아무리 좋아도 "말하는 사람"이라 귀여운 캐릭터 느낌은 약하다.

## 4. CC0 보이스 에셋 (신뢰도: 높음)
- Kenney Voiceover Pack (CC0, 남·여 성우 40+줄, 영어 "level up/game over" 류). 귀여운 캐릭터 목소리는 아님.
  [OpenGameArt](https://opengameart.org/content/voiceover-pack-40-lines)
- 귀여운 한국어 CC0 목소리 팩은 찾지 못함.

## 5. 귀여운 효과음 원칙 (신뢰도: 중간 — 실무 가이드)
- 둥근 소리 = 귀여움. **딱딱한 어택(시작)이 있으면 귀여움이 사라진다.** 높을수록 작고 귀엽게, 한 옥타브 내리면 무거워짐.
- 통통 튀는 소리는 부딪힘 없이 점점 간격이 좁아지는 부드러운 튐. 끝(꼬리)이 부드러워야 사랑스럽다.
- 목소리는 "거의 목소리가 아닌" 작은 숨·감탄 정도가 귀엽다. [Morphic](https://morphic.com/resources/sounds/cute-sound-effects)
- 도구: jsfxr / sfxr.me (pickupCoin·blipSelect 프리셋에서 시작, JSON으로 내보내기) — 단 기본은 8비트풍이라 그대로 쓰면 레거시해짐. [jsfxr](https://github.com/chr15m/jsfxr), [sfxr.js 글](https://blog.humphd.org/vocamus-1166/)

## 6. 무료로 바로 쓸 수 있는 자원 (라이선스 원본 페이지 확인함)
| 자원 | 라이선스 | 내용 |
|---|---|---|
| [pop sounds 0](https://opengameart.org/content/pop-sounds-0) (EZduzziteh) | CC0 | 귀여운 방울 팝 WAV 9개 — 팡·코인·UI용 |
| [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) (rubberduck) | CC0 | 크리처 소리 80개 중 "cute" 10개 — 카피바라 감탄·울음 후보 |
| [Pouet of a toy](https://bigsoundbank.com/pouet-of-a-toy-s0427.html) | CC0 | 아기 기린 장난감 삑삑이 1개 |
| [animalese-tts](https://www.jsdelivr.com/package/npm/animalese-tts) | MIT | 한국어 중얼거림 목소리 엔진 |
| [MeloTTS-Korean](https://huggingface.co/myshell-ai/MeloTTS-Korean) | MIT | 한국어 신경망 TTS, 화자 1명(성별 미표기) |
| [Kenney Voiceover Pack](https://opengameart.org/content/voiceover-pack-40-lines) | CC0 | 영어 남·여 성우 40줄 (귀여운 톤 아님) |

유료/조건부 참고: [Mixkit 삑삑 소리](https://mixkit.co/free-sound-effects/squeak/)(무료·Mixkit 라이선스), [Dark Side of Synth 9종](https://darksideofsynth.gumroad.com/l/free-monster-sounds)(CC BY 4.0, 출처 표기 필요),
[Kawaii UI](https://rogue-waves.itch.io/kawaii-ui)(15€), [Squeaky Creatures](https://soundslikegeorge.itch.io/squeaky-creatures)($15).
실제 카피바라 울음 CC0 녹음은 찾지 못함 (Freesound에서 CC0 필터로 직접 확인 필요).
Kokoro는 한국어 미지원으로 보임.

## 현재 코드에 대한 진단
- 기계 같음: TTS 낱말 그대로 재생 → 사람이 아닌 기계가 "말하는" 느낌.
- 효과음: sawtooth(톱니파)·노이즈 클릭·attack 1~2ms가 많음 → "딱딱한 어택" 원칙 위반.

## 권장 실행안
1. 대사 목소리 → animalese-tts(한국어)로 카피바라 중얼거림. 높은 음(귀여움), 기쁨=높게/아쉬움=낮게, 뜻은 기존 배너 글자로.
   음성 스프라이트는 Heami로 한국어 음절을 녹음해 만들면 라이선스 걱정 없음.
2. 효과음 → sawtooth 제거, attack 8~20ms로 둥글게, 음을 한 옥타브가량 올리고 꼬리를 길고 부드럽게.
3. (선택) 진짜 사람 목소리는 MeloTTS-Korean 샘플 비교 후 결정.
