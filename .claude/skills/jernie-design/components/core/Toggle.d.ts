/** A single on/off preference. Applies immediately — no Save button anywhere near it. */
export interface ToggleProps { on?: boolean; onChange?: (on: boolean) => void }
export declare function Toggle(props: ToggleProps): JSX.Element;
