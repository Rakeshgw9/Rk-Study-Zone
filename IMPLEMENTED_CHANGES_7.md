# RK Study Zone — Changes 7 (UI/UX + quality pass)

New files: `src/lib/blockLabel.js` (shared block naming used by builder tree AND student sidebar),
`src/components/ui/SettingsControls.jsx` (shared colour swatch + hex edit, gradient presets, reset, sample card).

## Change 1 – Visual Lesson Builder
- Block header = number · type badge · type name · action icons, on one line, same for every block. No lesson text, no 2nd label line.
- "Block Title (editor only)" field removed from ready-made blocks.
- New blocks start EMPTY; light-grey placeholders are drawn by CSS (`data-placeholder`) and are never stored.
- Properties panel: title on one line with ellipsis, smaller "Ready-made block" pill, 4 equal tabs (Advanced on one line),
  Section Heading auto-grows, higher-contrast small labels, scroll offset so the sticky header never covers content.
- Canvas preview and left tree read the live working block, so they update while typing.

## Change 2 – Sidebars
- Student + builder tree show the real heading (ellipsis, full text on hover), `Part N` when empty, type badge H+P / EX / IMG / LIST in the builder.
- Completed ticks / percentages unchanged.

## Change 3 – Chapter & Unit settings
- No numbered badges; one swatch component (white visible), editable hex, 3 equal columns, Gradient/Solid chips below label,
  End Color hidden for Solid, live heading preview with the real name, sample lesson card on the background preview,
  6 gradient presets, custom colours, "Reset to default".

## Change 4 – Header + Unit page
- Compact one-row header, fixed-width save status, equal 36px buttons, only Publish is filled.
- Unit page: "Unit Created" badge removed (shows Draft when relevant), shorter banner, description shown, "Edit unit" tooltip,
  Contents → Blocks, duplicate Add Chapter removed from Unit Actions, Design Content disabled with "Add a chapter first",
  correct singular/plural, collapse buttons now live inside the panel headers (builder + student).

## Bugs fixed
- Image upload on the chapter canvas referenced an undefined variable (`block.id`).
- Stray copy-pasted line in `validateContent`.
- Student view no longer shows "Click to upload image" boxes; image captions now render.
- Dynamic + static import of storageService unified; unused imports removed.

Firebase config, data structure, autosave, Save Draft, Publish, draft recovery and progress logic were not changed.
