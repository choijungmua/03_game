export interface GameControlsProps {
  /** 넘기면 오른쪽 위에 일시정지 버튼 + 멈춤 창. 플레이 중에만 넘긴다 */
  pause?: {
    paused: boolean;
    onPause: () => void;
    onResume: () => void;
    onRestart: () => void;
  };
  /** 넘기면 뒤로 버튼이 로비 이동 대신 이 함수를 부른다 (반응속도·클릭 스피드의 판 취소) */
  onCancelRound?: () => void;
  /** 넘기면 뒤로 버튼이 이 문구로 확인 창을 띄운 뒤 로비로 (온라인 대국 중) */
  leaveConfirm?: string;
  /** 래퍼(display: contents)에 붙는 클래스. 플레이 화면의 `dark` 스코프를 따를 때 쓴다 */
  className?: string;
}
