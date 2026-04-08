# Split Layout Design — Mandala + Mural de Recados

**Date**: 2026-03-05
**Status**: Approved

## Summary

Redesign the ModuloSelector home page from a single-column centered layout to a split 60/40 desktop layout with the mandala on the left and a vertical "Mural de Recados" (banner slideshow) on the right. On mobile, the mural becomes a popup bottom-sheet triggered by a header button, while the mandala stays at the top.

## Desktop Layout

### Grid Structure
- `grid lg:grid-cols-[1fr_380px] gap-6`
- Breakpoint: `lg` (1024px+) activates split layout
- Below lg: single-column (mobile behavior)

### Left Column — Mandala
- Same radial mandala with TEG+ logo center + 6 orbiting pillars
- Centered vertically in available space: `flex items-center justify-center`
- Scaling: `md:scale-90 lg:scale-100`
- Subtitle "Selecione uma área para acessar" below

### Right Column — Mural de Recados (380px)
- **Header**: "Mural de Recados" title with Megaphone icon, teal gradient text
- **Subtitle**: "Comunicados e avisos internos" in muted text
- **Banner card**: single visible card at a time with crossfade transition
  - Image with aspect-ratio ~16/9, rounded-2xl, Ken Burns animation
  - Dark gradient overlay at bottom
  - Title (bold) + subtitle + type badge (Comunicado/Campanha)
  - Progress bar at bottom of active card
- **Navigation**: dot indicators + arrow buttons on hover
- **Auto-advance**: same 5.5s interval as current slideshow
- **Styling**: glass-card, border, subtle teal glow, rounded-2xl
- **Height**: fills viewport height minus header/footer

## Mobile Layout

### Mandala
- Stays at top, same scale-[0.68] behavior
- Greeting above mandala (unchanged)

### Mural Popup (Bottom Sheet)
- **Trigger**: Megaphone icon button in header with notification badge (count of active banners)
- **Modal**: slides up from bottom with backdrop blur
  - Header: "Mural de Recados" + close button
  - Banner slideshow with touch swipe navigation
  - Swipe down to dismiss
  - Rounded top corners, max-height 70vh

## Components

### Modified: `ModuloSelector.tsx`
- Wrap content in responsive grid
- Left column: mandala section
- Right column: `<MuralSidebar />` (hidden below lg)
- Mobile: add Megaphone button to header (hidden lg+)
- Mobile: `<MuralPopup />` component

### New: `MuralSidebar.tsx`
- Vertical banner slideshow for desktop right column
- Reuses `useBanners()` hook
- Single card visible with crossfade
- Auto-advance, dots, arrows on hover

### New: `MuralPopup.tsx`
- Bottom-sheet modal for mobile
- Reuses `useBanners()` hook
- Touch swipe navigation + swipe down to close
- Backdrop blur overlay

## Data Source
- Same `useBanners()` hook from `hooks/useMural.ts`
- Same `MuralBanner` type
- Same default slides when no banners exist


## Links
- [[obsidian/02 - Frontend Stack]]
