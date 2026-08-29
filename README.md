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

BusinessForge now supports arbitrary local-business intake, with Joe's Pizza kept as demo fallback only.

- discovery returns multiple candidate businesses per query
- users can optionally provide a website URL during intake
- if a public website is reachable, local research fetches accessible pages from that domain and turns them into real sources/evidence
- if website fetch is unavailable or too thin, BusinessForge falls back to synthesized local-business signals
- research still goes through the provider abstraction
- an external HTTP provider can still replace the local research path later
- evidence is normalized into structured findings
- report, opportunities, build plan, and runtime all derive from that evidence
- live operator messages can be routed to the runtime via `/api/business/:businessId/runtime/interact`

## Optional external research provider

If you want to wire in a real provider later, set:

```bash
RESEARCH_PROVIDER_URL=https://your-provider.example/research
```

BusinessForge will POST the selected business payload there and expect JSON containing `sources` and `evidenceItems`.

## Try the real-path flow

1. Start the app with `npm run dev`
2. Search for a real business or category query
3. Add a public website URL when you have one
4. Run analysis

You should see the workspace mark the business basis as `website`, `synthetic`, or `demo`.

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
