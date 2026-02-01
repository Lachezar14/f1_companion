# F1 Companion UI Design Notes

This document captures the current design language used across the newly refreshed screens (GP view, sessions list, session cards, driver detail heroes). Use it as a reference when updating existing screens or building new ones to keep the app visually cohesive.

## 1. Visual Theme
- **Palette**: Dark graphite hero cards (`#15151E` / `#161623`) paired with bright accent colors (F1 red `#E10600`, aqua `#3EC5FF`, peach `#FF8A5C`, mint `#6DE19C`, lavender `#AC8CFF`).
- **Backgrounds**: Light neutral surfaces (`#F5F5F7`, `#F2F2F2`) provide contrast for elevated cards.
- **Cards**: Use rounded corners (16–24 px), high-quality shadows (shadow opacity ~0.15, blur radius 8–12), and hairline borders for separation.
- **Typography**: Heavy weights (600–700) for titles, 14–16 px baseline, uppercase labels with letter spacing for metadata.

## 2. Hero Sections
- Combine **image + gradient overlay** (e.g., circuit track or flag) with textual info on top.
- Layout: flex row with text block on left, illustrative image on right.
- Include chips/pills for contextual metadata (circuit type, tire compound, etc.).

## 3. Cards & Lists
- **Session cards**: Themed badges based on session type (practice/quali/sprint/race), icons from Ionicons, left colored stroke, subtle tint background for icon circles.
- **GP cards**: Flag background, overlay for readability, row of chips for circuit/date, bold title.
- **Spacing**: 16 px horizontal padding, 12 px vertical spacing between cards.

## 4. Data Presentation
- Prefer short descriptors in uppercase + small font for labels (“Dates”, “Circuit Type”).
- Use date helpers that output “Wed, Apr 3 · 18:00 (GMT+2)” style strings for consistency.
- Display counts/statistics in hero stats (e.g., total events, upcoming).

## 5. Interaction
- Cards use `TouchableOpacity` with `activeOpacity` ~0.85 for subtle feedback.
- Chevron icon on navigation rows to indicate tap targets.
- Loading/error states share same center layout: background grey, activity indicator red, neutral text.

## 6. Asset Fallbacks
- When images (flags/headshots) are missing, use neutral placeholders; wrap backgrounds with overlays to maintain legibility.

## 7. Session Screens
- Race/Practice detail screens now use the same hero card concept: left-aligned session info + chips, right-aligned (or bottom) stat row showing counts (drivers, SC laps, total laps, fastest lap).
- Section cards for classifications/tables use white backgrounds, 16–20 px radius, light borders, and subtle shadows. List headers (tables) get rounded backgrounds as well.
- Keep ScrollView backgrounds light gray and spacing symmetrical (16 px margins) so cards float consistently across tabs.
- Driver classification rows (practice/race) share a single-row pattern: left column for position/status, compact driver badge with number + acronym centered, and a right column for the primary metric (fastest lap or gap). No per-row stat stacks to keep the list dense on mobile widths.

## 8. Implementation Tips
- Centralize colors and spacing tokens as constants if more screens adopt the style.
- Extract chip/tile components if repetition grows (currently each hero defines simple `chip` styles).
- Keep the hero summary logic (stats, upcoming counts) modular so other screens (e.g., Drivers list) can reuse it.

Following these guidelines should keep new UI aligned with the refreshed look seen on `GPScreen`, `SessionsScreen`, and the session cards.
