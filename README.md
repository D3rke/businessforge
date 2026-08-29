# BusinessForge

BusinessForge is a full-stack MVP for turning business discovery into an evidence-backed operating plan and live agent workspace.

## Stack

- Frontend: React, React Router, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Persistence: local JSON state
- Discovery: public OpenStreetMap-based place search plus optional website research

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173/>.

The backend runs on <http://localhost:8788/>.

## Current flow

- landing page for search, website input, and Near me geolocation
- results page with live business candidates from public place providers when available
- workspace page with tabs for Overview, Sources, Opportunities, Agents, and Activity
- website research still runs through the backend provider abstraction
- if a public website is reachable, BusinessForge fetches accessible pages and derives evidence from them
- if place or website data is thin, BusinessForge degrades gracefully to synthesized candidate data
- Joe's Pizza remains only as a silent fallback path

## Try a real search

1. Start the app with `npm run dev`
2. Open the landing page
3. Enter `McDonald's`
4. Click `Near me` or add a city like `Los Angeles`
5. Pick a result, then run analysis
6. In the workspace, select an opportunity to shift into the focused agent view

## Notes

- No API keys are required for the included discovery path.
- Public provider quality depends on OpenStreetMap and reachable websites.
- Runtime state is written to `data/state.json`.
- External side effects are still simulated, but internal handoffs, task updates, and runtime interaction are live in-app.
