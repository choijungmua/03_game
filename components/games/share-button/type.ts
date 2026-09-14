export interface ShareButtonProps {
  title: string;
  text: string;
  /** 공유할 주소. 없으면 지금 페이지 주소 */
  url?: string;
  className?: string;
}
