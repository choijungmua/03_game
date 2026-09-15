export interface GameOverActionsProps {
  /** 같은 게임을 새로 시작한다 (순위형은 카운트다운, 대국형은 방 고르기 화면) */
  onRetry: () => void;
  className?: string;
}
