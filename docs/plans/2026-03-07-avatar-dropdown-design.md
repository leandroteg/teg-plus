# Avatar Dropdown — Design Doc

**Date:** 2026-03-07
**Status:** Approved
**Scope:** Move Perfil + Admin links from Compras sidebar to global avatar dropdown

---

## Problem

Perfil and Administração links live inside the Compras module sidebar. They're global features that don't belong to any specific module. Other 8 modules have no access to Perfil/Admin from the sidebar.

## Solution

Replace the bottom user card + scattered links with a single avatar circle next to the TEG+ logo. Click opens a dropdown popover with Perfil, Admin (admin-only), Theme toggle, and Logout.

## Layout

### Desktop Sidebar — Top

```
┌──────────────────────────────┐
│  [Logo]  TEG+          [👤]  │
│          ERP Sistema         │
├──────────────────────────────┤
│  [🛒 Compras badge]         │
```

### Avatar Dropdown (popover, top-right aligned)

```
┌─────────────────────┐
│  João Silva         │
│  Comprador          │
├─────────────────────┤
│  👤 Meu Perfil      │
│  🛡️ Administração   │  ← admin only
├─────────────────────┤
│  🌙 Tema escuro [⬤] │
├─────────────────────┤
│  🚪 Sair            │
└─────────────────────┘
```

### Mobile Header

```
┌──────────────────────────────────┐
│  [Logo]  TEG+ Compras    [👤]   │
└──────────────────────────────────┘
```

Same dropdown, positioned below avatar on mobile.

## Avatar Spec

- **With photo:** `<img>` round, `object-cover`, subtle ring
- **Without photo:** colored circle (name hash), white initials, bold font
- Size: `w-9 h-9` desktop, `w-8 h-8` mobile
- Hover: `scale-105` + subtle ring glow
- Smooth transition on dropdown open/close

## What Gets Removed

- Bottom user card from sidebar (name + role + logout button)
- `/perfil` from Compras NAV array
- `showAdminLink` prop from ModuleConfig
- `profileRoute` prop from ModuleConfig
- Separate logout button from mobile header
- Standalone ThemeToggle below nav → moves inside dropdown

## What Stays Unchanged

- Perfil.tsx page content
- AdminUsuarios.tsx page content
- All other module layouts (they gain the dropdown for free via ModuleLayout)

## Route Change

- `/perfil` route moves from Compras module group to global PrivateRoute scope in App.tsx
- `/admin/usuarios` stays in AdminRoute group but uses a minimal layout wrapper

## Files to Modify

1. `ModuleLayout.tsx` — main changes (avatar + dropdown + remove user card)
2. `Layout.tsx` (Compras) — remove `/perfil` from NAV, remove `showAdminLink`/`profileRoute`
3. `App.tsx` — move `/perfil` route to global scope
