# Gymnasio: athletic training app

A mobile-first gym and athletic performance app: personalised plans for your sport, a guided workout runner, transparent strength levels, recovery-aware adjustments, nutrition targets and a coach you can ask about all of it.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Motion and Zustand. Everything runs on-device by default: data lives in `localStorage` and there is no account.

## Run it

```bash
cd gym-app
npm install
npm run dev        # http://localhost:3000
npm test           # engine unit tests (vitest)
npm run lint       # type check
npm run build && npm start
```

On the welcome screen, **Explore with demo data** loads a simulated athlete with 8 weeks of history. Every demo screen shows a "Demo data" pill, and demo sessions are tagged "Demo". "Exit demo and start fresh" on the You tab clears it.

## How it's organised

| Area | Where | Notes |
| --- | --- | --- |
| Domain types | `src/lib/types.ts` | Profile, plan, sessions, check-ins, meals, tests |
| Exercise and food data | `src/lib/data/` | ~85 exercises with equipment, joint stress and qualities; ~58 foods |
| Focus profiles | `src/lib/engine/focus.ts` | 11 athletic focuses, primary/secondary blend, plain-language tradeoffs |
| Plan generation | `src/lib/engine/planner.ts` | Split by days and focus, scored exercise selection, time fitting |
| Progressive overload | `src/lib/engine/progression.ts` | Double progression with RPE, deload after repeated misses, readiness adjustment |
| Strength levels | `src/lib/engine/strength.ts` | Epley e1RM, body-weight ratio standards, confidence labels, muscle map assessment |
| Recovery | `src/lib/engine/recovery.ts` | Readiness from sleep, energy and soreness; day swaps and substitutions; pain is flagged, never diagnosed |
| Nutrition | `src/lib/engine/nutrition.ts`, `mealParser.ts` | Mifflin-St Jeor, training vs rest day targets, weight-trend adjustments; the meal parser never invents foods |
| Tests and analytics | `src/lib/engine/performance.ts`, `analytics.ts` | Noise thresholds, trends, milestones, conservative projections shown as ranges |
| State | `src/lib/store/` | Zustand store (persisted), derived selectors, demo data builder |
| Coach | `src/lib/assistant/coach.ts` | Rule-based answers that cite their basis; proposals (shorten, swap, change focus, adjust calories) are applied only after you confirm |
| Screens | `src/app/` | Welcome, onboarding, Today, Train, Progress, Nutrition, You, workout runner and summary |

All recommendations come from the deterministic engines above, which are covered by `src/lib/engine/engine.test.ts`.

## Integration seams

- **Natural-language coach (optional).** `src/app/api/coach/route.ts` can rephrase the coach's drafted answer with Claude. It runs server-side only, needs `ANTHROPIC_API_KEY` in the server environment (for example `.env.local`), and is off until the user turns on "Natural-language coach replies" on the You tab. Without a key it returns 501 and the app keeps the rule-based answer. Numbers and recommendations are never changed by the model.
- **Health data.** `src/lib/integrations/health.ts` lists Apple Health, Health Connect and wearables as "Native app" providers with a stub `syncHealth`. These need a native wrapper, so nothing connects today.
- **Barcode scanning** is shown as unavailable in the add-food sheet for the same reason.
- **Accounts and sync.** The store's export/import (`importState`) and JSON export on the You tab are the seam for a future backend.

## Privacy

- No data leaves the device unless the cloud coach toggle is on, and then only the question and the drafted answer are sent (no profile or history).
- You tab: export all data as JSON, or delete everything.
- No API keys in client code.
