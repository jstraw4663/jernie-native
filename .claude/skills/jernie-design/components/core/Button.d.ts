/**
 * The one action on a screen, or the one action in a sheet.
 * @startingPoint section="Core" subtitle="Primary, secondary, ghost, accent and Apple-black" viewport="700x220"
 */
export interface ButtonProps {
  label: string;
  /** primary = the screen's single commit action. dark = Apple sign-in only. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'dark';
  /** lg 52px for footers, md 44px inline, sm 30px inside a row */
  size?: 'lg' | 'md' | 'sm';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  full?: boolean;
  onClick?: () => void;
}
export declare function Button(props: ButtonProps): JSX.Element;
