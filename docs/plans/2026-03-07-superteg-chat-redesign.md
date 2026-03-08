# SuperTEG Chat — Light Premium Redesign

**Date:** 2026-03-07
**Status:** Approved
**Scope:** `SuperTEGChat.tsx` visual overhaul (hook untouched)

## Problems
1. Emoji avatar (🦸‍♂️) — unprofessional
2. Dark `#0c0f1a` background — heavy, disconnected from ERP
3. Emoji-heavy chips (📊📋📦💡) — amateur feel

## Solution: Light Premium
- **Palette:** White/slate-50 bg, teal-600 accents, slate-900 text
- **Avatar:** Lucide `Sparkles` icon in teal→violet gradient circle
- **Icons:** All Lucide — BarChart3, ClipboardList, Package, Lightbulb
- **Zero emojis** across entire component

## Components
- FAB: teal gradient circle + Sparkles icon
- Header: bg-white, clean border-b, slate text
- User bubble: bg-teal-600 text-white
- Bot bubble: bg-slate-50 text-slate-700
- Welcome: Sparkles icon, card-style quick actions
- Input: slate-50 bg, teal focus ring
- Code blocks: keep dark (contrast)

## Unchanged
- useSuperTEG hook
- Markdown/link rendering logic
- Responsiveness
- sessionStorage persistence
