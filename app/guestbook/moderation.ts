import { DEFAULT_NICKNAME } from "./constants";

/** 비교용: 소문자 + 공백·기호·숫자 장식 제거 ("시 1 발" → "시발") */
const squash = (text: string) => text.toLowerCase().replace(/[^\p{L}]/gu, "");

const NULLISH = new Set(["null", "undefined", "nan", "none", "nil", "test", "테스트"]);

const PROFANITY = [
  "시발", "씨발", "씨바", "시바", "ㅅㅂ", "ㅆㅂ", "십새", "씹새", "씹년", "좆", "존나", "졸라", "ㅈㄴ", "병신", "ㅂㅅ", "븅신", "빙신",
  "개새", "개색", "ㅅㄲ", "지랄", "ㅈㄹ", "닥쳐", "꺼져", "미친놈", "미친년", "미친새", "엠창", "니애미", "느금",
  "보지", "자지", "섹스", "한남충", "한녀", "틀딱", "fuck", "shit", "bitch", "asshole", "pussy", "cunt", "nigger", "nigga",
];

/** 사람이 읽을 글자(한글 음절·영문·숫자)가 거의 없는 글: ";,./';l" 같은 키보드 막치기 */
const isJunk = (text: string) => {
  const visible = text.replace(/\s/g, "");
  const meaningful = visible.match(/[가-힣a-zA-Z0-9]/g)?.length ?? 0;
  return meaningful < 2 || meaningful / visible.length < 0.5;
};

/** 도배: 같은 글자 6번 이상 연속, 같은 낱말 4번 이상, 링크 */
const isSpam = (text: string) => {
  if (/(.)\1{5,}/u.test(text.replace(/\s/g, ""))) return true;
  if (/https?:\/\/|www\.|\.(com|net|kr|io|xyz)\b/i.test(text)) return true;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  return words.some((word) => (counts.set(word, (counts.get(word) ?? 0) + 1).get(word) ?? 0) >= 4);
};

const hasProfanity = (text: string) => {
  const flat = squash(text);
  return PROFANITY.some((word) => flat.includes(word));
};

/** 막을 글이면 이유 문구, 괜찮으면 null */
export function messageProblem(message: string): string | null {
  const text = message.trim();
  if (!text || NULLISH.has(squash(text))) return "남길 말을 적어 주세요";
  if (hasProfanity(text)) return "고운 말로 적어 주세요";
  if (isSpam(text)) return "같은 말 반복이나 링크는 남길 수 없어요";
  if (isJunk(text)) return "알아볼 수 있는 말로 적어 주세요";
  return null;
}

/** 비었거나 null·비속어·도배·막치기 닉네임은 기본 이름으로 */
export function safeNickname(nickname: string | null | undefined): string {
  const text = nickname?.trim() ?? "";
  if (!text || NULLISH.has(squash(text)) || hasProfanity(text) || isSpam(text) || isJunk(text)) return DEFAULT_NICKNAME;
  return text;
}
