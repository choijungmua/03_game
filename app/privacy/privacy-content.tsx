import Link from "next/link";

/** 개인정보처리방침 본문. /privacy 페이지와 로비 아래에서 올라오는 패널이 같이 쓴다 (글자색은 감싸는 쪽이 정한다) */
export function PrivacyContent() {
  return (
    <>
      <p className="text-xs">시행일: 2026년 10월 8일</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">1. 수집하는 개인정보</h2>
        <p>
          ggpli(이하 “서비스”)는 회원가입이 없습니다. 서비스 이용 과정에서 임의로 생성한 세션 ID와 로비 프로필 ID,
          게임 방문·점수·플레이 결과·소요 시간, 공유 방식, 방명록·채팅·낚시와 로비 이동·상호작용·설정 변경 활동이 서버에 저장될 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">2. 브라우저에 저장되는 정보</h2>
        <p>
          개인 순위와 설정 일부는 이용자 기기의 브라우저 저장소(localStorage 또는 sessionStorage)에 저장됩니다.
          게임 통계와 서비스 운영을 위해 점수와 플레이 결과의 일부는 서버에도 전송됩니다. 브라우저에 저장된 정보는
          브라우저 설정에서 사이트 데이터를 삭제하면 지울 수 있습니다. 이 작업으로 서버에 저장된 기록까지 삭제되지는 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">3. 광고와 쿠키</h2>
        <p>
          서비스는 Google AdSense 등 제3자 광고 서비스를 이용할 수 있습니다. 광고 제공업체는 쿠키를 사용해 이용자의
          이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 표시할 수 있습니다.
        </p>
        <p>
          맞춤 광고는{" "}
          <a
            href="https://adssettings.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Google 광고 설정
          </a>
          에서 끄거나, 브라우저 설정에서 쿠키를 차단할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">4. 접속 기록</h2>
        <p>
          서비스 개선을 위해 기기 유형, 브라우저·운영체제 종류, 언어, 시간대, 유입 도메인과 UTM 캠페인 정보가
          자체 이용 통계에 저장될 수 있습니다. 이 통계에는 전체 User-Agent, 전체 유입 URL과 브라우저 fingerprint를 저장하지 않습니다.
          보안과 과도한 요청 차단에는 IP 주소가 일시적으로 사용되며, 보안 기록에는 원본 IP 대신 날짜별로 달라지는 해시값이 저장될 수 있습니다.
          호스팅·네트워크·광고 제공업체의 접속 기록은 각 제공업체의 정책에 따라 처리됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">5. 로비 채팅과 위치 정보</h2>
        <p>
          로비에서 다른 이용자와 함께 보이도록 캐릭터 위치·옷차림·채팅 내용이 서버로 전송됩니다. 위치와 접속 상태는
          같은 프로필의 마지막 연결이 종료되거나 오래된 접속이 정리되면 서버 메모리에서 사라집니다.
          채팅·낚시 활동·옷차림은 서비스 운영·신고 처리와 상태 복원을 위해 서버에 저장됩니다.
          채팅에 이름·연락처 등 개인정보를 적지 마세요.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">6. 문의</h2>
        <p>
          개인정보 관련 문의와 정보 열람·삭제 요청은 ggpli 운영팀이 접수합니다.{" "}
          <Link href="/contact" className="text-foreground underline underline-offset-2">
            문의 페이지
          </Link>
          의 운영 메일로 요청 내용을 보내 주세요. 요청 대상 확인에 필요한 게임 이름과 이용 시각을 함께 적어 주시면
          확인에 도움이 됩니다. 비밀번호나 주민등록번호 등 민감한 정보는 보내지 마세요.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">7. 방침 변경</h2>
        <p>이 방침이 변경되면 이 페이지에 시행일과 함께 게시합니다.</p>
      </section>
    </>
  );
}
