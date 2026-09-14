import Link from "next/link";

/** 이용약관 본문. /terms 페이지와 로비 아래에서 올라오는 패널이 같이 쓴다 (글자색은 감싸는 쪽이 정한다) */
export function TermsContent() {
  return (
    <>
      <p className="text-xs">시행일: 2026년 9월 14일</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제1조 (목적)</h2>
        <p>
          이 약관은 ggpli(이하 “서비스”)가 제공하는 웹 게임 및 관련 기능을 이용하는 데 필요한 조건과 절차를
          정합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제2조 (서비스 이용)</h2>
        <p>
          서비스는 회원가입 없이 누구나 무료로 이용할 수 있습니다. 서비스는 게임의 추가·변경·중단을 사전 안내 없이
          할 수 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제3조 (게임 기록)</h2>
        <p>
          게임 기록과 순위는 이용자의 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하거나 다른 기기·브라우저를
          사용하면 기록이 보이지 않을 수 있으며, 서비스는 이를 복구할 수 없습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제4조 (광고)</h2>
        <p>서비스는 운영을 위해 화면 일부에 광고를 게재할 수 있습니다. 광고는 게임 진행을 방해하지 않는 위치에만 표시합니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제5조 (금지 행위)</h2>
        <p>
          자동화 프로그램으로 기록을 조작하거나, 광고를 부정하게 클릭하거나, 로비 채팅에 욕설·광고·개인정보를 올리거나,
          서비스 운영을 방해하는 행위를 해서는 안 됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제6조 (책임의 한계)</h2>
        <p>
          서비스는 무료로 제공되며, 서비스 이용 중 발생한 기록 손실이나 일시적인 장애에 대해 법령이 허용하는 범위에서
          책임을 지지 않습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제7조 (약관 변경)</h2>
        <p>약관이 변경되면 이 페이지에 시행일과 함께 게시하며, 게시한 날부터 효력이 생깁니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">제8조 (문의)</h2>
        <p>
          서비스 이용과 관련한 문의·신고는{" "}
          <Link href="/contact" className="text-foreground underline underline-offset-2">
            문의 페이지
          </Link>
          에서 안내하는 메일 주소로 보내 주세요.
        </p>
      </section>
    </>
  );
}
