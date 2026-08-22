/** An empty state that is also an action. The first-run home is built from these. */
export interface PromptRowProps {
  title: string;
  sub: string;
  /** "Add", "Paste", "Invite" */
  action?: string;
  icon?: React.ReactNode;
  /** amber treatment — this one blocks a real requirement */
  urgent?: boolean;
  onClick?: () => void;
}
export declare function PromptRow(props: PromptRowProps): JSX.Element;
