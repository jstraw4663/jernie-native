/** One plan on a day: time on the left, media, title, status subline. */
export interface ItineraryRowProps {
  /** "12:10" or "FRI 22" */
  time: string;
  duration?: string;
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  photo?: React.ReactNode;
  badge?: React.ReactNode;
  /** highlights the time in accent — the next thing happening */
  now?: boolean;
  warn?: boolean;
  onClick?: () => void;
}
export declare function ItineraryRow(props: ItineraryRowProps): JSX.Element;
