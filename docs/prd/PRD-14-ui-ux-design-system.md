# PRD-14 — UI/UX Design System & Responsive Experience

## 1. Objective

Define a consistent, modern, operational UI system for Studio37 that works efficiently on desktop and remains practical on mobile.

The product is an internal management tool, so clarity, density, speed, and predictable interaction are more important than decorative visual complexity.

## 2. UX Principles

- Fast access to today's operational information.
- Minimize unnecessary navigation for common booking tasks.
- Configuration-heavy forms remain understandable to non-technical studio staff.
- Critical financial/destructive actions are visually distinct and harder to trigger accidentally.
- Desktop can be information-dense; mobile must prioritize the most important actions/context.
- Avoid duplicated headings/heroes that consume workspace without adding context.

## 3. Application Shell

Recommended desktop shell:

- persistent sidebar
- compact top bar
- page/subpage context
- main scrollable workspace

Recommended mobile shell:

- compact top bar
- collapsible navigation/drawer or appropriate mobile navigation
- preserved page context
- touch-friendly actions

Primary navigation:

- Dashboard
- Booking Calendar
- Fee & Commission (Owner/authorized only)
- Bookkeeping
- Settings

## 4. Design Tokens

Define project-wide tokens for:

- typography scale
- spacing
- border radius
- border/elevation
- surface/background hierarchy
- status semantics
- transition timing
- layout widths
- responsive breakpoints

If light/dark themes are included, components must use semantic tokens rather than independent hardcoded colors.

## 5. Core UI Components

Required reusable component families:

- buttons
- icon buttons
- inputs/textareas
- selects/comboboxes
- date picker
- time picker
- duration/package selector
- checkbox/switch/radio
- cards
- table/data grid wrappers
- tabs
- dropdown menus
- dialogs/modals
- side sheets/drawers where useful
- toast/notification
- tooltip
- status badge
- skeleton/loading
- empty state
- error state
- confirmation/destructive dialog

## 6. Form Standards

All forms should provide:

- persistent field labels
- helpful descriptions for complex rules
- inline validation
- consistent required/optional indicators
- disabled/read-only distinction
- clear save/cancel state
- unsaved-changes protection where appropriate

Price/commission settings should display human-readable summaries of configured rules.

## 7. Tables

Desktop financial/operator lists may be dense but must retain readable alignment, sortable/filterable affordances where required, and clear row actions.

Mobile should not simply shrink wide desktop tables. Use responsive cards, horizontal containers only where comparison requires columns, or reduced-column views with details on drill-in.

## 8. Calendar-Specific UI

Calendar requirements:

- sticky time context
- clear date headers
- non-transparent sticky headers over scrolling content
- distinct booking blocks
- smooth horizontal scrolling on touch devices
- no forced column snap unless explicitly proven useful
- clear selected/current date
- compact payment/session indicators
- sufficient color-independent cues for status

## 9. Booking Form

Recommended modal/drawer/page behavior depends on viewport, but must support:

- grouped customer information
- session/studio/time selection
- real-time pricing summary
- payment section
- operator assignment
- notes
- final booking summary before confirmation

Dropdowns and inputs within the same row/group must align consistently.

## 10. Status Semantics

Use consistent badges/icons/text for:

### Payment
- Pending
- DP
- Lunas

### Booking
- Confirmed
- In Progress
- Completed
- Cancelled

### Commission
- Pending
- Earned
- Paid
- Void

Status may use color, but text/iconography must keep it understandable without relying only on color.

## 11. Accessibility

Minimum expectations:

- keyboard-accessible controls
- visible focus states
- semantic form labels
- dialog focus management
- sufficient contrast
- touch targets appropriate for mobile
- errors announced/associated with fields where practical
- no color-only state communication

## 12. Responsive Strategy

### Desktop

Optimize for rapid studio operation, dense calendar, financial tables, and settings management.

### Tablet

Preserve operational information while reducing secondary columns/actions.

### Mobile

Prioritize:

- today/next booking
- schedule navigation
- quick new booking
- customer/payment essentials
- readable settings forms

Complex analytics and tables may progressively disclose detail.

## 13. Feedback States

Every data-driven page should explicitly support:

- initial loading
- background saving/updating
- success
- empty
- validation error
- permission denied
- network/Firebase failure
- missing/incomplete configuration

## 14. Acceptance Criteria

- Pages share a coherent visual/component system.
- Calendar is usable with mouse and touch.
- Mobile does not require desktop-width layouts for core booking workflows.
- Complex pricing settings remain understandable through labels and rule summaries.
- Destructive actions are visually and behaviorally guarded.
- Core components meet baseline keyboard/focus/contrast requirements.
