# Habit Build - Project Guidelines

## Project Overview

A browser-based habit tracking app for building lasting habits through daily check-ins and visual streak tracking. Built with Astro, vanilla TypeScript/JavaScript, and deployed to Cloudflare Pages.

## Tech Stack

- **Framework**: Astro 5.x (static site generation with islands architecture)
- **Language**: TypeScript (strict mode)
- **Styling**: Vanilla CSS with CSS variables
- **State**: IndexedDB (browser-only, no server)
- **Build Tool**: Bun 1.3.x (package manager, bundler, test runner)
- **Deployment**: Cloudflare Pages
- **Dependencies**: Zero runtime dependencies

## Documentation References

### Bun Documentation
- **Main Docs**: https://bun.sh/docs
- **LLM Index**: https://bun.com/docs/llms.txt (complete doc index for AI tools)
- **Runtime APIs**: https://bun.sh/docs/runtime/bun-apis
- **Package Manager**: https://bun.sh/docs/pm/cli/install
- **Bundler**: https://bun.sh/docs/bundler
- **Test Runner**: https://bun.sh/docs/test

**Bun Best Practices:**
- Always check Bun docs before reaching for npm packages
- Use native Bun APIs when available (Bun.file, Bun.serve, Bun.password, etc.)
- Prefer `bun:test` for testing over Jest
- Use `bun run` instead of `npm run` for scripts
- Use `bunx` instead of `npx` for one-off package execution

**Bun Native Features to Use:**
- `Bun.randomUUIDv7()` - UUIDs (server-side)
- `Bun.password.hash/verify()` - Password hashing
- `Bun.file()` - File operations
- `Bun.write()` - File writing
- `Bun.serve()` - HTTP server
- `Bun.gzipSync/gunzipSync()` - Compression
- `Bun.deepEquals()` - Deep object comparison
- `Bun.escapeHTML()` - HTML escaping

### Astro Documentation
- **Main Docs**: https://docs.astro.build/en/getting-started/
- **Using Bun with Astro**: https://docs.astro.build/en/recipes/bun/
- **Components**: https://docs.astro.build/en/basics/astro-components/
- **Pages & Routing**: https://docs.astro.build/en/basics/astro-pages/
- **Client-Side Scripts**: https://docs.astro.build/en/guides/client-side-scripts/
- **TypeScript**: https://docs.astro.build/en/guides/typescript/
- **Cloudflare Deployment**: https://docs.astro.build/en/guides/deploy/cloudflare/

**Astro Best Practices:**
- Use `.astro` components for static content
- Use `<script>` tags with no framework for client interactivity
- Prefer static generation over SSR when possible
- Use TypeScript in Astro frontmatter
- Keep components small and composable

## Architecture

```
src/
├── layouts/
│   └── Layout.astro          # Base HTML shell
├── pages/
│   ├── index.astro           # Daily dashboard / onboarding
│   ├── calendar.astro        # Visual streak calendar
│   ├── history.astro         # Past challenges
│   └── settings.astro        # Manage challenge
├── components/
│   ├── Onboarding.astro      # Setup wizard
│   ├── DailyView.astro       # Today's goals
│   ├── GoalCard.astro        # Individual goal check-in
│   ├── Calendar.astro        # Visual grid
│   ├── StreakDisplay.astro   # Stats display
│   └── Navigation.astro      # Bottom nav
├── scripts/
│   ├── db.ts                 # IndexedDB wrapper
│   ├── store.ts              # Data CRUD operations
│   ├── challenge.ts          # Business logic
│   ├── dates.ts              # Date utilities
│   ├── types.ts              # TypeScript interfaces
│   └── ui.ts                 # DOM helpers
└── styles/
    └── global.css            # Design system
```

## Data Model

```typescript
interface Challenge {
  id: string;
  name: string;
  startDate: string;      // ISO date YYYY-MM-DD
  duration: number;       // days (default 75)
  strictMode: boolean;    // reset on miss
  goals: Goal[];
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  endDate?: string;       // when completed/failed
  failedOnDay?: number;   // if strict mode failed
}

interface Goal {
  id: string;
  name: string;
  color: string;          // hex color
}

interface DayEntry {
  date: string;           // ISO date YYYY-MM-DD
  goalId: string;
  completed: boolean;
  note?: string;
}

interface AppState {
  currentChallengeId: string | null;
  challenges: Challenge[];
  entries: DayEntry[];
}
```

## Design System

### Colors (Warm/Organic)
```css
--bg-primary: #faf6f1;      /* warm cream */
--bg-secondary: #f5efe8;    /* slightly darker cream */
--bg-card: #ffffff;
--text-primary: #2d2a26;    /* warm black */
--text-secondary: #5c564e;
--text-muted: #8a8279;
--accent-primary: #c77b58;  /* terracotta */
--accent-success: #7d9a78;  /* sage green */
--accent-warning: #d4a84b;  /* warm amber */
--accent-danger: #c25d4e;   /* muted red */
--border: #e8e2da;
--border-light: #f0ebe4;
```

### Typography
- **Display**: Fraunces (variable, serif) - for headings, numbers
- **Body**: DM Sans (sans-serif) - for text, UI elements

### Goal Colors (preset palette)
```css
--goal-coral: #e07a5f;
--goal-sage: #81b29a;
--goal-gold: #f2cc8f;
--goal-slate: #3d405b;
--goal-sky: #7eb8da;
--goal-plum: #9c89b8;
```

## Key Principles

### Habit Science Integration
Based on research from UCL and James Clear's Atomic Habits:

1. **66-day default** - Average time for habit formation (not 21 days)
2. **Never miss twice** - Missing one day doesn't break habit formation
3. **Implementation intentions** - Prompt when/where for each goal
4. **Visual chain** - "Don't break the chain" calendar view
5. **Identity focus** - Frame as "become someone who..."
6. **Minimal friction** - One-tap daily check-in

### Strict Mode (75 Hard)
Optional hardcore mode where missing any day resets the challenge to Day 0.
- Challenge archived to history as "failed"
- User must explicitly restart

### UX Guidelines
- Mobile-first responsive design
- Maximum 2 taps to complete daily check-in
- Satisfying micro-animations on completion
- No server calls - instant IndexedDB updates
- Works offline

## Frontend Design Skill

### Aesthetic Direction: Warm/Organic
- Earthy tones, soft shadows, paper-like textures
- Calming daily ritual feel
- Subtle grain texture on backgrounds
- Hand-drawn inspired check marks
- Generous whitespace
- Rounded corners (8-16px)

### Typography Rules
- Fraunces for: headings, streak numbers, day numbers
- DM Sans for: body text, buttons, labels
- Font sizes: 12/14/16/20/24/32/48px scale
- Line height: 1.4 for body, 1.2 for headings

### Motion Guidelines
- Ease curves: cubic-bezier(0.4, 0, 0.2, 1)
- Duration: 150ms micro, 300ms standard, 500ms emphasis
- Check animation: scale bounce + color fill
- Page transitions: fade + slight slide

### Component Patterns
- Cards: white bg, subtle shadow, 12px radius
- Buttons: solid fill, 8px radius, 44px min touch target
- Inputs: bottom border style, no full outline
- Calendar cells: 40-48px squares, centered content

## Development Commands

```bash
# Install dependencies
bun install

# Development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Deploy to Cloudflare
bun run deploy
```

## File Naming Conventions

- Components: PascalCase (`GoalCard.astro`)
- Scripts: camelCase (`store.ts`)
- CSS: kebab-case if separate (`goal-card.css`)
- Pages: lowercase (`calendar.astro`)

## Code Style

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use template literals for HTML in scripts
- Keep components under 200 lines
- Extract reusable logic to `/scripts/`
- Comment complex business logic

## Testing Checklist

Before deploying, verify:
- [ ] Onboarding flow completes successfully
- [ ] Goals can be checked/unchecked
- [ ] Notes save correctly
- [ ] Calendar displays all days
- [ ] Streak count is accurate
- [ ] Strict mode resets properly
- [ ] History shows past challenges
- [ ] Export/Import works
- [ ] Works on mobile Safari/Chrome
- [ ] Works offline (after first load)
