# Proposals Page — Swipe Redesign Spec

**Date:** 2026-05-16  
**Status:** Ready for implementation  
**File:** `desktop-electron/src/renderer/pages/IntelligenceProposals.tsx`

---

## Overview

Replace the current two-panel proposals page (sidebar list + detail panel) with a Tinder-style three-column swipe interface. Agents surface feature ideas as proposal approvals; this page lets a human reviewer rapidly approve or reject them using keyboard shortcuts or on-screen buttons, with a persistent history panel for re-reviewing past decisions.

No new API endpoints or DB migrations are needed. All actions go through the existing `approvalsApi` (`approve`, `reject`). The `resubmit` endpoint is agent-only and is not used here.

---

## Design Tokens (from DESIGN.md)

All color references below map to CSS custom properties so dark/light theme switching is automatic.

| Token | DESIGN.md hex | CSS var (CrewSpace) | Usage |
|---|---|---|---|
| Coral / Primary | `#cc785c` | `hsl(var(--primary))` | Confirm buttons, "Got it", active queue border, help `?` button ring |
| Success | `#5db872` | `hsl(var(--success))` | Approve circle, approve note panel border, approved history strip |
| Error | `#c64545` | `hsl(var(--destructive))` | Reject circle, reject note panel border, rejected history strip |
| Amber | `#e8a55a` | `hsl(var(--warning))` | Skip circle |
| Canvas / Background | `#faf9f5` → dark `#0f172a` | `hsl(var(--background))` | Page floor |
| Surface card | `#efe9de` → dark `#1e293b` | `hsl(var(--card))` | Swipe card, note panel, history item hover |
| Surface dark elevated | `#252320` → dark `#0a1120` | `hsl(var(--muted))` | Queue column bg, history column bg |
| Muted text | `#6c6a64` | `hsl(var(--muted-foreground))` | Card meta, history item date, kbd hints |
| Hairline | `#e6dfd8` → dark `#334155` | `hsl(var(--border))` | Column dividers, card borders, modal dividers |
| Ink / Foreground | `#141413` → dark `#f1f5f9` | `hsl(var(--foreground))` | Card title, queue item title (active) |

**Border radius** (from DESIGN.md scale):
- Swipe card: `rounded-xl` (16px) — `{rounded.xl}`
- Note panel, history items, queue items: `rounded-lg` (12px) — `{rounded.lg}`
- Scope badges, keyboard `<kbd>` chips: `rounded-full` — `{rounded.pill}`
- Buttons (approve/reject circles): `rounded-full`
- Confirm button: `rounded-md` (8px) — `{rounded.md}`

**Typography** (from DESIGN.md):
- Card title: `title-md` — 18px / 500 (StyreneB / Inter)
- Card summary, section body: `body-sm` — 14px / 400
- Column header labels: `caption-uppercase` — 12px / 500 / 1.5px tracking
- History item title, queue item title: `body-sm` — 14px / 400
- Scope badge: `caption` — 13px / 500
- Keyboard hints: `caption` — 13px / 500

---

## Layout — Three Columns

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: Intelligence Proposals     [← Reject] [→ Approve] [↑ Skip] [?] │
├──────────────┬──────────────────────────────┬────────────────────────┤
│  QUEUE       │         SWIPE CARD           │  HISTORY               │
│  w-56        │         flex-1               │  w-60                  │
│              │                              │                        │
│ Pending (5)  │   [ghost card 2]             │  Approved (3)          │
│              │  [ghost card 1]              │  ● Dark mode support   │
│ ● Collab…    │ ┌────────────────────┐       │  ● CSV bulk import     │
│   cursors    │ │ Frontend           1/5 │   │  ● Agent mem search    │
│ ● GraphQL…   │ │                        │   │                        │
│ ● Onboard…   │ │ Real-time collab   │   │   │  Rejected (2)          │
│ ● Rate lim…  │ │ cursors            │   │   │  ✕ Blockchain audit    │
│ ● Audit log  │ │                    │   │   │  ✕ Mobile native app   │
│              │ │ [summary]          │ ← Note panel (after action)    │
│              │ │ [options]          │       │                        │
│              │ │ [rationale]        │       │                        │
│              │ │ [impact chips]     │       │                        │
│              │ └────────────────────┘       │                        │
│              │                              │                        │
│              │   [✕ Reject] [→ Skip] [✓ Approve]                    │
│              │   ← Reject  · ↑ Skip · → Approve                     │
└──────────────┴──────────────────────────────┴────────────────────────┘
```

### Column sizing
- **Queue column**: `w-56` (224px), `shrink-0`, `border-r border-border`
- **Card column**: `flex-1`, centers content with `items-center justify-center`, `gap-4`
- **History column**: `w-60` (240px), `shrink-0`, `border-l border-border`
- All columns: `bg-muted/30` for outer columns, `bg-background` for center; full height `min-h-0 overflow-hidden`

---

## Component: Toolbar

Single `flex items-center justify-between` bar, `border-b border-border`, `px-4 py-2.5`.

- **Left**: page title `"Intelligence Proposals"` — `text-sm font-semibold`
- **Right**: keyboard hint row (`hidden sm:flex gap-3 text-xs text-muted-foreground`) + `?` help button
  - Help button: `rounded-full w-7 h-7 border border-border text-muted-foreground hover:text-foreground`
  - `?` opens the onboarding modal (sets `showOnboarding` state to `true`)

---

## Component: Queue Column

### Header
`"Pending"` label in `caption-uppercase` style + count badge.  
Count badge: `bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold`.

### List items
Each `<button>` row:
- `flex flex-col gap-1 px-3 py-2 rounded-lg text-left w-full transition-colors`
- Hover: `hover:bg-accent/50`
- Active (currently displayed card): `bg-accent border border-primary/20`
- Title: `text-sm text-foreground` (active) / `text-sm text-muted-foreground` (inactive)
- Scope badge below title

Clicking a queue item sets `activeIndex` to that proposal's index, jumping directly to it.

### Scope badges
Implemented as a `ScopeBadge` sub-component. Color mapping:

| Scope | Background | Text |
|---|---|---|
| `frontend` | `bg-blue-950/60` | `text-blue-400` |
| `backend` | `bg-green-950/60` | `text-green-400` |
| `ux` | `bg-purple-950/60` | `text-purple-400` |
| `infra` | `bg-yellow-950/60` | `text-yellow-400` |
| `security` | `bg-red-950/60` | `text-red-400` |
| `data` | `bg-sky-950/60` | `text-sky-400` |
| `devops` | `bg-orange-950/60` | `text-orange-400` |
| `mobile` | `bg-pink-950/60` | `text-pink-400` |

Light mode: swap `*-950/60` → `*-100`, `*-400` → `*-700`.

---

## Component: Swipe Card

### Card stack effect
Three-layer `relative` container:
- **Ghost card 2** (deepest): `absolute top-3 left-6 right-6 h-full bg-card/40 rounded-xl border border-border/30 -z-10`
- **Ghost card 1**: `absolute top-1.5 left-3 right-3 h-full bg-card/60 rounded-xl border border-border/50 -z-10`  
  Both ghosts are decorative only — no content.
- **Active card**: `relative z-0 bg-card rounded-xl border border-border p-6 flex flex-col gap-4`

### Card animation
Use `framer-motion` `<motion.div>` on the active card (already in project via Radix deps, or add lightweight alternative with CSS transitions):

- **Initial**: `x: 0, opacity: 1, rotate: 0`
- **Approve exit**: `x: 600, opacity: 0, rotate: 12` → triggers after note confirm
- **Reject exit**: `x: -600, opacity: 0, rotate: -12` → triggers after note confirm
- **Skip exit**: `y: -400, opacity: 0` → instant, no note panel
- **Enter next card**: `x: 0, opacity: 1` from `x: 80, opacity: 0`

If framer-motion is not already a dependency, implement with CSS `transition` + `transform` classes toggled via state, avoiding the extra bundle. Check `package.json` during implementation.

### Card content (from proposal `payload` fields)

```
┌───────────────────────────────────────────┐
│ [ScopeBadge]                    1 of 5    │
│                                           │
│ {payload.title}  ← title-md, font-600     │
│                                           │
│ {payload.summary}  ← body-sm, text-muted  │
│ ─────────────────────────────────────── │
│ OPTIONS CONSIDERED                        │
│ {payload.options}  ← body-sm             │
│                                           │
│ RATIONALE                                 │
│ {payload.rationale}  ← body-sm           │
│                                           │
│ IMPACT                                    │
│ [impact chip] [effort chip] [complexity]  │
│ ─────────────────────────────────────── │
│ [AgentAvatar] Proposed by {agentName}     │
│               {timeAgo(createdAt)}        │
└───────────────────────────────────────────┘
```

All `payload.*` fields are optional — render each section only if the value exists.

Impact chips: `bg-background border border-border rounded-md px-2 py-1 text-xs text-muted-foreground`. High-impact chip gets `border-primary/40 text-primary bg-primary/5`.

### Action buttons

Three circular buttons in a `flex justify-center gap-6` row below the card:

| Button | Icon | Color | Size |
|---|---|---|---|
| Reject | `✕` | `border-destructive text-destructive bg-destructive/10` | `w-14 h-14` |
| Skip | `↑` | `border-border text-muted-foreground` | `w-10 h-10` |
| Approve | `✓` | `border-success text-success bg-success/10` | `w-14 h-14` |

Hover: `hover:scale-110 transition-transform`.

Keyboard hint row beneath: `← Reject · ↑ Skip · → Approve` in `text-xs text-muted-foreground`.

---

## Component: Note Panel

Appears **after** the user clicks approve or reject (or presses arrow key). Positioned below the card, or as an overlay panel on the right edge of the card column on wider screens.

```
┌────────────────────────────┐
│ ✓ Approving                │  ← success color (or destructive for reject)
│ Add a note (optional).     │
│ A linked issue will be     │
│ created on confirm.        │
│                            │
│ ┌──────────────────────┐   │
│ │ textarea placeholder  │   │
│ └──────────────────────┘   │
│                            │
│ [Confirm + Create Issue]   │  ← coral primary button (approve)
│ [Confirm + Log Rejection]  │  ← destructive button (reject)
│                            │
│ [Cancel]                   │  ← ghost, resets state
└────────────────────────────┘
```

- Panel: `bg-card border rounded-xl p-4 flex flex-col gap-3`
- Approve mode border: `border-success/40`; Reject mode: `border-destructive/40`
- Confirm button (`approve`): `bg-primary text-primary-foreground` (coral `#cc785c` from DESIGN.md)
- Confirm button (`reject`): `bg-destructive text-destructive-foreground`
- On confirm: call `approvalsApi.approve(id, note)` or `approvalsApi.reject(id, note)`, then trigger card exit animation, advance `activeIndex`

**State machine for center column:**

```
IDLE
  → user presses → or clicks Approve → PENDING_APPROVE (note panel shows, card stays)
  → user presses ← or clicks Reject  → PENDING_REJECT  (note panel shows, card stays)
  → user presses ↑ or clicks Skip    → skip immediately, advance index, stay IDLE

PENDING_APPROVE
  → Confirm clicked → API call → card exit animation → IDLE (next card)
  → Cancel clicked  → IDLE

PENDING_REJECT
  → Confirm clicked → API call → card exit animation → IDLE (next card)
  → Cancel clicked  → IDLE
```

---

## Component: History Panel

### Structure
```
History
  ├── Approved (N)
  │   ├── [item] Dark mode support
  │   ├── [item] CSV bulk import
  │   └── [item] Agent memory search
  └── Rejected (N)
      ├── [item] Blockchain audit trail
      └── [item] Mobile native app
```

### History item
```tsx
<button className="w-full text-left flex flex-col gap-1 px-3 py-2 rounded-lg
                   hover:bg-accent/50 transition-colors border-l-2
                   border-l-success (approved) | border-l-destructive (rejected)">
  <span className="text-[10px] font-semibold uppercase tracking-wide
                   text-success | text-destructive">
    ✓ Approved | ✕ Rejected
  </span>
  <span className="text-sm text-foreground line-clamp-1">{title}</span>
  {decisionNote && (
    <span className="text-[10px] text-muted-foreground italic truncate">
      "{decisionNote}"
    </span>
  )}
  <div className="flex items-center gap-2 mt-0.5">
    <ScopeBadge scope={scope} />
    <span className="text-[10px] text-muted-foreground">{timeAgo(decidedAt)}</span>
  </div>
</button>
```

### Re-review flow (clicking a history item)
Clicking a history item sets `reReviewItem = approval`. The center column detects `reReviewItem !== null` and renders the **Re-review Card** instead of the normal swipe card.

**Re-review Card** (`reReviewItem` mode):
- Same card layout as the swipe card, but with a `↩ Re-reviewing` amber banner at top
- Previous decision shown: `"Previously {approved|rejected}"` with decision note if present
- **Two action buttons** (no skip):
  - `Re-approve + Create Issue` → opens note panel in approve mode → on confirm: `approvalsApi.approve(id, note)` (server updates status directly; `resubmit` is only for agent-initiated resubmissions and should not be called here)
  - `Re-reject + Create Removal Ticket` → opens note panel in reject mode → on confirm: `approvalsApi.reject(id, note)`. The button label and note panel copy guide the user to describe what should be removed; no separate ticket endpoint is required — the rejection note serves as the removal record.
- `← Back to queue` link at top-right exits re-review mode, restores normal swipe card

Note panel in re-review mode for approve: button text `"Confirm + Create Issue"`.  
Note panel in re-review mode for reject: button text `"Confirm + Create Removal Ticket"`.

---

## Component: Onboarding Modal

Shown on first visit (localStorage key `crewspace:proposals-onboarding-seen`). Also opened by `?` button in toolbar.

```
┌─────────────────────────────────────────────┐
│ 🧠 How to review proposals                  │
│ Your agents surface feature ideas here.     │
│ Swipe or use keyboard shortcuts to triage.  │
│ ──────────────────────────────────────────  │
│ ┌──────────────┐  ┌──────────────┐          │
│ │ →  Approve   │  │ ←  Reject    │          │
│ │ Creates a    │  │ Dismisses,   │          │
│ │ linked issue │  │ logged in    │          │
│ │              │  │ history      │          │
│ └──────────────┘  └──────────────┘          │
│ ┌──────────────┐  ┌──────────────┐          │
│ │ ↑  Skip      │  │ ?  Help      │          │
│ │ Revisit from │  │ Reopens this │          │
│ │ queue later  │  │ guide        │          │
│ └──────────────┘  └──────────────┘          │
│ ──────────────────────────────────────────  │
│ ☐ Don't show again        [Got it →]        │
└─────────────────────────────────────────────┘
```

- Modal: `max-w-md w-full bg-card rounded-2xl border border-border p-7 flex flex-col gap-5`
- Shortcut grid: `grid grid-cols-2 gap-3`
- Each shortcut card: `bg-background rounded-xl p-4 flex flex-col gap-2 border border-border`
- `kbd` elements: `bg-muted border border-border rounded-md px-2 py-1 text-base font-mono`
- "Got it" button: `bg-primary text-primary-foreground` (coral per DESIGN.md) — `rounded-lg px-5 py-2 text-sm font-semibold`
- "Don't show again" checkbox: standard shadcn `<Checkbox>` — on check, sets localStorage key; modal closes on "Got it"

Overlay: `fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center`

---

## Empty States

### No pending proposals
Centered in card column:
```
🎉  All caught up!
    No pending proposals right now.
    Your agents will surface new ideas here.
    [View History →]
```

### No history yet
History column footer:
```
No decisions yet.
Reviewed proposals appear here.
```

### Queue exhausted mid-session (skip loops)
If user skips all remaining proposals: show soft message `"You've seen all pending proposals. Come back later or review skipped items."` in card column.

---

## Keyboard Handling

`useEffect` on the page component with `keydown` listener:
- `ArrowRight` → trigger approve (same as clicking Approve button)
- `ArrowLeft` → trigger reject
- `ArrowUp` → trigger skip
- `?` → open onboarding modal
- `Escape` → cancel note panel (if open) or exit re-review mode

Guard: if `pendingAction !== null` (note panel open), arrow keys do nothing (prevent double-fire). If `reReviewItem !== null`, arrow keys are disabled (explicit button choice required).

---

## Data & State

```ts
// Fetched once, refetched every 15s (existing behaviour)
const { data: approvals } = useQuery({ ... approvalsApi.list(companyId) ... })

// Derived
const pending  = approvals.filter(a => a.type === 'proposal' && a.status === 'pending')
const approved = approvals.filter(a => a.type === 'proposal' && a.status === 'approved')
const rejected = approvals.filter(a => a.type === 'proposal' && a.status === 'rejected')

// Local UI state
const [activeIndex,     setActiveIndex]     = useState(0)
const [pendingAction,   setPendingAction]   = useState<'approve'|'reject'|null>(null)
const [decisionNote,    setDecisionNote]    = useState('')
const [reReviewItem,    setReReviewItem]    = useState<Approval | null>(null)
const [showOnboarding,  setShowOnboarding]  = useState(false)   // seeded from localStorage
const [exitDirection,   setExitDirection]   = useState<'left'|'right'|'up'|null>(null)
```

Active card: `pending[activeIndex]`. When `activeIndex >= pending.length`, show empty state.

After a successful approve/reject mutation, `queryClient.invalidateQueries` (existing pattern) refreshes both the pending list and history.

---

## Theme Support

All colors use CSS custom properties — dark/light themes toggle automatically via the existing `ThemeContext`. No hardcoded hex values in JSX. DESIGN.md tokens map to the CrewSpace CSS vars as specified in the Design Tokens table above.

Scope badge colors use Tailwind's `dark:` variant:
```tsx
className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
```

---

## Files Changed

| File | Change |
|---|---|
| `desktop-electron/src/renderer/pages/IntelligenceProposals.tsx` | Full rewrite (~500 lines replacing current 763) |

No new routes, no new API calls beyond what `approvalsApi` already exposes. No DB changes. No new dependencies (verify framer-motion availability; fall back to CSS transitions if absent).

---

## Out of Scope

- Swipe gesture support on touch screens (mouse/keyboard only for this iteration)
- Filters / search within history panel (future iteration)
- Bulk approve/reject (future iteration)
- Commenting on proposals from this page (existing approval detail page handles that)
