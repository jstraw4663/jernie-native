/**
 * The workhorse. Every list in the app is this row: a 44px media square, a title,
 * a subline that carries status, and one trailing element.
 * @startingPoint section="Core" subtitle="Bordered, accent and plain list rows" viewport="700x230"
 */
export interface ListRowProps {
  title: string;
  sub?: string;
  /** 44x44 image or icon tile */
  media?: React.ReactNode;
  /** left-most column, usually a mono time stack */
  lead?: React.ReactNode;
  /** caret, badge, or small Button */
  trailing?: React.ReactNode;
  bordered?: boolean;
  /** default = outlined card · accent = current/secured · plain = divider-separated list item */
  tone?: 'default' | 'accent' | 'plain';
  subTone?: 'default' | 'accent' | 'warning';
  onClick?: () => void;
}
export declare function ListRow(props: ListRowProps): JSX.Element;
