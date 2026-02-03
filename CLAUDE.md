# Habit Build - Project Guidelines

## Project Overview

A browser-based habit tracking app for building lasting habits through daily check-ins and visual streak tracking. Built with Astro, vanilla TypeScript/JavaScript, and deployed to Cloudflare Pages.

## Tech Stack

- **Framework**: Astro 5.x (static site generation with islands architecture)
- **Language**: TypeScript (strict mode)
- **Styling**: Vanilla CSS with CSS variables
- **State**: IndexedDB (local) + Cloudflare D1 (cloud sync)
- **Build Tool**: Bun 1.3.x (package manager, bundler, test runner)
- **Deployment**: Cloudflare Pages + Cloudflare Functions
- **Database**: Cloudflare D1 (SQLite)
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
│   ├── settings.astro        # Manage challenge
│   ├── friends.astro         # Social features / friend feed
│   ├── login.astro           # Authentication
│   └── register.astro        # Account creation
├── components/
│   ├── Onboarding.astro      # Setup wizard
│   ├── DailyView.astro       # Today's goals
│   ├── GoalCard.astro        # Individual goal check-in
│   ├── Calendar.astro        # Visual grid
│   ├── StreakDisplay.astro   # Stats display
│   └── Navigation.astro      # Bottom nav
├── scripts/
│   ├── db.ts                 # IndexedDB wrapper
│   ├── store.ts              # Data CRUD operations (with caching)
│   ├── challenge.ts          # Business logic
│   ├── dates.ts              # Date utilities
│   ├── types.ts              # TypeScript interfaces
│   ├── ui.ts                 # DOM helpers + XSS escaping
│   ├── api.ts                # Backend API client (with caching)
│   ├── cache.ts              # TTL-based caching layer
│   └── auth.ts               # Authentication helpers
└── styles/
    └── global.css            # Design system

functions/                    # Cloudflare Functions (API)
├── _middleware.ts            # Auth, CORS, security headers
├── utils.ts                  # Response helpers
└── api/
    ├── auth/
    │   ├── register.ts       # POST /api/auth/register
    │   ├── login.ts          # POST /api/auth/login
    │   └── me.ts             # GET /api/auth/me
    ├── sync/
    │   ├── push.ts           # POST /api/sync/push (with validation)
    │   └── pull.ts           # GET /api/sync/pull
    ├── friends/
    │   ├── index.ts          # GET/POST friends list
    │   ├── requests.ts       # Friend requests
    │   └── [code].ts         # Friend by code
    └── feed/
        └── index.ts          # GET /api/feed
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
- Instant IndexedDB updates with background cloud sync
- Works offline (syncs when online)

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

### SVG Icon Guidelines
**Common Issue:** SVG icons appearing oversized or on separate lines.

**Prevention:**
1. Always add explicit `width` and `height` attributes to inline SVGs (don't rely on CSS alone)
2. Add `flex-shrink: 0` to icon containers to prevent collapse
3. Use `align-items: center` on flex containers with icons (not `flex-start`)
4. Add `white-space: nowrap` to status badges containing icons + text

**Example fix:**
```html
<!-- Bad: relies on CSS only -->
<svg viewBox="0 0 24 24">...</svg>

<!-- Good: explicit dimensions -->
<svg viewBox="0 0 24 24" width="14" height="14">...</svg>
```

```css
/* Container should prevent icon from growing/shrinking */
.status-badge {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.status-badge svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
```

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

## Security Measures (Implemented)

### XSS Prevention
- `escapeHTML()` and `escapeAttr()` functions in `src/scripts/ui.ts`
- All user-generated content escaped before DOM insertion
- Applied to: challenge names, goal names, notes, friend names, friend codes

### CORS Policy
- Origin validation in `functions/_middleware.ts`
- Allowed origins: `https://habit-build.pages.dev`, `localhost:4321`, `localhost:8788`
- No wildcard `*` CORS headers

### Security Headers
Applied via middleware to all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (scripts, styles, fonts restricted)
- `Strict-Transport-Security` (HSTS)
- `Permissions-Policy` (restricts browser features)

### Input Validation
- Server-side validation on `/api/sync/push`:
  - UUID format validation
  - Date format validation (YYYY-MM-DD)
  - Challenge field validation (name length, duration bounds, status enum, hex colors)
  - Entry validation (boolean completed, note length limit)
  - Goal ownership verification
  - Request size limits (50 challenges, 500 entries max)
- UUID validation on friendship endpoints:
  - `functions/api/friends/respond.ts` - validates `friendshipId`
  - `functions/api/friends/remove.ts` - validates `friendshipId`
  - `functions/api/feed/index.ts` - validates user IDs
- Friend code format validation:
  - `functions/api/friends/invite.ts` - validates `HABIT-XXXX` format
  - `isValidFriendCode()` in `functions/utils.ts`

### Performance Optimizations
- TTL-based caching layer (`src/scripts/cache.ts`)
- Cached data: challenges (5min), friends (15min), feed (10min), account (1hr)
- Manual refresh button on friends page
- Cache invalidation on data mutations

## Security TODO (Remaining)

- [ ] Add rate limiting (see implementation notes below)
- [ ] Add token expiration (see implementation notes below)

### Rate Limiting Implementation Notes

Cloudflare provides rate limiting at the edge. Options:

1. **Cloudflare Rate Limiting Rules** (Recommended for production)
   - Configure in Cloudflare Dashboard > Security > WAF > Rate limiting rules
   - Example: 100 requests per minute per IP for `/api/*`
   - No code changes required

2. **Custom Rate Limiting with KV**
   ```typescript
   // In _middleware.ts, use KV to track request counts
   const key = `ratelimit:${clientIP}:${minute}`;
   const count = await env.RATE_LIMIT_KV.get(key);
   if (count && parseInt(count) > 100) {
     return new Response('Too Many Requests', { status: 429 });
   }
   await env.RATE_LIMIT_KV.put(key, String((parseInt(count || '0') + 1)), { expirationTtl: 60 });
   ```

### Token Expiration Implementation Notes

Requires schema change and middleware update:

1. **Schema Migration**
   ```sql
   ALTER TABLE users ADD COLUMN token_created_at TEXT;
   UPDATE users SET token_created_at = created_at;
   ```

2. **Middleware Check** (in `_middleware.ts`)
   ```typescript
   const tokenAge = Date.now() - new Date(user.token_created_at).getTime();
   const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
   if (tokenAge > maxAge) {
     return errorResponse('Token expired', 401, 'TOKEN_EXPIRED');
   }
   ```

3. **Token Refresh Endpoint**
   - Add `POST /api/auth/refresh` to issue new token
   - Update `token_created_at` on refresh
