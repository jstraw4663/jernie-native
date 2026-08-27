/** Two to four mutually exclusive views of the same data (Agenda's by type / by day / by stop). */
export interface SegmentedOption { value: string; label: string; icon?: React.ReactNode }
export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
