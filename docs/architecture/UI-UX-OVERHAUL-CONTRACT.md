# Studio37 Phase 5D UI/UX Overhaul Contract

## Purpose

Phase 5D is a visual-system and interaction-quality overhaul before Phase 6. It must not change pricing, authorization, Firestore, booking, commission, payment, or repository business behavior.

The target direction is **Studio37 Signal Atelier**: a premium music-studio operations console with layered graphite surfaces, warm ivory typography, chartreuse primary actions, cyan informational accents, deliberate depth, compact operational density, and custom interaction language. The application must not feel like a browser-native form collection or a generic admin template.

## Source visual tokens

- background: `#0E1013`
- surface: `#15181D`
- muted surface: `#1C2026`
- foreground: `#F4F1E8`
- muted foreground: `#A9ADB4`
- primary: `#C9F26B`
- primary foreground: `#11150B`
- secondary: `#2A3038`
- secondary foreground: `#F4F1E8`
- information accent: `#63D8FF`
- border: `#323842`

The implementation may add semantic aliases for success, warning, danger, focus, elevation, and interactive state while preserving this visual direction.

## Required overhaul inventory

### Global foundation

- canvas/background atmosphere
- semantic color tokens
- typography hierarchy
- spacing and density scale
- radii/elevation scale
- focus-visible language
- text selection
- scrollbars
- disabled/read-only states
- skeleton/loading language
- reduced-motion behavior
- narrow viewport safe areas
- native-control de-emphasis for checkbox/radio/number/time controls

### Application shell

- Studio37 brand mark and identity
- desktop sidebar
- primary navigation and active state
- mobile navigation drawer and backdrop
- sticky topbar
- page context label
- user menu trigger and menu surface
- skip link
- content canvas/max width

### Shared interaction primitives

- Button: primary, secondary, ghost, danger, all sizes, loading, disabled, pressed/hover/focus
- Input and Textarea: label, description, required, error, disabled, placeholder, autofill
- Select: custom non-native selection surface, keyboard navigation, active option, selected option, disabled option, outside dismissal
- Combobox: search, keyboard navigation, active option, empty state, disabled state
- Badge and status treatments
- Foundation panel / placeholder states
- Dialog: backdrop, desktop modal, narrow-mobile sheet behavior, sticky header/footer, focus trap, escape, outside click, internal scrolling, safe-area spacing
- Toast: tone, action, dismiss, stacking, motion, responsive layout
- Page context / page heading hierarchy

### Authentication surfaces

- Login page and form
- authentication loading/error state
- access-denied surface
- operator invitation onboarding flow
- user identity/avatar/menu
- sign-out loading/error state

### Settings surfaces

- settings workspace and horizontal navigation
- all settings cards and section headers
- loading, empty, warning, danger, read-only, saturation, and retry states
- studio profile form
- studio room list/rows/actions
- operator list/rows/actions/type selectors
- permission template list/editor/assignment surfaces
- session type list/editor
- pricing rule list/editor/configuration-health feedback
- duration package workspace/editor
- duration minute configuration controls
- studio scope selector
- add-on list/editor
- human-readable pricing preview
- all inline notices and metadata chips

### Existing dialogs/modal flows

Every current dialog must inherit the overhauled modal system and remain behaviorally intact:

1. Session Type editor
2. Pricing Rule editor
3. Duration Package editor
4. Add-on editor
5. Operator Account Invitation
6. Operator Account Link
7. Operator Permission Assignment
8. Permission Set editor
9. room/operator confirmation flows that use the shared Dialog primitive

No modal may retain a browser-default visual treatment.

## UX requirements

### Interaction clarity

- Primary action must visually dominate only within its local decision context.
- Destructive actions must be visibly distinct and never visually adjacent to a similarly styled safe action without spacing/hierarchy.
- Read-only users must understand why an action is unavailable rather than seeing unexplained disabled controls.
- Loading actions must preserve button width and communicate busy state without causing layout shift.
- Error feedback must be colocated with the affected field/action and remain readable at narrow widths.

### Dialog behavior

- Desktop dialogs must cap height and keep header/footer reachable while the body scrolls.
- Narrow mobile dialogs must behave like intentional sheets/full-height work surfaces, not squeezed desktop cards.
- Backdrop click and Escape continue to close where existing behavior allows.
- Focus is trapped while open and restored to the trigger on close.
- The close action must have a real icon treatment and an accessible label.

### Selection controls

- Standard Select must no longer rely on the operating-system dropdown menu for its visible option picker.
- Arrow keys, Home/End, Enter/Space, Escape, focus, active option, selected option, and outside dismissal must be supported.
- Combobox retains search behavior but shares visual language with Select.

### Responsive behavior

- Desktop supports dense two/three-column operational layouts.
- Tablet progressively collapses secondary panels before primary context.
- Narrow mobile uses one-column reading order, full-width primary actions where appropriate, no clipped metadata, and no accidental page-level horizontal overflow.
- Horizontal scrolling is allowed only for intentionally scrollable navigation or future calendar surfaces.
- Minimum interactive target size should remain touch-friendly even in compact density.

### Motion

- Motion is functional and subtle: opening/closing surfaces, hover/press feedback, loading, and state transitions.
- No decorative pointer glow or continuously distracting animation.
- `prefers-reduced-motion: reduce` disables non-essential transitions and animations.

## Technical boundary

- Prefer strengthening existing primitives over adding overlapping component libraries.
- New dependencies are allowed only when they solve a real capability gap that cannot be cleanly provided by the existing stack.
- Do not add a second design system or UI framework beside the existing component layer.
- Preserve all repository/business boundaries and existing permissions.
- Preserve all automated behavioral tests unless a test explicitly encodes obsolete visual DOM details.
- No Firebase Hosting or production deployment in this phase.

## Acceptance

Phase 5D is implementation-complete only when:

- shared primitives are overhauled;
- shell/auth/settings/modal/feedback surfaces inherit the new system;
- no browser-native-looking selection/check/radio treatment remains in core workflows;
- existing business tests remain green;
- formatting, lint, unit/component tests, both Firestore Emulator suites, production build, and Vite smoke pass;
- final browser acceptance remains a separate manual gate and must not be claimed from source inspection alone.
