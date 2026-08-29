# BusinessForge

BusinessForge is a full-stack MVP for turning business discovery into an evidence-backed operating plan and lightweight agent runtime.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Persistence: local JSON state for demo mode

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173/>.

The backend runs on <http://localhost:8788/>.

## Current flow

BusinessForge now supports arbitrary local-business queries, not just Joe's Pizza.

- discovery returns multiple candidate businesses per query
- Joe's Pizza remains the richest built-in demo profile
- other queries synthesize fallback candidates from the search text
- research goes through a provider abstraction
- without external config, the app uses a local fallback provider
- evidence is normalized into structured findings
- report, opportunities, build plan, and runtime all derive from that evidence
- live operator messages can be routed to the runtime via `/api/business/:businessId/runtime/interact`

## Optional external research provider

If you want to wire in a real provider later, set:

```bash
RESEARCH_PROVIDER_URL=https://your-provider.example/research
```

BusinessForge will POST the selected business payload there and expect JSON containing `sources` and `evidenceItems`.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
```

## Notes

- No API keys are required for the included local fallback mode.
- Runtime state is written to `data/state.json`, which is intentionally gitignored.
- External side effects like real CRM sends or production automations are still simulated, but internal handoffs, event emission, task updates, and runtime interaction are now live in-app.
