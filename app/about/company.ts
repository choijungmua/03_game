import { CONTACT_EMAIL } from "@/app/contact/constants";

/**
 * 운영 주체 공시 정보. /about 페이지와 Organization JSON-LD가 같이 쓴다.
 * 스타트업 프로그램·광고 심사는 이 값으로 회사를 검증하므로 사업자등록증과 글자 그대로 맞춘다.
 * 아직 모르는 값은 빈 문자열로 두면 화면에 그 줄이 나오지 않는다 (가짜 값 넣지 말 것).
 */
export const COMPANY = {
  /** 사업자등록증 상호 (영문 표기는 신청서와 동일하게) */
  name: "GGPLI",
  legalName: "",
  representative: "",
  registrationNumber: "",
  /** 설립일(사업자등록일) YYYY-MM-DD */
  foundedAt: "",
  address: "",
  country: "KR",
  email: CONTACT_EMAIL,
  /** 서비스 첫 공개일 (git 첫 커밋 기준) */
  launchedAt: "2026-09-14",
} as const;

/** 공시 표에 쓰는 (라벨, 값) 목록. 값이 빈 항목은 뺀다 */
export const COMPANY_ROWS: { label: string; value: string }[] = [
  { label: "상호", value: COMPANY.legalName || COMPANY.name },
  { label: "대표자", value: COMPANY.representative },
  { label: "사업자등록번호", value: COMPANY.registrationNumber },
  { label: "설립일", value: COMPANY.foundedAt },
  { label: "소재지", value: COMPANY.address },
  { label: "이메일", value: COMPANY.email },
  { label: "웹사이트", value: "https://ggpli.com" },
].filter((row) => row.value !== "");
