export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 카피바라 크기 (프로그레스 바는 이 폭의 1.5배) */
  size?: number | string;
  fullScreen?: boolean;
  description?: string;
  /** 0~100. 안 넘기면 90%까지 서서히 차오른다 */
  progress?: number;
}
