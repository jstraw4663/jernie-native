/**
 * One stop in the horizontal rail that sits on the home hero. Swipeable, and the
 * only navigation between stops.
 * @startingPoint section="Travel" subtitle="Stop rail card, active and recessed" viewport="700x210"
 */
export interface StopCardProps {
  name: string;
  dates: string;
  /** "Stop 2 of 3" */
  kicker: string;
  photo?: React.ReactNode;
  /** "Checked in", "Everything booked", "2 gaps to fix" */
  status: string;
  statusTone?: 'accent' | 'warning';
  /** "11 plans" */
  count?: string;
  active?: boolean;
  onClick?: () => void;
}
export declare function StopCard(props: StopCardProps): JSX.Element;
