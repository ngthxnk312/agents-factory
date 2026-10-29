# UI/UX and accessibility checklist

Use as a menu, not a quota: pick what applies to the screen and platform. Accessibility items reference WCAG 2.2 success criteria (level A/AA) where relevant.

## 1. Visual / layout

- [ ] Layout matches the approved design per state; spacing, alignment and grid consistent
- [ ] Typography (family, size, weight, line height) from tokens; no browser-default fallbacks
- [ ] Colors from tokens; dark/light theme both correct if supported
- [ ] No truncated, overlapping or overflowing text; ellipsis only where designed, with full text accessible
- [ ] Icons correct size/color/meaning; images not stretched or pixelated; placeholders for failed images
- [ ] Long content (names, addresses, amounts with many digits, many list items) handled
- [ ] Consistent component behavior across screens (buttons, dialogs, toasts, tables)

## 2. Responsive / device

- [ ] Smallest and largest supported widths; each defined breakpoint
- [ ] Reflow at 320 CSS px width without two-dimensional scrolling for text content (1.4.10)
- [ ] Browser zoom 200% (1.4.4) and text spacing overrides (1.4.12) without loss of content
- [ ] Orientation not locked unless essential (1.3.4); rotation preserves state
- [ ] Soft keyboard does not hide the focused field or the primary action
- [ ] Safe areas, notches, system bars, foldables/tablets if supported
- [ ] Platform text-size settings (dynamic type / font scale) up to the largest supported value

## 3. States

- [ ] Loading (skeleton/spinner) with no layout jump; long operations show progress
- [ ] Empty state explains why and offers a next action
- [ ] Error state: validation, server error, timeout, offline — each distinct and recoverable
- [ ] No permission / read-only rendering; hidden vs disabled actions as specified
- [ ] Success/confirmation clearly distinguishable from failure
- [ ] Partial data and stale data indications

## 4. Interaction and feedback

- [ ] Immediate visual feedback on press/click/hover/focus
- [ ] Primary action disabled or guarded while processing (no double submission)
- [ ] Destructive actions confirmed or undoable
- [ ] Back/cancel paths return to a sensible state without data loss
- [ ] Gestures (swipe, drag, pinch) have single-pointer alternatives (2.5.1, 2.5.7)
- [ ] Animations smooth; reduced-motion preference respected; nothing flashes more than 3 times per second (2.3.1)
- [ ] Time limits adjustable or warned before expiry (2.2.1) — including session timeouts
- [ ] Pull-to-refresh, infinite scroll, pagination behave and announce new content

## 5. Forms and errors

- [ ] Every input has a visible label and programmatic name (1.3.1, 3.3.2, 4.1.2)
- [ ] Required fields indicated in text, not only color or asterisk without explanation
- [ ] Input purpose / autocomplete attributes for personal data (1.3.5)
- [ ] Errors identified in text, next to the field, with a fix suggestion (3.3.1, 3.3.3); summary for long forms
- [ ] Errors announced to assistive technology (live region or focus move)
- [ ] User input preserved after an error
- [ ] Confirmation/review step for legal, financial or data-changing submissions (3.3.4)
- [ ] No redundant re-entry of information already provided in the same process (3.3.7)
- [ ] Authentication does not rely on a cognitive test only; paste allowed in password/code fields (3.3.8)

## 6. Keyboard and focus (web; also external keyboards on mobile)

- [ ] Whole flow completable with keyboard only (2.1.1); no keyboard trap (2.1.2)
- [ ] Logical focus order (2.4.3); focus visible (2.4.7) and not hidden behind sticky elements (2.4.11)
- [ ] Skip link or landmarks to bypass repeated blocks (2.4.1)
- [ ] Dialogs: focus moves in, is contained, returns to the trigger on close; Escape closes
- [ ] Custom widgets follow expected keyboard patterns (arrow keys in menus/tabs/listboxes)

## 7. Screen readers and semantics

- [ ] Controls expose correct name, role, state, value (4.1.2); icons-only buttons have labels
- [ ] Headings structure and landmarks meaningful; page/screen title unique and descriptive (2.4.2)
- [ ] Images: meaningful ones have text alternatives; decorative ones hidden (1.1.1)
- [ ] Reading order matches visual order (1.3.2)
- [ ] Status messages announced without moving focus (4.1.3)
- [ ] Tested with at least one screen reader per supported platform (desktop browser, iOS, Android)

## 8. Color and contrast

- [ ] Text contrast ≥ 4.5:1; large text ≥ 3:1 (1.4.3)
- [ ] UI component boundaries, focus indicators and meaningful graphics ≥ 3:1 (1.4.11)
- [ ] Information not conveyed by color alone (1.4.1) — e.g. error fields also have icon/text

## 9. Targets and pointer

- [ ] Web targets ≥ 24×24 CSS px or adequately spaced (2.5.8); mobile recommended 44×44 pt / 48×48 dp
- [ ] Actions trigger on up-event or are cancellable (2.5.2)
- [ ] Visible label text contained in the accessible name (2.5.3)
- [ ] Drag operations have a non-drag alternative (2.5.7)

## 10. Media

- [ ] Captions for prerecorded audio/video (1.2.2); transcripts/alternatives as required
- [ ] No auto-playing audio over 3 seconds without control (1.4.2)

## 11. Localization

- [ ] Longest language fits; no hard-coded strings; correct pluralization
- [ ] Date, time, number, currency formats per locale; time zone shown where ambiguous
- [ ] Right-to-left layout mirrored if supported; icons with direction mirrored
- [ ] Language of page/parts declared (3.1.1, 3.1.2)

## 12. Sensitive-data presentation

- [ ] Identifiers (account, card, national id, phone) masked per policy; reveal requires explicit action
- [ ] Sensitive screens excluded from screenshots/app-switcher previews where policy requires (mobile)
- [ ] Nothing sensitive in page titles, URLs, push notification previews, logs shown to users
- [ ] Auto-logout warning and behavior on sensitive apps; data cleared from screen after logout
- [ ] Confirmation screens show amount, counterparty and fees before commitment

## 13. Perceived performance

- [ ] First meaningful content quickly on the reference device/network; skeletons instead of blank screens
- [ ] No jank on scroll/animation on the lowest supported device
- [ ] Layout stable while loading (no content jumping under the pointer)
