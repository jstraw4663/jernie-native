# Add Flow Sheet UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `BookingFormSheet`, `CustomItemSheet` and `BookingForm` with one growing `AddSheet` that takes a query, resolves it against the finished data layer, answers with a card, and commits — serving every add and edit path on the Jernie and Agenda tabs.

**Architecture:** A pure reducer in `src/domain/addFlow.ts` owns the phase machine, growth heights and the Add gate, with no React or React Native imports so it is testable directly. `AddSheet` renders that state through `@gorhom/bottom-sheet`, keeping the context chip, magic field and type row *outside* the scroll view so the query never moves. A new `DetailsForm` — written to the suggestion card's anatomy — is the finishing state and every edit target, and it must re-derive the whole field and validation surface of the form it replaces.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript, `@gorhom/bottom-sheet` v5, `react-native-reanimated` v4, `react-native-calendars`, `react-native-mmkv`, `phosphor-react-native`, Jest + `react-test-renderer`.

**Spec:** `docs/superpowers/specs/2026-08-27-add-flow-ui-design.md`

**Design canvas:** `docs/design/Jernie Add Flow.dc.html`

## Global Constraints

- **Repo:** `~/jernie-fresh`, branch `dev`. One checkout — do not create a worktree; `~/jernie-native` and `~/jernie-native-clam` are superseded.
- **Read before writing any application code:** `AGENTS.md`, `docs/agents/HANDOFF.md`, and the Expo SDK 56 docs at https://docs.expo.dev/versions/v56.0.0/. Unversioned Expo docs do not satisfy this.
- **Read before writing any UI:** `.claude/skills/jernie-design/README.md`, `reference/react-native-mapping.md`, `reference/custom-components.md`, `reference/voice.md`.
- **No hard-coded colours.** Every colour comes from `useTheme()` via `createThemedStyles(t => ...)` in `src/design/useTheme.ts`. Design values come from `src/design/tokens.ts`.
- **No emoji in product UI.** Per-icon Phosphor imports only: `import { PlusIcon } from 'phosphor-react-native/src/icons/Plus'` — never the barrel.
- **20px gutter** (`Gutter` from tokens), **44px minimum hit target**, layout `gap` not margin chains.
- **A card has a border or a shadow, never both.** Selected is a 1.5px accent border plus 9% accent fill.
- **Press feedback is `PRESSED_OPACITY` (0.85) plus a light haptic.** Never scale, never a colour change.
- **Motion is tokenized only.** Sheet detents use `Animation.springs.drag` (damping 50 / stiffness 460). Do not introduce the canvas's raw "spring .82".
- **Teal `t.action` is for secured/booked. Amber `Semantic.warning` is for unfinished. Amber never gates the Add button.**
- **Fraunces 400 never below 20px; DM Sans runs the interface; DM Mono carries values that line up in a column** (times, dates, nights, distances).
- **Do not add dependencies.** In particular `expo-blur` is NOT installed and must not be added — use a tokenized solid fill over the hero scrim.
- **Do not change Firebase schemas, security rules, or backend logic.** Every write path (`bookingWrites`, `itineraryWrites`, `placeWrites`, `useBooking`) is reused unmodified.
- **Every custom component must be registered** in `.claude/skills/jernie-design/reference/custom-components.md` in the same change that introduces it.
- **Accessibility is part of completion:** 44px targets, `accessibilityRole`, `accessibilityLabel`, font scaling, reduced motion.
- **Commit after each task.** Never commit `.env` or secrets.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/addFlow.ts` | **Pure.** Phase machine, growth heights, Add gate, type-row dimming. No React, no RN, no Firebase. |
| `src/features/jernie/add/detailsFields.ts` | **Pure.** Per-type field specs, required sets, leg fields, completeness check. |
| `src/features/jernie/add/DetailsForm.tsx` | The form that finishes; every edit target. Replaces `BookingForm`. |
| `src/features/jernie/add/CardFieldTable.tsx` | The four rows and their confidence styling. |
| `src/features/jernie/add/SuggestionCard.tsx` | Identity row, divider, field table, footer row. |
| `src/features/jernie/add/MoreMatchesRow.tsx` | "4 more matches" and the ranked list it expands to. |
| `src/features/jernie/add/SkeletonCard.tsx` | Shimmer at the height the real card will take. |
| `src/features/jernie/add/MagicField.tsx` | The pinned query input. |
| `src/features/jernie/add/TypeRow.tsx` | Five chips; unpicked dim to 42%. |
| `src/features/jernie/add/AddContextChip.tsx` | "Bar Harbor · Sat 27", tappable to change day. |
| `src/features/jernie/add/QuestionBlock.tsx` | The one question, as taps, plus the picker escape. |
| `src/features/jernie/add/TrayList.tsx` | "Ready to add · N" and its rows. |
| `src/features/jernie/add/AddedStrip.tsx` | "Added Delta 2214 · Undo". |
| `src/features/jernie/add/AddSheet.tsx` | The shell: modal, detents, pinned header, orchestration. |
| `src/features/jernie/add/index.ts` | Public exports — `AddSheet`, `AddSheetRef`, `AddSheetPayload`. |
| `src/features/jernie/home/HeroAddButton.tsx` | The round `+`, pinned above the collapse. |

Files that change together live together: everything the sheet owns is in `src/features/jernie/add/`, and only the pure parts sit in `src/domain/`.

---

### Task 1: The phase machine

Tier: standard | Reasoning: medium - a self-contained pure module with a well-specified state table, but the growth and gate rules are load-bearing for every later task.

**Files:**
- Create: `src/domain/addFlow.ts`
- Test: `__tests__/domain/addFlow.test.ts`

**Interfaces:**
- Consumes: `Candidate`, `CandidateType`, `TypeConfidence`, `canCommit` from `src/domain/candidate.ts`; `MIN_QUERY_LENGTH` from `src/lib/resolveClient.ts`.
- Produces:
  - `type AddPhase = 'idle' | 'searching' | 'asking' | 'card' | 'details' | 'tray'`
  - `interface AddFlowState`
  - `type AddFlowAction`
  - `function initialAddFlowState(seed: AddFlowSeed): AddFlowState`
  - `function addFlowReducer(state: AddFlowState, action: AddFlowAction): AddFlowState`
  - `function addSheetHeight(phase: AddPhase, trayCount: number, windowHeight: number): number`
  - `function canAdd(state: AddFlowState): boolean`
  - `function typeRowOpacity(state: AddFlowState, type: CandidateType): number`
  - `const DIMMED_TYPE_OPACITY = 0.42`
  - `const SEARCH_DEBOUNCE_MS = 350`

- [ ] **Step 1: Write the failing test**

Create `__tests__/domain/addFlow.test.ts`:

```typescript
import {
  initialAddFlowState, addFlowReducer, addSheetHeight, canAdd, typeRowOpacity,
  DIMMED_TYPE_OPACITY, SEARCH_DEBOUNCE_MS,
} from '@/src/domain/addFlow';
import type { Candidate } from '@/src/domain/candidate';

const SEED = { stopId: 'stop-1', dayIso: '2026-09-27' };

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    type: 'eat',
    typeConfidence: 'explicit',
    identity: { name: "Thurston's Lobster Pound", subtitle: 'Seafood', icon: 'fork-knife' },
    fields: [],
    commit: {
      target: 'custom',
      item: { stopId: 'stop-1', dateIso: '2026-09-27', label: "Thurston's" },
    },
    ...over,
  } as Candidate;
}

describe('addFlow — opening', () => {
  it('opens idle with an empty query and no type picked', () => {
    const s = initialAddFlowState(SEED);
    expect(s.phase).toBe('idle');
    expect(s.query).toBe('');
    expect(s.type).toBeNull();
  });
});

describe('addFlow — searching', () => {
  it('stays idle while the query is too short to bill a lookup for', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'queryChanged', query: 'th' });
    expect(s.phase).toBe('idle');
  });

  it('shows the skeleton once a search starts', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'queryChanged', query: 'thurston' });
    s = addFlowReducer(s, { kind: 'searchStarted' });
    expect(s.phase).toBe('searching');
  });

  it('lands on the card with the top result selected', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded',
      results: [candidate({ id: 'a' }), candidate({ id: 'b' })],
      resolvedType: 'eat',
      typeConfidence: 'explicit',
    });
    expect(s.phase).toBe('card');
    expect(s.selected?.id).toBe('a');
  });

  it('falls through to the form when nothing matched, keeping the words typed', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'queryChanged', query: 'grandmas kayak place' });
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded', results: [], resolvedType: 'do', typeConfidence: 'fallback',
    });
    expect(s.phase).toBe('details');
    expect(s.query).toBe('grandmas kayak place');
    expect(s.typeConfidence).toBe('fallback');
  });

  it('asks the question first when the candidate carries one', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded',
      results: [candidate({
        question: {
          prompt: 'When are you eating?', fillsKey: 'time', picker: 'time',
          options: [{ label: '17:30', value: '17:30' }, { label: '19:00', value: '19:00' }],
        },
      })],
      resolvedType: 'eat',
      typeConfidence: 'explicit',
    });
    expect(s.phase).toBe('asking');
  });

  it('moves to the card once the question is answered', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded',
      results: [candidate({
        question: {
          prompt: 'When are you eating?', fillsKey: 'time', picker: 'time',
          options: [{ label: '17:30', value: '17:30' }],
        },
      })],
      resolvedType: 'eat',
      typeConfidence: 'explicit',
    });
    s = addFlowReducer(s, { kind: 'questionAnswered', fillsKey: 'time', value: '17:30' });
    expect(s.phase).toBe('card');
    expect(s.answers.time).toBe('17:30');
  });
});

describe('addFlow — more matches', () => {
  it('offers the rest without swapping the card under the finger', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded',
      results: [candidate({ id: 'a' }), candidate({ id: 'b' }), candidate({ id: 'c' })],
      resolvedType: 'eat', typeConfidence: 'explicit',
    });
    expect(s.expandedMatches).toBe(false);
    s = addFlowReducer(s, { kind: 'matchesExpanded' });
    expect(s.expandedMatches).toBe(true);
    expect(s.selected?.id).toBe('a');

    s = addFlowReducer(s, { kind: 'candidatePicked', candidate: candidate({ id: 'c' }) });
    expect(s.selected?.id).toBe('c');
    expect(s.expandedMatches).toBe(false);
    expect(s.phase).toBe('card');
  });
});

describe('addFlow — the type row', () => {
  it('leaves every chip at full weight until one is picked', () => {
    const s = initialAddFlowState(SEED);
    expect(typeRowOpacity(s, 'eat')).toBe(1);
    expect(typeRowOpacity(s, 'flight')).toBe(1);
  });

  it('dims the other four to 42% rather than hiding them', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'typePicked', type: 'eat' });
    expect(typeRowOpacity(s, 'eat')).toBe(1);
    expect(typeRowOpacity(s, 'flight')).toBe(DIMMED_TYPE_OPACITY);
    expect(DIMMED_TYPE_OPACITY).toBe(0.42);
  });
});

describe('addFlow — the Add gate', () => {
  it('is off with nothing selected', () => {
    expect(canAdd(initialAddFlowState(SEED))).toBe(false);
  });

  it('is on for a committable candidate, and an amber field does not turn it off', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded',
      results: [candidate({
        fields: [{ key: 'confirmation', label: 'Confirmation', value: null, confidence: 'wanted' }],
      })],
      resolvedType: 'eat', typeConfidence: 'explicit',
    });
    expect(canAdd(s)).toBe(true);
  });
});

describe('addFlow — committing', () => {
  it('re-arms the field and offers one undo', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'queryChanged', query: 'thurston' });
    s = addFlowReducer(s, { kind: 'searchStarted' });
    s = addFlowReducer(s, {
      kind: 'searchSucceeded', results: [candidate()],
      resolvedType: 'eat', typeConfidence: 'explicit',
    });
    s = addFlowReducer(s, {
      kind: 'committed', label: "Thurston's", inverse: { 'trips/t/x': null },
    });
    expect(s.phase).toBe('idle');
    expect(s.query).toBe('');
    expect(s.selected).toBeNull();
    expect(s.lastAdded?.label).toBe("Thurston's");

    s = addFlowReducer(s, { kind: 'undone' });
    expect(s.lastAdded).toBeNull();
  });

  it('grows into the tray without announcing a mode', () => {
    let s = initialAddFlowState(SEED);
    s = addFlowReducer(s, { kind: 'trayChanged', tray: [candidate(), candidate({ id: 'c2' })] });
    expect(s.phase).toBe('tray');
    expect(s.tray).toHaveLength(2);
  });
});

describe('addFlow — growth', () => {
  it('uses the canvas heights on a phone tall enough for them', () => {
    expect(addSheetHeight('idle', 0, 900)).toBe(560);
    expect(addSheetHeight('asking', 0, 900)).toBe(620);
    expect(addSheetHeight('card', 0, 900)).toBe(690);
    expect(addSheetHeight('tray', 2, 900)).toBe(730);
    expect(addSheetHeight('tray', 3, 900)).toBe(790);
  });

  it('shows the skeleton at the height the real card will take, so nothing jumps', () => {
    expect(addSheetHeight('searching', 0, 900)).toBe(addSheetHeight('card', 0, 900));
  });

  it('clamps to 92% of the window so 790 does not overrun a small phone', () => {
    expect(addSheetHeight('tray', 3, 700)).toBe(644);
  });

  it('debounces lookups at 350ms', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(350);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/domain/addFlow.test.ts
```

Expected: FAIL — `Cannot find module '@/src/domain/addFlow'`.

- [ ] **Step 3: Write the module**

Create `src/domain/addFlow.ts`. It imports **types only** from `candidate.ts` plus the `canCommit` predicate, and must not import React, React Native, or anything under `src/lib/` that touches Firebase.

```typescript
import { canCommit, type Candidate, type CandidateType, type TypeConfidence } from './candidate';

export type AddPhase = 'idle' | 'searching' | 'asking' | 'card' | 'details' | 'tray';

/** Unpicked chips dim; they never disappear, so one tap corrects a wrong guess. */
export const DIMMED_TYPE_OPACITY = 0.42;

/** Both vendors bill per call, so the field waits this long after the last keystroke. */
export const SEARCH_DEBOUNCE_MS = 350;

/** The canvas heights. `searching` deliberately equals `card` so nothing jumps on arrival. */
const HEIGHT: Record<AddPhase, number> = {
  idle: 560, searching: 690, asking: 620, card: 690, details: 690, tray: 730,
};
const TRAY_TALL_HEIGHT = 790;
const TRAY_TALL_FROM = 3;
const MAX_WINDOW_SHARE = 0.92;

export interface AddFlowSeed { stopId: string; dayIso: string; }

export interface AddFlowState {
  phase: AddPhase;
  seed: AddFlowSeed;
  query: string;
  type: CandidateType | null;
  typeConfidence: TypeConfidence;
  results: Candidate[];
  expandedMatches: boolean;
  selected: Candidate | null;
  answers: Record<string, string>;
  tray: Candidate[];
  lastAdded: { label: string; inverse: Record<string, unknown> } | null;
  error: string | null;
}

export type AddFlowAction =
  | { kind: 'queryChanged'; query: string }
  | { kind: 'typePicked'; type: CandidateType | null }
  | { kind: 'searchStarted' }
  | { kind: 'searchSucceeded'; results: Candidate[]; resolvedType: CandidateType; typeConfidence: TypeConfidence }
  | { kind: 'searchFailed'; message: string }
  | { kind: 'matchesExpanded' }
  | { kind: 'candidatePicked'; candidate: Candidate }
  | { kind: 'questionAnswered'; fillsKey: string; value: string }
  | { kind: 'detailsOpened' }
  | { kind: 'committed'; label: string; inverse: Record<string, unknown> }
  | { kind: 'undone' }
  | { kind: 'trayChanged'; tray: Candidate[] }
  | { kind: 'trayCommitted' };

export function initialAddFlowState(seed: AddFlowSeed): AddFlowState {
  return {
    phase: 'idle', seed, query: '', type: null, typeConfidence: 'explicit',
    results: [], expandedMatches: false, selected: null, answers: {},
    tray: [], lastAdded: null, error: null,
  };
}

export function addFlowReducer(state: AddFlowState, action: AddFlowAction): AddFlowState {
  switch (action.kind) {
    case 'queryChanged':
      // Typing again abandons whatever the last lookup produced; leaving the old card up
      // under a new query is how the wrong thing gets added.
      return { ...state, query: action.query, error: null,
        ...(state.phase === 'card' || state.phase === 'asking'
          ? { phase: 'idle' as const, selected: null, results: [], expandedMatches: false }
          : {}) };

    case 'typePicked':
      return { ...state, type: action.type, typeConfidence: 'explicit' };

    case 'searchStarted':
      return { ...state, phase: 'searching', error: null };

    case 'searchSucceeded': {
      const base = {
        ...state,
        results: action.results,
        type: action.resolvedType,
        typeConfidence: action.typeConfidence,
        expandedMatches: false,
      };
      // No match is not an error screen. It is the same sheet with empty fields and the
      // user's own words kept as the title.
      if (action.results.length === 0) {
        return { ...base, phase: 'details', selected: null };
      }
      const top = action.results[0];
      return { ...base, phase: top.question ? 'asking' : 'card', selected: top };
    }

    case 'searchFailed':
      return { ...state, phase: 'idle', error: action.message };

    case 'matchesExpanded':
      return { ...state, expandedMatches: true };

    case 'candidatePicked':
      return { ...state, selected: action.candidate, expandedMatches: false,
        phase: action.candidate.question ? 'asking' : 'card' };

    case 'questionAnswered':
      return { ...state, phase: 'card',
        answers: { ...state.answers, [action.fillsKey]: action.value } };

    case 'detailsOpened':
      return { ...state, phase: 'details' };

    case 'committed':
      return { ...state, phase: 'idle', query: '', selected: null, results: [],
        expandedMatches: false, answers: {},
        lastAdded: { label: action.label, inverse: action.inverse } };

    case 'undone':
      return { ...state, lastAdded: null };

    case 'trayChanged':
      return { ...state, tray: action.tray,
        phase: action.tray.length > 0 ? 'tray' : 'idle',
        query: '', selected: null, results: [], expandedMatches: false, answers: {} };

    case 'trayCommitted':
      return { ...state, tray: [], phase: 'idle' };
  }
}

export function addSheetHeight(phase: AddPhase, trayCount: number, windowHeight: number): number {
  const drawn = phase === 'tray' && trayCount >= TRAY_TALL_FROM ? TRAY_TALL_HEIGHT : HEIGHT[phase];
  // The canvas numbers were drawn on one handset. Taken literally, 790 overruns an SE — the
  // same lesson stopCardWidth() records for the stop rail's 292.
  return Math.min(drawn, Math.round(windowHeight * MAX_WINDOW_SHARE));
}

/**
 * Add turns on when title, type, day and stop are all true. `canCommit` reads the commit
 * payload alone, which is exactly why an amber field cannot reach it.
 */
export function canAdd(state: AddFlowState): boolean {
  return state.selected !== null && canCommit(state.selected);
}

export function typeRowOpacity(state: AddFlowState, type: CandidateType): number {
  if (state.type === null) return 1;
  return state.type === type ? 1 : DIMMED_TYPE_OPACITY;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
cd ~/jernie-fresh && npx jest __tests__/domain/addFlow.test.ts
```

Expected: PASS, 16 tests. **Read the suite count** — a suite that fails to compile reports zero tests and still prints no failures.

- [ ] **Step 5: Typecheck and commit**

```bash
cd ~/jernie-fresh && npx tsc --noEmit
git add src/domain/addFlow.ts __tests__/domain/addFlow.test.ts
git commit -m "feat(add-flow): the phase machine, as a pure reducer

Growth, the Add gate and type dimming are decided here rather than inside
the sheet, so the rules that matter can be tested without rendering
anything. The heights are the canvas's, clamped to a share of the window
for the reason stopCardWidth() is a share: a constant drawn on one handset
reads as a different weight on every other one."
```

---

### Task 2: Field specs and validation, ported

Tier: standard | Reasoning: medium - mechanical transcription against an existing table, but the rental range machine and flight leg completeness are the two rules a rewrite silently drops.

This is the pure half of the form replacement. Every value here is **ported verbatim** from
`src/features/jernie/BookingForm.tsx` before that file is deleted in Task 9. Read the original
alongside this task; do not retype the tables from the spec's summary.

**Files:**
- Create: `src/features/jernie/add/detailsFields.ts`
- Test: `__tests__/domain/detailsFields.test.ts`
- Read (do not modify): `src/features/jernie/BookingForm.tsx:36-95` and `:188-220`

**Interfaces:**
- Consumes: `CandidateType` from `src/domain/candidate.ts`; `BookingType` from `src/types`.
- Produces:
  - `type DetailsKind = 'hotel' | 'restaurant' | 'rental' | 'flight' | 'custom'`
  - `interface DetailsFieldSpec { key: string; label: string; kind: 'text' | 'date' | 'time' | 'number'; placeholder?: string; autoCapitalize?: 'characters' }`
  - `const DETAILS_FIELDS: Record<DetailsKind, readonly DetailsFieldSpec[]>`
  - `const DETAILS_REQUIRED: Record<DetailsKind, readonly string[]>`
  - `const LEG_FIELDS: readonly DetailsFieldSpec[]`
  - `function emptyLeg(): Record<string, string>`
  - `function isComplete(kind: DetailsKind, values: Record<string, string>, legs: readonly Record<string, string>[]): boolean`
  - `function nextRange(range: { start: string; end: string }, tapped: string): { start: string; end: string }`
  - `function detailsKindFor(type: CandidateType, renting: boolean): DetailsKind`
  - `function bookingTypeFor(kind: DetailsKind): BookingType | null`

- [ ] **Step 1: Write the failing test**

Create `__tests__/domain/detailsFields.test.ts`:

```typescript
import {
  DETAILS_FIELDS, DETAILS_REQUIRED, LEG_FIELDS, emptyLeg,
  isComplete, nextRange, detailsKindFor, bookingTypeFor,
} from '@/src/features/jernie/add/detailsFields';

describe('detailsFields — the ported tables', () => {
  it('keeps every hotel field the old form had', () => {
    expect(DETAILS_FIELDS.hotel.map(f => f.key)).toEqual([
      'hotelName', 'checkIn', 'checkOut', 'roomType', 'address', 'confirmationCode',
    ]);
  });

  it('keeps every rental field, and its two dates stay required despite having no row', () => {
    expect(DETAILS_FIELDS.rental.map(f => f.key)).toEqual([
      'company', 'carType', 'pickupLocation', 'pickupTime',
      'dropoffLocation', 'dropoffTime', 'confirmationCode',
    ]);
    expect(DETAILS_REQUIRED.rental).toEqual([
      'company', 'pickupDate', 'dropoffDate', 'pickupLocation', 'dropoffLocation',
    ]);
  });

  it('keeps all seven leg fields', () => {
    expect(LEG_FIELDS.map(f => f.key)).toEqual([
      'airline', 'flightNumber', 'origin', 'destination',
      'departureDate', 'departureTime', 'arrivalTime',
    ]);
  });
});

describe('detailsFields — completeness', () => {
  it('needs a hotel name and both dates', () => {
    expect(isComplete('hotel', { hotelName: 'Bluenose Inn' }, [])).toBe(false);
    expect(isComplete('hotel', {
      hotelName: 'Bluenose Inn', checkIn: '2026-09-27', checkOut: '2026-09-29',
    }, [])).toBe(true);
  });

  it('does not accept whitespace as an answer', () => {
    expect(isComplete('restaurant', { restaurantName: '   ', date: '2026-09-27' }, [])).toBe(false);
  });

  it('needs a rental range even though neither date has an input row', () => {
    const base = { company: 'Hertz', pickupLocation: 'PWM', dropoffLocation: 'BOS' };
    expect(isComplete('rental', base, [])).toBe(false);
    expect(isComplete('rental', {
      ...base, pickupDate: '2026-09-27', dropoffDate: '2026-09-29',
    }, [])).toBe(true);
  });

  it('needs at least one leg, with every field of every leg filled', () => {
    const full = {
      airline: 'Delta', flightNumber: 'DL2214', origin: 'BOS', destination: 'BHB',
      departureDate: '2026-09-27', departureTime: '10:15', arrivalTime: '11:22',
    };
    expect(isComplete('flight', {}, [])).toBe(false);
    expect(isComplete('flight', {}, [full])).toBe(true);
    expect(isComplete('flight', {}, [full, { ...full, airline: '' }])).toBe(false);
  });

  it('needs only a title and a day for a custom item', () => {
    expect(isComplete('custom', { title: 'Ferry to Peaks Island' }, [])).toBe(false);
    expect(isComplete('custom', {
      title: 'Ferry to Peaks Island', day: '2026-09-27',
    }, [])).toBe(true);
  });
});

describe('detailsFields — the rental range machine', () => {
  it('takes the first tap as the pickup', () => {
    expect(nextRange({ start: '', end: '' }, '2026-09-27'))
      .toEqual({ start: '2026-09-27', end: '' });
  });

  it('takes a later second tap as the dropoff', () => {
    expect(nextRange({ start: '2026-09-27', end: '' }, '2026-09-29'))
      .toEqual({ start: '2026-09-27', end: '2026-09-29' });
  });

  it('swaps rather than accepting a backwards range', () => {
    expect(nextRange({ start: '2026-09-29', end: '' }, '2026-09-27'))
      .toEqual({ start: '2026-09-27', end: '2026-09-29' });
  });

  it('starts a new range once one is complete', () => {
    expect(nextRange({ start: '2026-09-27', end: '2026-09-29' }, '2026-10-02'))
      .toEqual({ start: '2026-10-02', end: '' });
  });
});

describe('detailsFields — routing a type to a form', () => {
  it('sends Drive to a rental only when the user says they are renting', () => {
    expect(detailsKindFor('drive', true)).toBe('rental');
    expect(detailsKindFor('drive', false)).toBe('custom');
  });

  it('maps the other four the way the writes expect', () => {
    expect(detailsKindFor('stay', false)).toBe('hotel');
    expect(detailsKindFor('eat', false)).toBe('restaurant');
    expect(detailsKindFor('flight', false)).toBe('flight');
    expect(detailsKindFor('do', false)).toBe('custom');
  });

  it('reports which kinds are bookings and which are not', () => {
    expect(bookingTypeFor('rental')).toBe('rental');
    expect(bookingTypeFor('hotel')).toBe('hotel');
    expect(bookingTypeFor('custom')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/domain/detailsFields.test.ts
```

Expected: FAIL — `Cannot find module '.../detailsFields'`.

- [ ] **Step 3: Write the module**

Create `src/features/jernie/add/detailsFields.ts`. Copy `FIELDS`, `REQUIRED` and `LEG_FIELDS`
out of `BookingForm.tsx:45-95` unchanged, add the `custom` kind, and lift the range machine out
of `BookingForm.tsx:191-197` into `nextRange`.

```typescript
import type { CandidateType } from '@/src/domain/candidate';
import type { BookingType } from '@/src/types';

export type DetailsKind = 'hotel' | 'restaurant' | 'rental' | 'flight' | 'custom';

export interface DetailsFieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'time' | 'number';
  placeholder?: string;
  autoCapitalize?: 'characters';
}

export const DETAILS_FIELDS: Record<DetailsKind, readonly DetailsFieldSpec[]> = {
  hotel: [
    { key: 'hotelName',        label: 'Hotel name',        kind: 'text', placeholder: 'e.g. The Press Hotel' },
    { key: 'checkIn',          label: 'Check-in',          kind: 'date' },
    { key: 'checkOut',         label: 'Check-out',         kind: 'date' },
    { key: 'roomType',         label: 'Room type',         kind: 'text', placeholder: 'Optional' },
    { key: 'address',          label: 'Address',           kind: 'text', placeholder: 'Optional' },
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  restaurant: [
    { key: 'restaurantName',   label: 'Restaurant',        kind: 'text', placeholder: 'e.g. Fore Street' },
    { key: 'date',             label: 'Date',              kind: 'date' },
    { key: 'time',             label: 'Time',              kind: 'time', placeholder: 'e.g. 7:30 PM' },
    { key: 'partySize',        label: 'Party size',        kind: 'number', placeholder: 'Optional' },
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  // pickupDate / dropoffDate are absent on purpose: they are range-picked through one shared
  // calendar and have no row of their own. DETAILS_REQUIRED still validates them.
  rental: [
    { key: 'company',          label: 'Company',           kind: 'text', placeholder: 'e.g. Hertz' },
    { key: 'carType',          label: 'Car type',          kind: 'text', placeholder: 'Optional' },
    { key: 'pickupLocation',   label: 'Pickup location',   kind: 'text', placeholder: 'e.g. PWM Airport' },
    { key: 'pickupTime',       label: 'Pickup time',       kind: 'time', placeholder: 'Optional' },
    { key: 'dropoffLocation',  label: 'Dropoff location',  kind: 'text', placeholder: 'e.g. BOS Airport' },
    { key: 'dropoffTime',      label: 'Dropoff time',      kind: 'time', placeholder: 'Optional' },
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  flight: [
    { key: 'confirmationCode', label: 'Confirmation code', kind: 'text', placeholder: 'Optional', autoCapitalize: 'characters' },
  ],
  custom: [
    { key: 'title',            label: 'Title',             kind: 'text', placeholder: 'e.g. Ferry to Peaks Island' },
    { key: 'day',              label: 'Day',               kind: 'date' },
    { key: 'time',             label: 'Time',              kind: 'time', placeholder: 'Optional' },
    { key: 'where',            label: 'Where',             kind: 'text', placeholder: 'Optional' },
    { key: 'booking',          label: 'Booking',           kind: 'text', placeholder: 'Optional' },
  ],
};

export const DETAILS_REQUIRED: Record<DetailsKind, readonly string[]> = {
  hotel: ['hotelName', 'checkIn', 'checkOut'],
  restaurant: ['restaurantName', 'date'],
  rental: ['company', 'pickupDate', 'dropoffDate', 'pickupLocation', 'dropoffLocation'],
  flight: [],   // every leg field is required instead — see isComplete
  custom: ['title', 'day'],
};

export const LEG_FIELDS: readonly DetailsFieldSpec[] = [
  { key: 'airline',       label: 'Airline',        kind: 'text', placeholder: 'e.g. American' },
  { key: 'flightNumber',  label: 'Flight number',  kind: 'text', placeholder: 'e.g. AA123', autoCapitalize: 'characters' },
  { key: 'origin',        label: 'From',           kind: 'text', placeholder: 'IATA, e.g. CLT', autoCapitalize: 'characters' },
  { key: 'destination',   label: 'To',             kind: 'text', placeholder: 'IATA, e.g. BWI', autoCapitalize: 'characters' },
  { key: 'departureDate', label: 'Departure date', kind: 'date' },
  { key: 'departureTime', label: 'Departure time', kind: 'time', placeholder: 'e.g. 8:00 AM' },
  { key: 'arrivalTime',   label: 'Arrival time',   kind: 'time', placeholder: 'e.g. 9:30 AM' },
];

export function emptyLeg(): Record<string, string> {
  return Object.fromEntries(LEG_FIELDS.map(f => [f.key, '']));
}

const filled = (v: string | undefined) => (v ?? '').trim() !== '';

export function isComplete(
  kind: DetailsKind,
  values: Record<string, string>,
  legs: readonly Record<string, string>[],
): boolean {
  if (kind === 'flight') {
    return legs.length > 0 && legs.every(leg => LEG_FIELDS.every(f => filled(leg[f.key])));
  }
  return DETAILS_REQUIRED[kind].every(key => filled(values[key]));
}

/**
 * Pickup and dropoff share one calendar. Tapping an earlier day than the pickup swaps rather
 * than rejecting, so a backwards range is impossible by construction — the same machine
 * StopForm uses for a stop's dates.
 */
export function nextRange(
  range: { start: string; end: string },
  tapped: string,
): { start: string; end: string } {
  if (!range.start || range.end) return { start: tapped, end: '' };
  if (tapped < range.start) return { start: tapped, end: range.start };
  return { start: range.start, end: tapped };
}

/** Drive covers both a driving leg and a rental; the form asks which before it renders. */
export function detailsKindFor(type: CandidateType, renting: boolean): DetailsKind {
  if (type === 'stay') return 'hotel';
  if (type === 'eat') return 'restaurant';
  if (type === 'flight') return 'flight';
  if (type === 'drive') return renting ? 'rental' : 'custom';
  return 'custom';
}

export function bookingTypeFor(kind: DetailsKind): BookingType | null {
  if (kind === 'custom') return null;
  return kind;
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
cd ~/jernie-fresh && npx jest __tests__/domain/detailsFields.test.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
cd ~/jernie-fresh && npx tsc --noEmit
git add src/features/jernie/add/detailsFields.ts __tests__/domain/detailsFields.test.ts
git commit -m "feat(add-flow): port the booking field tables and their validation

Lifted out of BookingForm before it is deleted, unchanged, so the
replacement form argues from the same tables rather than from a summary of
them. Two rules were only ever implicit in the component and are now
tested: rental's pickup and dropoff are required despite having no input
row of their own, and tapping a day earlier than the pickup swaps the range
instead of rejecting it."
```

---

### Task 3: `DetailsForm` — the form that finishes

Tier: deep | Reasoning: high - this is the plan's whole regression surface. It re-derives 520 lines of working validation, multi-leg flight entry and two calendar behaviours, and a quiet mistake here stops a booking shape being creatable without anything failing loudly.

**Files:**
- Create: `src/features/jernie/add/DetailsForm.tsx`
- Test: `__tests__/components/DetailsForm.test.tsx`
- Read (do not modify): `src/features/jernie/BookingForm.tsx` in full, and `__tests__/components/BookingForm.test.tsx` in full

**Interfaces:**
- Consumes: everything Task 2 produces; `NewBooking`, `BookingPatch` from `src/lib/bookingWrites.ts`; `Core`, `Semantic`, `Spacing`, `Radius`, `Typography`, `Gutter` from `src/design/tokens.ts`; `createThemedStyles`, `useTheme` from `src/design/useTheme.ts`; `Button` from `src/ui`.
- Produces:
  - `interface DetailsFormValues extends Record<string, string> {}`
  - `interface DetailsFormProps { kind: DetailsKind; stopId: string; initialValues?: DetailsFormValues; initialLegs?: Record<string, string>[]; submitLabel: string; onSubmit: (result: DetailsFormResult) => Promise<void>; onCancel?: () => void; onRemove?: () => void }`
  - `type DetailsFormResult = { kind: 'booking'; booking: NewBooking } | { kind: 'custom'; values: DetailsFormValues }`
  - `export function DetailsForm(props: DetailsFormProps): JSX.Element`

**The component must carry all of this. Each is a case in the deleted suite:**

1. Every field in `DETAILS_FIELDS[kind]` renders, with `testID={'details-form-' + key}`.
2. Submit is disabled until `isComplete` passes, and its `testID` is `details-form-submit-button`.
3. `kind: 'date'` fields render a **disclosure calendar** — a trigger that toggles a
   `react-native-calendars` `Calendar` below it, `testID={'details-form-' + key + '-calendar'}`.
4. Rental's pickup and dropoff are **two triggers over one shared range calendar**,
   `testID="details-form-rental-dates-calendar"`, driven by `nextRange`.
5. Flight renders repeatable leg groups, fields at
   `testID={'details-form-leg-' + i + '-' + key}`, with an `details-form-add-leg` control.
6. `initialValues` seeds edit mode; `initialLegs` seeds a flight's legs.
7. A rejected `onSubmit` leaves the typed values in place and re-enables submit, so the user
   retries without re-typing.
8. `onCancel` renders a cancel control only when the prop is supplied.
9. `onRemove` renders a Remove control only when supplied — the edit path.
10. Blank optional fields are **omitted** from the result, never written as empty strings.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/DetailsForm.test.tsx`. Reuse the deleted suite's harness verbatim —
the mock, `renderForm`, `id`, `setText`, `dayData`, `pickDate`, `pickRentalRange`,
`submitDisabled`, `pressSubmit`, `fillLeg` — retargeted from `booking-form-` to `details-form-`.
Copy them out of `__tests__/components/BookingForm.test.tsx:1-76` and change only the testID
prefix.

Then port every case. The full list, which must all appear:

```typescript
describe('DetailsForm — hotel', () => {
  it('renders every hotel field', () => { /* assert each key from DETAILS_FIELDS.hotel */ });
  it('keeps submit disabled until name, check-in and check-out are all filled', () => {});
  it('omits blank optionals rather than writing empty strings', () => {});
});

describe('DetailsForm — restaurant', () => {
  it('renders every restaurant field', () => {});
  it('keeps submit disabled until name and date are filled', () => {});
  it('passes party size through as typed', () => {});
});

describe('DetailsForm — rental', () => {
  it('renders every rental field', () => {});
  it('picks pickup and dropoff from one shared range calendar', () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const tree = renderForm(
      <DetailsForm kind="rental" stopId={STOP_ID} submitLabel="Add" onSubmit={onSubmit} />,
    );
    setText(tree, 'company', 'Hertz');
    setText(tree, 'pickupLocation', 'PWM Airport');
    setText(tree, 'dropoffLocation', 'BOS Airport');
    pickRentalRange(tree, '2026-09-27', '2026-09-29');
    expect(submitDisabled(tree)).toBe(false);
  });
  it('swaps the range when the second tap is earlier than the first', () => {});
});

describe('DetailsForm — flight', () => {
  it('starts with one empty leg', () => {});
  it('adds a second leg on demand', () => {});
  it('keeps submit disabled until every field of every leg is filled', () => {});
  it('submits both legs in order', () => {});
  it('shares one confirmation code across the legs', () => {});
});

describe('DetailsForm — custom', () => {
  it('needs only a title and a day', () => {});
  it('seeds the title from the words the user typed', () => {});
});

describe('DetailsForm — edit mode', () => {
  it('seeds every field from initialValues', () => {});
  it('seeds a flight from initialLegs', () => {});
  it('offers Remove only when onRemove is supplied', () => {});
});

describe('DetailsForm — submit rejection', () => {
  it('keeps the typed values and re-enables submit so nothing is retyped', () => {});
});

describe('DetailsForm — cancel', () => {
  it('renders a cancel control only when onCancel is supplied', () => {});
});
```

Fill each body from the matching case in `BookingForm.test.tsx`. **Do not invent new
assertions and do not drop any** — the count must be at least the deleted suite's 17.

- [ ] **Step 2: Run the test and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/components/DetailsForm.test.tsx
```

Expected: FAIL — `Cannot find module '.../DetailsForm'`. Confirm the failure is the missing
module, not a broken harness import.

- [ ] **Step 3: Write the component**

Structure it as `BookingForm` was — one field loop over `DETAILS_FIELDS[kind]` with a switch on
`spec.kind` — but style it to the suggestion card's anatomy rather than the old form's:

- An aligned label column, so the form reads as the card's field table continued.
- Values that line up in a column (dates, times, party size, flight numbers) use
  `Typography.mono`. Prose values use DM Sans.
- A required-but-empty field reads amber (`Semantic.warning`); an optional one says
  "Optional" in `t.textFaint`. Never a red asterisk.
- Colours through `createThemedStyles(t => ...)`; no literals.
- Every trigger and input is at least 44px tall.

Keep the calendar behaviour identical to the original: `openDateField` state holding either a
field key or `'rental-dates'`, a single open disclosure at a time, and the marked-period props
built from the current range.

- [ ] **Step 4: Run the test and watch it pass**

```bash
cd ~/jernie-fresh && npx jest __tests__/components/DetailsForm.test.tsx
```

Expected: PASS. **Read the printed suite and test counts** — a suite that fails to compile
reports zero tests and prints no failures, and `tsc --noEmit` will not catch it because
`tsconfig.json` excludes `__tests__`.

- [ ] **Step 5: Run the whole suite and commit**

```bash
cd ~/jernie-fresh && npm test && npx tsc --noEmit
git add src/features/jernie/add/DetailsForm.tsx __tests__/components/DetailsForm.test.tsx
git commit -m "feat(add-flow): the form that finishes

Written against the card's anatomy rather than the old form's: an aligned
label column, mono for values that line up, amber for a required blank and
the word Optional for the rest.

Every case from BookingForm's suite is ported before the component exists,
because the risk in replacing a form is not that it looks wrong, it is that
a booking shape quietly stops being creatable. The two that would have gone
missing are rental's shared range calendar and a flight's per-leg
completeness."
```

---

### Task 4: The suggestion card

Tier: standard | Reasoning: medium - presentation over a settled contract, but the confidence-to-styling mapping is a design invariant and the "more matches" row is a departure from the canvas that has to be registered.

**Files:**
- Create: `src/features/jernie/add/CardFieldTable.tsx`, `src/features/jernie/add/SuggestionCard.tsx`, `src/features/jernie/add/MoreMatchesRow.tsx`, `src/features/jernie/add/SkeletonCard.tsx`
- Modify: `.claude/skills/jernie-design/reference/custom-components.md` (add one row)
- Test: `__tests__/components/SuggestionCard.test.tsx`

**Interfaces:**
- Consumes: `Candidate`, `ResolvedField`, `FieldConfidence` from `src/domain/candidate.ts`; `ListRow` from `src/ui`; `iconFor` from `src/design/icons.ts`.
- Produces:
  - `function CardFieldTable(props: { fields: readonly ResolvedField[] }): JSX.Element`
  - `function SuggestionCard(props: { candidate: Candidate; onOpenDetails: () => void }): JSX.Element`
  - `function MoreMatchesRow(props: { count: number; expanded: boolean; results: readonly Candidate[]; onExpand: () => void; onPick: (c: Candidate) => void }): JSX.Element | null`
  - `function SkeletonCard(): JSX.Element`

**Anatomy, fixed for all five types:** identity row (icon, name, one line of source truth, and
the Pulled badge — never more than two lines) → divider → four-row field table → one footer row
carrying a single consequence.

**The confidence mapping is a design invariant, not a styling choice:**

| `confidence` | Renders as |
| --- | --- |
| `pulled` | `Typography.mono`, `t.text` |
| `inferred` | `Typography.mono`, `t.textMuted` |
| `wanted` | `Semantic.warning`, showing `placeholder` as the value ("Add code") |
| `absent` | `t.textFaint`, "Not in the schedule" |

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/SuggestionCard.test.tsx` asserting:

```typescript
describe('SuggestionCard', () => {
  it('renders exactly the four declared rows for its type', () => {});
  it('reads a pulled value in mono and an inferred one in grey', () => {});
  it('shows a wanted field in amber with its placeholder as the value', () => {});
  it('says "Not in the schedule" for an absent field', () => {});
  it('renders the footer row when the candidate carries one', () => {});
  it('omits the footer entirely when it does not', () => {});
});

describe('MoreMatchesRow', () => {
  it('renders nothing when only one thing matched', () => {});
  it('counts the matches that are not already on the card', () => {
    // 4 results → "3 more matches", because the first one IS the card
  });
  it('lists the rest only after it is expanded', () => {});
  it('hands back the candidate that was tapped', () => {});
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/components/SuggestionCard.test.tsx
```

Expected: FAIL — missing modules.

- [ ] **Step 3: Build the four components**

`SkeletonCard` is the shimmer named in `react-native-mapping.md`: a translating
`expo-linear-gradient` over a grey block, driven by Reanimated. It must occupy the **same
height** the real card will, which is why `addSheetHeight('searching')` equals
`addSheetHeight('card')`. Respect `useReducedMotion()` — hold a static block rather than
animating.

`MoreMatchesRow` returns `null` for a single result. The collapsed row reads
`"{count} more matches"`; expanded, it renders the remaining candidates as `ListRow`s with the
candidate's name as title and `identity.subtitle` as sub.

- [ ] **Step 4: Run and watch it pass**

```bash
cd ~/jernie-fresh && npx jest __tests__/components/SuggestionCard.test.tsx
```

- [ ] **Step 5: Register the departure and commit**

Add one row to the register in `.claude/skills/jernie-design/reference/custom-components.md`,
above the `<!-- Add new rows above this line -->` marker:

```markdown
| Add-flow `MoreMatchesRow` | — | The canvas draws one suggestion card and never says what ten matches look like. Showing only the top hit is how the wrong restaurant gets added silently, and the stop picker already settled the principle: every match is offered, nothing resolves without a tap. The card keeps the canvas's anatomy exactly; this is one quiet row beneath it that expands to the rest. |
```

```bash
cd ~/jernie-fresh && npx tsc --noEmit
git add src/features/jernie/add/ __tests__/components/SuggestionCard.test.tsx .claude/skills/jernie-design/reference/custom-components.md
git commit -m "feat(add-flow): the suggestion card, and a way to reach the other matches

The card is the canvas's anatomy unchanged. The row beneath it is not in
the canvas, which draws a single card and never says what happens when ten
places match — and showing only the top hit is how the wrong restaurant
gets added without anyone noticing. Registered as a departure with its
reasoning."
```

---

### Task 5: The pinned header and the question

Tier: standard | Reasoning: medium - small components, but "the query never moves" is structural and the type row's dimming is a stated design rule.

**Files:**
- Create: `src/features/jernie/add/AddContextChip.tsx`, `src/features/jernie/add/MagicField.tsx`, `src/features/jernie/add/TypeRow.tsx`, `src/features/jernie/add/QuestionBlock.tsx`
- Test: `__tests__/components/AddSheetHeader.test.tsx`

**Interfaces:**
- Consumes: `typeRowOpacity`, `DIMMED_TYPE_OPACITY`, `SEARCH_DEBOUNCE_MS` from `src/domain/addFlow.ts`; `Chip` from `src/ui`; `OpenQuestion` from `src/domain/candidate.ts`.
- Produces:
  - `function AddContextChip(props: { stopName: string; dayLabel: string | null; onPress: () => void }): JSX.Element`
  - `function MagicField(props: { value: string; onChangeText: (t: string) => void; placeholder: string; onClear: () => void }): JSX.Element`
  - `function TypeRow(props: { selected: CandidateType | null; onPick: (t: CandidateType | null) => void }): JSX.Element`
  - `function QuestionBlock(props: { question: OpenQuestion; onAnswer: (value: string) => void; onOpenPicker: () => void }): JSX.Element`
  - `const TYPE_ORDER: readonly CandidateType[] = ['flight', 'stay', 'eat', 'do', 'drive']`

- [ ] **Step 1: Write the failing test**

```typescript
describe('TypeRow', () => {
  it('shows all five in the canvas order', () => {
    // flight, stay, eat, do, drive
  });
  it('keeps every chip visible when nothing is picked', () => {});
  it('dims the other four to 42% rather than hiding them', () => {});
  it('clears the type when the selected chip is pressed again', () => {});
});

describe('MagicField', () => {
  it('takes the placeholder the design asks for', () => {
    // "Flight no., place, code, or link"
  });
  it('offers a clear control only once something is typed', () => {});
});

describe('QuestionBlock', () => {
  it('renders the prompt and its options as taps', () => {});
  it("labels the sheet's own day as such", () => {
    // "Sat 27 Sep · Your day"
  });
  it('offers the picker escape when the question has one', () => {});
  it('offers no picker when picker is null', () => {});
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/components/AddSheetHeader.test.tsx
```

- [ ] **Step 3: Build them**

`TypeRow` uses the `Chip` primitive with `variant="filter"`. Dimming is opacity on the chip
wrapper, animated on `Animation.springs.gentle` — **not** a colour change, which the design
system reserves. Pressing the selected chip clears the type, the same affordance
`CustomItemSheet`'s category picker used.

`MagicField` is a plain `TextInput` styled from tokens, `returnKeyType="search"`,
`autoCorrect={false}`, `autoCapitalize="none"`. **It does not own the debounce** — `AddSheet`
does, using `SEARCH_DEBOUNCE_MS`. Keep this component controlled and dumb so the sheet can
re-arm it after a commit.

`QuestionBlock` renders `question.options` as `Chip`s and, when `question.picker` is non-null,
a final "Another date" / "Another time" chip that calls `onOpenPicker`.

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Commit**

```bash
cd ~/jernie-fresh && npx tsc --noEmit
git add src/features/jernie/add/ __tests__/components/AddSheetHeader.test.tsx
git commit -m "feat(add-flow): the pinned header and the one question

The three pieces that never move: chip, field, type row. Kept dumb and
controlled so the sheet can re-arm the field after a commit without the
component holding its own idea of what was typed.

Unpicked types dim rather than disappearing, which is what makes a wrong
guess one tap from corrected instead of a dead end."
```

---

### Task 6: The tray and the undo strip

Tier: standard | Reasoning: medium - thin presentation over addTray and batchCommit, both finished and tested; the one rule that matters is that a batch is one write and therefore one undo.

**Files:**
- Create: `src/features/jernie/add/TrayList.tsx`, `src/features/jernie/add/AddedStrip.tsx`
- Test: `__tests__/components/TrayList.test.tsx`

**Interfaces:**
- Consumes: `getTray`, `addToTray`, `removeFromTray`, `clearTray`, `subscribe` from `src/lib/addTray.ts`; `ListRow` from `src/ui`.
- Produces:
  - `function TrayList(props: { items: readonly Candidate[]; onRemove: (id: string) => void }): JSX.Element`
  - `function AddedStrip(props: { label: string; onUndo: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```typescript
describe('TrayList', () => {
  it('counts what is ready to add', () => {
    // "Ready to add · 2"
  });
  it('renders one row per candidate with its day and time', () => {});
  it('removes the row that was tapped, not the first one', () => {});
});

describe('AddedStrip', () => {
  it('names what was added rather than saying "Item added"', () => {
    // "Added Delta 2214"
  });
  it('offers exactly one undo', () => {});
});
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Build them**

`AddedStrip` is deliberately **not** `ItineraryUndoToast`. That component's dismissal *is* its
database commit — a deferred-write lifecycle with busy/failed/retry. Here the write has already
landed and undo reverses it, so this is a quiet in-sheet strip with a label and one action. Use
inverse ink (`t.text` background, `t.surface` label), never red: an add that succeeded is not a
failure.

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Commit**

```bash
cd ~/jernie-fresh && npx tsc --noEmit
git add src/features/jernie/add/ __tests__/components/TrayList.test.tsx
git commit -m "feat(add-flow): the tray list and the undo strip

Nothing switches modes: the sheet grows a Ready to add list and the button
counts up. The strip is its own component rather than ItineraryUndoToast,
whose dismissal is its commit — here the write has already landed and undo
reverses it, which is the opposite lifecycle."
```

---

### Task 7: `AddSheet` — the shell

Tier: deep | Reasoning: high - the integration point for every previous task, plus sheet detents, debounced billed lookups, day resolution and three commit paths. Getting the pinned-header structure wrong is not a styling bug, it breaks the design's central rule.

**Files:**
- Create: `src/features/jernie/add/AddSheet.tsx`, `src/features/jernie/add/index.ts`
- Test: `__tests__/components/AddSheet.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1 and 4–6; `resolveQuery` from `src/lib/resolveClient.ts`; `buildCandidate` from `src/domain/candidate.ts`; `commitCandidates`, `undoCommit` from `src/lib/addFlowWrites.ts`; `describeCallableError` from `src/domain/callableError.ts`; `useSheetContext` from `src/contexts/SheetContext.tsx`; `DayPickerSheet` from `src/features/jernie/sheets/DayPickerSheet.tsx`; `useBooking` from `src/hooks/useBooking.ts`; `addCustomItineraryItem`, `updateItineraryItem`, `removeItineraryItem` from `src/lib/itineraryWrites.ts`; `confirmDelete` from `src/utils/confirmDelete.ts`.
- Produces:
  - `type AddSheetRef = { present: (payload: AddSheetPayload) => void; dismiss: () => void }`
  - `interface AddSheetPayload { stopId: string; day?: ItineraryDay; typeHint?: CandidateType; query?: string; editing?: { kind: 'booking'; booking: Booking } | { kind: 'item'; item: ItineraryItem; day: ItineraryDay } }`
  - `const AddSheet: React.ForwardRefExoticComponent<AddSheetProps & React.RefAttributes<AddSheetRef>>`
  - `interface AddSheetProps { tripId: string; stops: readonly Stop[]; itinerary: Record<string, ItineraryDay[]>; onSaved: () => void }`

**Structure — this part is not negotiable.** The design's central rule is *"the query never
moves; the field stays pinned under the chip at every height; results and fields grow beneath
it."* That is a structural requirement, so:

```tsx
<BottomSheetModal snapPoints={snapPoints} ...>
  {/* PINNED — outside the scroll view */}
  <View style={s.pinned}>
    <AddContextChip ... />
    <MagicField ... />
    <TypeRow ... />
  </View>

  {/* GROWS — everything else */}
  <BottomSheetScrollView keyboardShouldPersistTaps="handled">
    {phase === 'searching' && <SkeletonCard />}
    {phase === 'asking'    && <QuestionBlock ... />}
    {phase === 'card'      && <><SuggestionCard ... /><MoreMatchesRow ... /></>}
    {phase === 'details'   && <DetailsForm ... />}
    {phase === 'tray'      && <TrayList ... />}
  </BottomSheetScrollView>

  <View style={s.footer}>
    {lastAdded && <AddedStrip ... />}
    <Button label={addLabel} disabled={!canAdd(state)} onPress={handleAdd} variant="accent" full />
    {phase === 'card' && <Button label="Add and keep going" variant="ghost" onPress={handleKeepGoing} />}
  </View>
</BottomSheetModal>
```

**Snap points** come from `addSheetHeight(state.phase, state.tray.length, windowHeight)` with
`useWindowDimensions()`, and `animationConfigs` from
`useBottomSheetSpringConfigs(Animation.springs.drag)`.

**Cost discipline — the sheet spends money.** Every `resolveQuery` is a billed call behind a
per-uid quota. Therefore:
- Debounce `SEARCH_DEBOUNCE_MS` (350) after the last keystroke, never per keystroke.
- Never search below `MIN_QUERY_LENGTH`; the reducer already refuses.
- Check `resolveCache` before calling — `src/lib/resolveCache.ts` is built and unused.
- **Never search on blur.** Tapping a result blurs the field; a blur-triggered search bills a
  second call and swaps the list under the finger. This exact defect was found and fixed in
  `StopForm.tsx` — do not reintroduce it.
- Route lookups fire **only** for the candidate the user opened, never per result.

**Errors** go through `describeCallableError(err, "Couldn't look up that — try again.")` so a
quota refusal reads as "You've reached today's lookup limit. It resets at midnight UTC."

**Day resolution:** when `payload.day` is absent, present the owned `DayPickerSheet` exactly as
`CustomItemSheet` did, and keep Add disabled until a day exists.

**Commit paths:**
1. Add → `commitCandidates(tripId, [selected], itinerary)` → dispatch `committed` with the
   returned inverse → `onSaved()`.
2. Add and keep going → `addToTray(tripId, selected)` → the `subscribe` listener dispatches
   `trayChanged`.
3. Add N items → `commitCandidates(tripId, tray, itinerary)` → `clearTray` → `trayCommitted`.
4. Editing a booking → `useBooking().updateBooking`; editing an item →
   `updateItineraryItem`; Remove → `confirmDelete` then the matching remove.

- [ ] **Step 1: Write the failing test**

Mock `@/src/lib/resolveClient` and `@/src/lib/addFlowWrites`, following the mocking style in
`__tests__/components/BookingFormSheet.test.tsx`. Assert:

```typescript
describe('AddSheet — lookups cost money', () => {
  it('does not search until the debounce elapses', () => {});
  it('searches once for a burst of keystrokes, not once each', () => {});
  it('never searches below the minimum query length', () => {});
  it('does not search again when the field blurs', () => {});
  it('reads the cache instead of calling twice for the same query', () => {});
});

describe('AddSheet — the pinned query', () => {
  it('keeps the field mounted in every phase', () => {
    // idle, searching, asking, card, details, tray
  });
  it('does not move the field when the sheet grows', () => {
    // the header is not a child of the scroll view
  });
});

describe('AddSheet — committing', () => {
  it('writes one candidate and offers one undo', () => {});
  it('writes a two-item tray in one update and undoes it in one', () => {});
  it('re-arms the field after an add without dismissing the sheet', () => {});
});

describe('AddSheet — errors', () => {
  it('shows the quota sentence rather than a gRPC status', () => {
    // resource-exhausted → "You've reached today's lookup limit."
  });
});

describe('AddSheet — editing', () => {
  it('opens straight at the form for a booking', () => {});
  it('opens straight at the form for an itinerary item', () => {});
  it('confirms before removing', () => {});
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/components/AddSheet.test.tsx
```

- [ ] **Step 3: Build the sheet**

Follow `CustomItemSheet`'s chrome exactly — `BottomSheetBackdrop` with `appearsOnIndex={0}`,
`disappearsOnIndex={-1}`, `pressBehavior="close"`, `opacity={0.45}`; the `useSheetContext`
`increment`/`decrement` open-count via `onChange`; a `presentation` counter bumped on every
`present()` and used as the form's `key` so a prior edit's values never bleed into the next add.

Export from `src/features/jernie/add/index.ts`.

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Full suite and commit**

```bash
cd ~/jernie-fresh && npm test && npx tsc --noEmit
git add src/features/jernie/add/ __tests__/components/AddSheet.test.tsx
git commit -m "feat(add-flow): the sheet that grows

The header is outside the scroll view and everything else is inside it,
which is the whole of 'the query never moves' — the thing you typed and the
thing you got are never on separate screens.

The lookup rules are cost rules, not polish: one debounced call per burst,
the cache read first, and no search on blur. That last one is not
hypothetical — tapping a result blurs the field, and StopForm billed a
second call and swapped the list under the finger until it was fixed."
```

---

### Task 8: `HeroAddButton`

Tier: standard | Reasoning: medium - one small control, but it has to survive an animation driven by a shared scroll value it does not own, and it overrules a standing roadmap decision.

**Files:**
- Create: `src/features/jernie/home/HeroAddButton.tsx`
- Modify: `.claude/skills/jernie-design/reference/custom-components.md`, `docs/redesign-roadmap.md`
- Test: `__tests__/components/HeroAddButton.test.tsx`

**Interfaces:**
- Consumes: `PlusIcon` from `phosphor-react-native/src/icons/Plus`; `useTheme`, `createThemedStyles`; `Scrim`, `Radius`, `Gutter` from tokens.
- Produces: `function HeroAddButton(props: { onPress: () => void; insetTop: number }): JSX.Element`

**Placement.** Top-right of the hero, in **its own absolutely-positioned layer**, a sibling of
`HomeHeader` rather than a child of it. It must **not** live inside `kickerRow`: that row is
driven by `kickerFade` and would take the button with it, so the control would vanish exactly
when the user is deepest in the trip. It holds position across the whole 0→165 collapse range
and comes to rest beside the trip name in the collapsed bar.

**No blur.** `expo-blur` is not installed and adding it means a native module and a fresh dev
build. Use a tokenized solid fill over the hero's existing scrim.

**Accessibility:** 44px target, `accessibilityRole="button"`,
`accessibilityLabel="Add to this trip"`, and `PRESSED_OPACITY` plus a light haptic on press.

- [ ] **Step 1: Write the failing test**

```typescript
describe('HeroAddButton', () => {
  it('is at least a 44px target', () => {});
  it('names itself for a screen reader', () => {
    // accessibilityLabel: "Add to this trip"
  });
  it('sits below the safe-area inset it is given', () => {});
  it('calls onPress', () => {});
});
```

- [ ] **Step 2: Run and watch it fail**

- [ ] **Step 3: Build it, then mount it**

Build the component, then render it in `app/(trips)/[tripId]/(tabs)/jernie.tsx` as a sibling of
the header — inside a `pointerEvents="box-none"` wrapper so it never swallows hero gestures —
wired to `addSheetRef.current?.present({ stopId: visibleStop.id, day: today })`.

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Record both decisions and commit**

Add to `custom-components.md`:

```markdown
| `HeroAddButton` | `Button` | Icon-only, which `Button` has no mode for. It also cannot live in the hero's kicker row — that row rides `kickerFade` and the control would disappear on scroll, which is when it is most wanted — so it is its own pinned layer over the collapse rather than a participant in it. No `expo-blur`: the dep is named by the system but not installed, and a native module for one chip's backdrop is not worth a rebuild. |
```

Amend the roadmap line so the exception is scoped rather than silently contradicted:

> **The header's Add is a labelled `Button`, not the canvas's bare round `+`.** `Button` has
> no icon-only mode, and a naked glyph is more ambiguous than the word. *(Scoped to Agenda.
> The trip hero overrules this — see `HeroAddButton` in `custom-components.md`.)*

```bash
cd ~/jernie-fresh && npm test && npx tsc --noEmit
git add src/features/jernie/home/HeroAddButton.tsx __tests__/components/HeroAddButton.test.tsx .claude/skills/jernie-design/reference/custom-components.md docs/redesign-roadmap.md "app/(trips)/[tripId]/(tabs)/jernie.tsx"
git commit -m "feat(add-flow): a + on the hero, pinned above the collapse

It is a sibling of the header, not a child: the kicker row fades on scroll
and would take the button with it, leaving no way to add anything from the
one screen you spend the most time on.

This overrules the roadmap's labelled-Button rule for the hero only. That
line now says so rather than being quietly contradicted by a diff."
```

---

### Task 9: Migrate every entry point, then delete the old sheets

Tier: deep | Reasoning: high - seven call sites across two large screens, and the deletion removes 833 lines of tests. The risk is not a compile error, it is a path that quietly stops reaching a booking type.

Nothing is deleted until every caller has moved. Do the migration first, run the suite, and only
then remove the files.

**Files:**
- Modify: `app/(trips)/[tripId]/(tabs)/jernie.tsx`, `app/(trips)/[tripId]/(tabs)/agenda.tsx`
- Delete: `src/features/jernie/BookingForm.tsx`, `src/features/jernie/sheets/BookingFormSheet.tsx`, `src/features/jernie/sheets/CustomItemSheet.tsx`, `__tests__/components/BookingForm.test.tsx`, `__tests__/components/BookingFormSheet.test.tsx`, `__tests__/components/CustomItemSheet.test.tsx`
- Test: `__tests__/domain/gapsAfterAddFlow.test.ts`

**Interfaces:**
- Consumes: `AddSheet`, `AddSheetRef`, `AddSheetPayload` from `src/features/jernie/add`.
- Produces: `const CANDIDATE_TYPE_FOR_BOOKING: Record<BookingType, CandidateType>` exported from `src/features/jernie/add/index.ts`.

**The mapping, used by every migrated call site:**

```typescript
export const CANDIDATE_TYPE_FOR_BOOKING: Record<BookingType, CandidateType> = {
  hotel: 'stay', restaurant: 'eat', flight: 'flight', rental: 'drive',
};
```

**The seven call sites:**

| File:line (before) | Was | Becomes |
| --- | --- | --- |
| `jernie.tsx:1077` | `bookingSheetRef.present({ type: SETUP_BOOKING_TYPE[k], stopId })` | `addSheetRef.present({ stopId, typeHint: CANDIDATE_TYPE_FOR_BOOKING[SETUP_BOOKING_TYPE[k]] })` |
| `jernie.tsx:1158` | `customItemSheetRef.present({ stopId, day, editingItem })` | `addSheetRef.present({ stopId, day, editing: { kind: 'item', item: editingItem, day } })` |
| `jernie.tsx:1170` | `bookingSheetRef.present({ ..., editingBooking })` | `addSheetRef.present({ stopId, editing: { kind: 'booking', booking } })` |
| `jernie.tsx:1463` | `customItemSheetRef.present(day ? { stopId, day } : { stopId })` | `addSheetRef.present(day ? { stopId, day } : { stopId })` |
| `jernie.tsx:1553` | `customItemSheetRef.present({ stopId: visibleStop.id })` | `addSheetRef.present({ stopId: visibleStop.id })` |
| `agenda.tsx:125` | `bookingSheetRef.present({ ..., editingBooking })` | `addSheetRef.present({ stopId, editing: { kind: 'booking', booking } })` |
| `agenda.tsx:153` | `customItemSheetRef.present({ stopId, day, editingItem })` | `addSheetRef.present({ stopId, day, editing: { kind: 'item', item: editingItem, day } })` |
| `agenda.tsx:157` (`fixGap`) | `{ type: gap.kind === 'stay' ? 'hotel' : 'rental', stopId }` | `{ stopId: gap.stopId, typeHint: gap.kind === 'stay' ? 'stay' : 'drive' }` |
| `agenda.tsx:168` (`addTo`) | booking → `bookingSheetRef`, else `customItemSheetRef` | one `addSheetRef.present({ stopId, typeHint })` |

Both screens then replace their two `<BookingFormSheet>` / `<CustomItemSheet>` mounts with a
single `<AddSheet tripId={trip.id} stops={stops} itinerary={itinerary} onSaved={refetch} />`.

- [ ] **Step 1: Write the failing regression test**

Rental now reaches its form one level inside Drive. `src/domain/gaps.ts:130` reads
`b.type === 'rental'` for `pickupDate`/`dropoffDate`, and `GAP_ROLES` is `['sleep','move']`, so
a rental is one of only two ways a transport gap ever closes. Pin it:

Create `__tests__/domain/gapsAfterAddFlow.test.ts`:

```typescript
import { detailsKindFor, bookingTypeFor } from '@/src/features/jernie/add/detailsFields';

describe('the Drive chip still closes a transport gap', () => {
  it('routes a renting Drive to a rental booking, which is what gaps.ts counts', () => {
    const kind = detailsKindFor('drive', true);
    expect(kind).toBe('rental');
    expect(bookingTypeFor(kind)).toBe('rental');
  });

  it('leaves a non-renting Drive as a custom item, which does not close the gap', () => {
    expect(bookingTypeFor(detailsKindFor('drive', false))).toBeNull();
  });
});
```

Then extend it with a real `buildGaps` assertion: construct a stop with dates, a `rental`
booking spanning them created through the Drive path's shape, and assert no `move` gap is
reported. Read `src/domain/gaps.ts` and the existing `__tests__/domain/gaps.test.ts` for the
fixture shape rather than inventing one.

- [ ] **Step 2: Run and watch it fail**

```bash
cd ~/jernie-fresh && npx jest __tests__/domain/gapsAfterAddFlow.test.ts
```

- [ ] **Step 3: Migrate both screens**

Work through the table above. In each file: add the `AddSheet` import and a single
`addSheetRef`, rewrite the call sites, replace the two mounts with one, then remove the now-unused
`BookingFormSheet` / `CustomItemSheet` imports and refs.

- [ ] **Step 4: Run the full suite with the old files still present**

```bash
cd ~/jernie-fresh && npm test
```

Expected: PASS. The three old suites still pass here — they test components nothing renders any
more, which is exactly the state that makes the deletion safe.

- [ ] **Step 5: Delete the old sheets and the form**

```bash
cd ~/jernie-fresh && git rm \
  src/features/jernie/BookingForm.tsx \
  src/features/jernie/sheets/BookingFormSheet.tsx \
  src/features/jernie/sheets/CustomItemSheet.tsx \
  __tests__/components/BookingForm.test.tsx \
  __tests__/components/BookingFormSheet.test.tsx \
  __tests__/components/CustomItemSheet.test.tsx
```

- [ ] **Step 6: Prove nothing still references them**

```bash
cd ~/jernie-fresh && grep -rn "BookingForm\|CustomItemSheet" --include=*.ts --include=*.tsx src/ app/ __tests__/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 7: Run the full suite and compare the count**

```bash
cd ~/jernie-fresh && npm test 2>&1 | tail -5 && npx tsc --noEmit
```

**Read the suite and test counts, not just the absence of failures.** The baseline before this
plan is **105 suites / 1,286 tests, exit 0** — measured at `4d5b251`, not taken from the
handoff, whose 104 / 1,260 was true at `04f00a7` and has been overtaken since. This task removes 40 tests and the plan adds more than that
back; a *drop* below the arithmetic means a suite stopped compiling, and `tsc --noEmit` cannot
tell you because `tsconfig.json` excludes `__tests__`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(add-flow): one sheet for every add and edit

Seven call sites across the two big screens now open the same sheet, and
BookingForm, BookingFormSheet and CustomItemSheet are gone with their 833
lines of tests.

The migration lands before the deletion on purpose: for one commit the old
suites still pass while nothing renders them, which is the state that makes
removing them safe rather than hopeful.

Rental now lives one level inside Drive, so it gets an explicit test that a
Drive-created rental still closes a transport gap — gaps.ts reads
b.type === 'rental' directly, and a rental is one of only two ways that gap
ever closes."
```

---

### Task 10: The release gate

Tier: standard | Reasoning: medium - prescribed commands and a documentation sweep, but it is the last point at which a device-only failure can still be caught cheaply.

**Files:**
- Modify: `docs/agents/HANDOFF.md`, `docs/redesign-roadmap.md`, `docs/superpowers/plans/2026-08-27-add-flow-ui.md`

- [ ] **Step 1: Run the full gate**

```bash
cd ~/jernie-fresh
npm test; echo "exit: $?"
npx tsc --noEmit; echo "exit: $?"
npx expo export --platform ios --output-dir /tmp/verify; echo "exit: $?"
git status --short
```

All three must exit 0. A suite printing all-pass is not green unless the process exits 0.

- [ ] **Step 2: Check the UI gates by hand**

```bash
cd ~/jernie-fresh
# no hard-coded colours in touched files
grep -rnE "#[0-9a-fA-F]{3,8}" src/features/jernie/add/ src/features/jernie/home/HeroAddButton.tsx || echo "no literals"
# no emoji
grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/features/jernie/add/ || echo "no emoji"
# no phosphor barrel imports
grep -rn "from 'phosphor-react-native'" src/features/jernie/add/ || echo "per-icon only"
```

- [ ] **Step 3: Verify on device**

Metro over Tailscale, not OTA — `eas update` cannot reach the current dev build. No new native
dependency was added by this plan, so no rebuild is needed.

```bash
cd ~/jernie-fresh && npx expo start --clear
```

Check, in both light and dark:
1. The hero `+` opens the sheet, and **stays visible through a full scroll to the collapsed header**.
2. Typing three characters searches once, not once per keystroke.
3. A multi-match query shows the card plus "N more matches"; tapping a row swaps the card and does not fire a second lookup.
4. A no-match query lands on the form with the typed words kept as the title.
5. Add commits, the field re-arms, the strip offers Undo, and Undo restores.
6. Add and keep going twice, then Add 2 items — **one** write and **one** undo.
7. Editing a booking from the detail sheet opens the form seeded; Remove asks first.
8. A transport gap row opens Drive, and choosing rental closes the gap.
9. Font scaling at the largest accessibility size does not clip the card's field table.

- [ ] **Step 4: Update the docs**

Rewrite `docs/agents/HANDOFF.md` (≤50 lines) with the verified state, the commands actually run
and their results, and whatever is genuinely still owed. Mark the add-flow UI milestone in
`docs/redesign-roadmap.md`. Tick every checkbox in this plan.

Carry forward the two console items that leave no trace in the repo when skipped, if they are
still open: the `route_cache` TTL policy, and `GOOGLE_PLACES_API_KEY`.

- [ ] **Step 5: Commit**

```bash
cd ~/jernie-fresh && git add -A
git commit -m "docs(add-flow): record the sheet UI as shipped and gated

Handoff carries the verified state and the exact commands run. Roadmap
marks the milestone. Device checks that a test renderer cannot make — the +
surviving the collapse, one write per batch, and the field table under the
largest font scale — are listed with what was actually observed."
```

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: §1 deletions → Task 9; §2 modules →
Tasks 1, 4–8; §3 state machine → Task 1; §4 card, more-matches and the `asking` phase → Tasks 4
and 5; §5 `DetailsForm` → Tasks 2 and 3; §6 commit/undo/tray → Tasks 6 and 7; §7 `HeroAddButton`
→ Task 8; §8 entry points → Task 9; §9 deferrals → not built, by design; §10 testing → every
task plus Task 10; §11 risks → the rental regression test in Task 9 and the device list in
Task 10.

**Type consistency.** `DetailsKind` is used identically in Tasks 2, 3 and 9. `AddSheetPayload`
is defined in Task 7 and consumed in Tasks 8 and 9 with matching shape. `addSheetHeight`,
`canAdd` and `typeRowOpacity` are defined in Task 1 and used in Tasks 5 and 7 with the same
signatures. `CANDIDATE_TYPE_FOR_BOOKING` is defined in Task 9 and used only there.

**Ordering.** Each task leaves the app working: the old sheets keep serving every entry point
until Task 9, and Task 9 migrates before it deletes.

**Known softness, called out rather than hidden.** Task 3's step 1 lists the ported test cases
by name with bodies to be filled from the original suite, rather than reproducing 378 lines of
test code here. This is deliberate — the source file is in the repo and must be read anyway, and
a transcription of it into this plan would be the more likely place for a case to go missing.
Task 9's gap fixture is likewise pointed at `__tests__/domain/gaps.test.ts` rather than invented.
