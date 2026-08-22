/** Filter bubble, vibe pill, or day selector. Selection applies immediately — chips never wait for an Apply. */
export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  selected?: boolean;
  /** filter = outlined, solid = grey fill, dropdown = adds a caret */
  variant?: 'filter' | 'solid' | 'dropdown';
  onClick?: () => void;
}
export declare function Chip(props: ChipProps): JSX.Element;
