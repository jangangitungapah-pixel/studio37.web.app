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

The user-provided booking calendar screenshot is the approved baseline visual direction for the scheduling workspace.

### 8.1 Core Visual Structure

Calendar requirements:

- wide continuous time-grid surface rather than compressed calendar cards
- dates as vertical columns
- operating hours as horizontal rows
- dedicated top-left month/context cell
- sticky left time column
- sticky date header row
- non-transparent sticky surfaces over scrolling content
- distinct vertically spanning booking blocks
- smooth horizontal scrolling on mouse, touchpad, and touch devices
- no forced column snap unless explicitly proven useful later
- clear selected/current date where needed
- compact payment/session indicators
- sufficient color-independent cues for status

The calendar should feel light and operational rather than visually heavy. Large empty scheduling areas should remain calm so reservations are immediately recognizable.

### 8.2 Date Header

Each date column should use a compact two-level hierarchy similar to the approved reference:

- short weekday label
- numeric day

The header should remain readable at dense desktop widths and must not become transparent while sticky.

Month context may appear in the top-left sticky corner rather than repeating in every date cell.

### 8.3 Time Column

The time column should:

- remain visually narrower than date columns
- use compact clock labels
- provide clear alignment to the corresponding horizontal grid line
- remain sticky during horizontal calendar movement
- use an opaque surface when sticky

An optional small clock icon or similarly restrained cue may be used, but decoration must not compete with the actual time value.

### 8.4 Booking Card Anatomy

Booking blocks are compact operational cards whose vertical geometry communicates duration.

Recommended visible hierarchy:

1. customer name as the strongest label
2. compact payment badge such as `Pending`, `DP`, or `Lunas`
3. session type
4. booking start time and duration
5. compact monetary indicator where authorized

Recommended styling behavior:

- soft surface contrast against empty grid cells
- subtle border
- optional stronger accent edge for scanning
- rounded corners, but not oversized pill styling
- payment badge may use a pill treatment
- minimum internal padding sufficient for dense readability
- content truncates gracefully when column width is limited

Booking cards must not look like generic dashboard cards detached from the time grid; they should visually belong to their calendar lane.

### 8.5 Grid Geometry

The visible major grid may use hourly rows while booking blocks position continuously within those rows.

This means a booking beginning at 10:30 should visually start halfway through the 10:00–11:00 row rather than being rounded to the nearest full hour.

Grid lines should be:

- subtle
- consistent
- low contrast relative to bookings
- strong enough to trace date/time intersections quickly

### 8.6 Calendar Scrolling

The calendar itself owns horizontal schedule scrolling.

Implementation must avoid:

- scroll snapping per date column
- nested gesture conflicts where horizontal swipes move the page instead of the grid
- sticky headers with transparent backgrounds
- accidental text selection during touch panning
- booking cards intercepting drag gestures unnecessarily

The scrollbar may be visually subdued, but horizontal navigation must remain obvious enough for users to discover additional dates.

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

For the calendar, keyboard and focus behavior must provide a usable route to booking cards/actions without requiring pointer-only precision interaction.

## 12. Responsive Strategy

### Desktop

Optimize for rapid studio operation, dense calendar, financial tables, and settings management.

For the booking calendar specifically:

- retain multiple visible date columns
- allow remaining dates to continue off-screen horizontally
- prioritize useful booking-card width over fitting an arbitrary seven-day range into the viewport
- keep the left time scale continuously visible

### Tablet

Preserve operational information while reducing secondary columns/actions.

The calendar should maintain minimum usable date-column width and rely on horizontal panning instead of shrinking booking cards excessively.

### Mobile

Prioritize:

- today/next booking
- schedule navigation
- quick new booking
- customer/payment essentials
- readable settings forms

For the calendar:

- do not squeeze all dates into the mobile viewport
- preserve a narrow sticky time column
- show one or several usable date columns depending on screen width
- allow smooth free horizontal scrolling to adjacent dates
- retain sticky date context
- avoid mandatory snap-to-date behavior
- ensure booking cards remain large enough to tap

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

Calendar loading states should preserve the grid footprint where practical so the page does not jump dramatically when bookings load.

## 14. Acceptance Criteria

- Pages share a coherent visual/component system.
- Calendar follows the approved wide date-column/time-row scheduling reference.
- Calendar is usable with mouse, touchpad, and touch.
- Booking block height communicates booking duration.
- Sticky date and time context remains opaque and readable while scrolling.
- Horizontal date navigation is smooth and does not force snap behavior.
- Mobile does not require desktop-width layouts for core booking workflows.
- Complex pricing settings remain understandable through labels and rule summaries.
- Destructive actions are visually and behaviorally guarded.
- Core components meet baseline keyboard/focus/contrast requirements.
