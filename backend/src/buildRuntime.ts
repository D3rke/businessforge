import fs from 'node:fs';
import path from 'node:path';
import type { AgentTest, BuildArtifact, BuildEvent, BuildFile, BuildRun, Business, Deployment, Opportunity, Runtime, RuntimeEvent } from './types.js';

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pushBuildEvent(run: BuildRun, runtime: Runtime, event: Omit<BuildEvent, 'id' | 'at'>) {
  const full = { id: id('bevt'), at: new Date().toISOString(), ...event };
  run.events.unshift(full);
  const runtimeEvent: RuntimeEvent = {
    id: id('evt'),
    at: full.at,
    type: 'build-event',
    actor: 'builder',
    text: event.text,
    taskId: event.taskId,
    buildEventType: event.type
  };
  runtime.eventLog.unshift(runtimeEvent);
}

function recordArtifact(repoRoot: string, run: BuildRun, fullPath: string, kind: BuildArtifact['kind'], description: string) {
  const stat = fs.statSync(fullPath);
  const rel = path.relative(repoRoot, fullPath);
  const artifact: BuildArtifact = { path: rel, kind, description, sizeBytes: stat.size };
  run.artifacts.push(artifact);
  run.files.push({ path: rel, name: path.basename(rel), kind: 'file', sizeBytes: stat.size });
  return artifact;
}

function createAppSpec(business: Business, opportunity: Opportunity) {
  const topEvidence = (business.evidenceItems ?? []).slice(0, 4);
  return {
    business: business.name,
    city: business.city,
    mode: business.mode,
    category: business.category,
    opportunity: opportunity.title,
    headline: business.category === 'restaurant' ? `Order or book ${business.name} faster` : `Choose ${business.name} with more confidence`,
    subheadline: topEvidence[0]?.statement ?? business.description,
    cta: business.category === 'restaurant' ? 'Start order' : 'Request appointment',
    sections: {
      proof: topEvidence.filter((item) => item.type === 'proof' || item.type === 'audience').map((item) => item.statement),
      friction: topEvidence.filter((item) => item.type === 'friction').map((item) => item.statement),
      operations: topEvidence.filter((item) => item.type === 'operations' || item.type === 'offer').map((item) => item.statement)
    },
    evidence: topEvidence.map((item) => ({ statement: item.statement, sources: item.sourceIds })),
    generatedAt: new Date().toISOString()
  };
}

function createHtml(spec: ReturnType<typeof createAppSpec>) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(spec.business)} | BusinessForge preview</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./app.js"></script>
  </body>
</html>
`;
}

function createStyles() {
  return `:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: #f6f7f4; color: #0f172a; }
* { box-sizing: border-box; }
.shell { max-width: 1100px; margin: 0 auto; padding: 32px 20px 60px; }
.hero, .card, .panel { background: white; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 2px 16px rgba(15,23,42,.04); }
.hero { padding: 28px; display: grid; gap: 20px; }
.hero-grid, .grid { display: grid; gap: 18px; }
@media (min-width: 900px) { .hero-grid { grid-template-columns: 1.2fr .8fr; } .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.pill { display: inline-flex; padding: 6px 10px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 700; letter-spacing: .03em; }
h1 { font-size: 44px; line-height: 1.05; margin: 0; }
p { line-height: 1.6; }
button { border: 0; border-radius: 16px; padding: 14px 18px; background: #0f172a; color: white; font-weight: 700; cursor: pointer; }
button.secondary { background: white; color: #0f172a; border: 1px solid #cbd5e1; }
.card { padding: 20px; }
label { display: block; font-size: 14px; color: #475569; margin-bottom: 8px; }
input, select { width: 100%; border: 1px solid #cbd5e1; border-radius: 14px; padding: 12px 14px; font-size: 15px; }
.list { display: grid; gap: 12px; }
.list-item { padding: 16px; border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; }
.muted { color: #64748b; }
`;
}

function createAppJs(spec: ReturnType<typeof createAppSpec>) {
  return [
    `const spec = ${JSON.stringify(spec, null, 2)};`,
    "const app = document.getElementById('app');",
    "const state = { bookings: [], name: '', need: 'Consultation', time: 'Morning' };",
    "function list(items, fallback) { return (items.length ? items : [fallback]).map((text) => '<div class=\"list-item\">' + text + '</div>').join(''); }",
    "function render() {",
    "  app.innerHTML = '';",
    "  const shell = document.createElement('div');",
    "  shell.className = 'shell';",
    "  const evidenceHtml = spec.evidence.map((item) => '<div class=\"list-item\"><strong>' + item.statement + '</strong><div class=\"muted\">' + item.sources.length + ' linked source(s)</div></div>').join('');",
    "  const requestsHtml = state.bookings.length ? state.bookings.map((item) => '<div class=\"list-item\"><strong>' + item.name + '</strong><div>' + item.need + ' • ' + item.time + '</div><div class=\"muted\">Saved locally at ' + item.at + '</div></div>').join('') : '<div class=\"list-item muted\">No local requests saved yet.</div>';",
    "  shell.innerHTML = '' +",
    "    '<section class=\"hero\">' +",
    "    '<span class=\"pill\">Local preview only</span>' +",
    "    '<div class=\"hero-grid\">' +",
    "      '<div><h1>' + spec.headline + '</h1><p>' + spec.subheadline + '</p><div style=\"display:flex; gap:12px; flex-wrap:wrap; margin-top:16px;\"><button id=\"jump-book\">' + spec.cta + '</button><button class=\"secondary\" id=\"jump-proof\">Why trust this</button></div></div>' +",
    "      '<div class=\"card\"><h3 style=\"margin-top:0\">Based on retrieved evidence</h3><div class=\"list\">' + evidenceHtml + '</div></div>' +",
    "    '</div></section>' +",
    "    '<section class=\"grid\" style=\"margin-top:20px;\">' +",
    "      '<div class=\"card\"><h3>Proof</h3><div class=\"list\">' + list(spec.sections.proof, 'Public proof remains limited.') + '</div></div>' +",
    "      '<div class=\"card\"><h3>Friction</h3><div class=\"list\">' + list(spec.sections.friction, 'No public friction signal captured.') + '</div></div>' +",
    "      '<div class=\"card\"><h3>Next steps</h3><div class=\"list\">' + list(spec.sections.operations, 'Public next-step signal remains light.') + '</div></div>' +",
    "    '</section>' +",
    "    '<section class=\"grid\" style=\"margin-top:20px; grid-template-columns:1fr 1fr;\">' +",
    "      '<div class=\"card\" id=\"book-panel\"><h3 style=\"margin-top:0\">Request flow</h3><label>Your name</label><input id=\"name\" placeholder=\"Jordan\" value=\"' + state.name + '\" /><div style=\"display:grid; gap:12px; grid-template-columns:1fr 1fr; margin-top:12px;\"><div><label>Need</label><select id=\"need\"><option>Consultation</option><option>Pickup order</option><option>Office lunch</option><option>Appointment</option></select></div><div><label>Preferred time</label><select id=\"time\"><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div></div><div style=\"display:flex; gap:12px; margin-top:16px;\"><button id=\"save-request\">Save local request</button></div><p class=\"muted\" style=\"margin-bottom:0\">This preview stores requests in the page only. No remote deployment or live booking backend exists.</p></div>' +",
    "      '<div class=\"card\" id=\"proof-panel\"><h3 style=\"margin-top:0\">Preview activity</h3><div id=\"requests\" class=\"list\">' + requestsHtml + '</div></div>' +",
    "    '</section>';",
    "  app.appendChild(shell);",
    "  shell.querySelector('#jump-book').addEventListener('click', () => document.getElementById('book-panel').scrollIntoView({ behavior: 'smooth' }));",
    "  shell.querySelector('#jump-proof').addEventListener('click', () => document.getElementById('proof-panel').scrollIntoView({ behavior: 'smooth' }));",
    "  shell.querySelector('#name').addEventListener('input', (event) => { state.name = event.target.value; });",
    "  shell.querySelector('#need').value = state.need;",
    "  shell.querySelector('#time').value = state.time;",
    "  shell.querySelector('#need').addEventListener('change', (event) => { state.need = event.target.value; });",
    "  shell.querySelector('#time').addEventListener('change', (event) => { state.time = event.target.value; });",
    "  shell.querySelector('#save-request').addEventListener('click', () => { if (!state.name.trim()) return alert('Add a name first.'); state.bookings.unshift({ name: state.name.trim(), need: state.need, time: state.time, at: new Date().toLocaleTimeString() }); state.name = ''; render(); });",
    "}",
    "render();"
  ].join('\n');
}

function createReadme(business: Business, opportunity: Opportunity, files: BuildArtifact[], previewUrl: string) {
  return `# BusinessForge generated mini-app\n\n- Business: ${business.name}\n- Mode: ${business.mode}\n- Opportunity: ${opportunity.title}\n- Preview: ${previewUrl}\n- Evidence items used: ${(business.evidenceItems ?? []).slice(0, 4).map((item) => item.id).join(', ') || 'none'}\n\n## Files\n${files.map((file) => `- ${file.path}: ${file.description}`).join('\n')}\n`;
}

function validateBundle(dir: string) {
  const specPath = path.join(dir, 'app-spec.json');
  const htmlPath = path.join(dir, 'index.html');
  const jsPath = path.join(dir, 'app.js');
  const cssPath = path.join(dir, 'styles.css');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as { headline?: string; cta?: string; evidence?: unknown[] };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const errors: string[] = [];
  if (!spec.headline) errors.push('spec missing headline');
  if (!spec.cta) errors.push('spec missing cta');
  if (!Array.isArray(spec.evidence) || spec.evidence.length === 0) errors.push('spec missing evidence');
  if (!html.includes('./app.js')) errors.push('html missing app.js reference');
  if (!html.includes('./styles.css')) errors.push('html missing stylesheet reference');
  if (!js.includes('save-request')) errors.push('app.js missing interactive request flow');
  if (!css.includes('.hero')) errors.push('styles.css missing expected layout styles');
  return { ok: errors.length === 0, errors };
}

function repairBundle(dir: string, business: Business) {
  const specPath = path.join(dir, 'app-spec.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
  if (!spec.cta) spec.cta = business.category === 'restaurant' ? 'Start order' : 'Request appointment';
  if (!Array.isArray(spec.evidence) || spec.evidence.length === 0) spec.evidence = (business.evidenceItems ?? []).slice(0, 1).map((item) => ({ statement: item.statement, sources: item.sourceIds }));
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  return 'Applied template repair to restore CTA and evidence in app-spec.json.';
}

export function createPendingBuildRun(business: Business, opportunity: Opportunity, repoRoot: string): BuildRun {
  const workspaceDir = path.join(repoRoot, 'generated', `${business.id}-${opportunity.id}`);
  ensureDir(workspaceDir);
  return {
    id: id('build'),
    opportunityId: opportunity.id,
    status: 'pending',
    startedAt: new Date().toISOString(),
    workspaceDir,
    previewUrl: `/generated/${path.basename(workspaceDir)}/index.html`,
    events: [{ id: id('bevt'), at: new Date().toISOString(), type: 'BUILD_QUEUED', text: `Queued build run for ${opportunity.title}.` }],
    artifacts: [],
    files: [],
    validations: [],
    deploymentStatus: 'not-started',
    repairNotes: []
  };
}

export async function executeBuildRun(business: Business, opportunity: Opportunity, repoRoot: string, run: BuildRun) {
  if (!business.runtime) throw new Error('runtime not ready');
  const runtime = business.runtime;
  const workspaceDir = run.workspaceDir;
  ensureDir(workspaceDir);
  run.status = 'running';
  pushBuildEvent(run, runtime, { type: 'BUILD_STARTED', text: `Started bounded build run for ${opportunity.title}.` });
  const activeTask = runtime.tasks[1] ?? runtime.tasks[0];
  if (activeTask) {
    activeTask.status = 'running';
    pushBuildEvent(run, runtime, { type: 'TASK_STARTED', text: `Started ${activeTask.title}.`, taskId: activeTask.id });
  }

  const spec = createAppSpec(business, opportunity);
  const specPath = path.join(workspaceDir, 'app-spec.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  recordArtifact(repoRoot, run, specPath, 'json', 'Evidence-linked mini-app specification.');
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created app-spec.json.', filePath: path.relative(repoRoot, specPath) });
  await sleep(250);

  const htmlPath = path.join(workspaceDir, 'index.html');
  fs.writeFileSync(htmlPath, createHtml(spec));
  recordArtifact(repoRoot, run, htmlPath, 'html', 'Mini-app shell preview.');
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created index.html.', filePath: path.relative(repoRoot, htmlPath) });
  await sleep(250);

  const cssPath = path.join(workspaceDir, 'styles.css');
  fs.writeFileSync(cssPath, createStyles());
  recordArtifact(repoRoot, run, cssPath, 'css', 'Preview styling for the generated mini-app.');
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created styles.css.', filePath: path.relative(repoRoot, cssPath) });
  await sleep(250);

  const jsPath = path.join(workspaceDir, 'app.js');
  fs.writeFileSync(jsPath, createAppJs(spec));
  recordArtifact(repoRoot, run, jsPath, 'js', 'Interactive local request flow for the generated mini-app.');
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created app.js.', filePath: path.relative(repoRoot, jsPath) });
  await sleep(250);

  const readmePath = path.join(workspaceDir, 'README.md');
  fs.writeFileSync(readmePath, createReadme(business, opportunity, run.artifacts, run.previewUrl || 'local preview only'));
  recordArtifact(repoRoot, run, readmePath, 'md', 'Build run summary and artifact manifest.');
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created README.md.', filePath: path.relative(repoRoot, readmePath) });

  pushBuildEvent(run, runtime, { type: 'TEST_STARTED', text: 'Started artifact validation.', testName: 'bundle validation' });
  let validation = validateBundle(workspaceDir);
  if (!validation.ok) {
    pushBuildEvent(run, runtime, { type: 'TEST_FAILED', text: `Artifact validation failed: ${validation.errors.join(', ')}.`, testName: 'bundle validation' });
    const repair = repairBundle(workspaceDir, business);
    run.repairNotes.push(repair);
    pushBuildEvent(run, runtime, { type: 'FILE_UPDATED', text: 'Updated app-spec.json after repair.', filePath: path.relative(repoRoot, specPath) });
    await sleep(200);
    pushBuildEvent(run, runtime, { type: 'TEST_STARTED', text: 'Re-ran artifact validation after repair.', testName: 'bundle validation retry' });
    validation = validateBundle(workspaceDir);
  }

  run.validations = validation.ok
    ? [{ id: id('test'), name: 'Generated mini-app validation', status: 'pass', details: 'HTML, CSS, JS, and JSON artifacts passed bounded validation.' }]
    : [{ id: id('test'), name: 'Generated mini-app validation', status: 'warn', details: validation.errors.join(', ') }];

  if (validation.ok) {
    pushBuildEvent(run, runtime, { type: 'TEST_PASSED', text: 'Artifact validation passed.', testName: 'bundle validation' });
    run.deploymentStatus = 'in-progress';
    pushBuildEvent(run, runtime, { type: 'DEPLOYMENT_STARTED', text: `Local preview prepared at ${run.previewUrl}.` });
    run.deploymentStatus = 'complete';
    pushBuildEvent(run, runtime, { type: 'DEPLOYMENT_COMPLETE', text: 'Local preview is ready. No remote deployment was attempted.' });
    run.status = 'passed';
  } else {
    run.status = 'failed';
  }

  run.completedAt = new Date().toISOString();
  pushBuildEvent(run, runtime, { type: 'BUILD_COMPLETE', text: `Build run ${run.status}.` });

  runtime.tests = mergeTests(runtime.tests, run.validations);
  runtime.status = run.status === 'passed' ? 'stable' : 'executing';
  runtime.tasks = runtime.tasks.map((task, index) => ({ ...task, status: run.status === 'passed' ? (index <= 2 ? 'done' : task.status) : task.status }));

  const deployment: Deployment = business.deployment ?? { id: id('dep'), state: 'draft', history: [], honestStatus: 'Deployment is abstract.' };
  deployment.state = run.status === 'passed' ? 'live' : 'validating';
  deployment.previewUrl = run.previewUrl;
  deployment.honestStatus = run.status === 'passed' ? 'Validated local preview bundle generated. No remote production deploy was attempted.' : 'Build artifacts failed validation. No deployment was attempted.';
  deployment.history.push({ at: new Date().toISOString(), state: 'deploying', note: 'Started bounded local preview generation.' });
  deployment.history.push({ at: new Date().toISOString(), state: deployment.state, note: deployment.honestStatus });
  business.deployment = deployment;

  return business;
}

function mergeTests(existing: AgentTest[], next: AgentTest[]) {
  const map = new Map<string, AgentTest>();
  [...existing, ...next].forEach((test) => map.set(test.name, test));
  return Array.from(map.values());
}
