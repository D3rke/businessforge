import fs from 'node:fs';
import path from 'node:path';
import type { AgentTest, BuildArtifact, BuildEvent, BuildRun, Business, Deployment, Opportunity, Runtime, RuntimeEvent } from './types.js';

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
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

function createLandingSpec(business: Business, opportunity: Opportunity) {
  const topEvidence = (business.evidenceItems ?? []).slice(0, 3);
  return {
    business: business.name,
    mode: business.mode,
    opportunity: opportunity.title,
    headline: business.category === 'restaurant' ? `Order ${business.name} with less friction` : `Choose ${business.name} with more confidence`,
    subheadline: topEvidence[0]?.statement ?? business.description,
    cta: business.category === 'restaurant' ? 'View the offer' : 'Request availability',
    evidence: topEvidence.map((item) => ({ statement: item.statement, sources: item.sourceIds })),
    generatedAt: new Date().toISOString()
  };
}

function createReadme(business: Business, opportunity: Opportunity, files: BuildArtifact[]) {
  return `# BusinessForge generated bundle\n\n- Business: ${business.name}\n- Mode: ${business.mode}\n- Opportunity: ${opportunity.title}\n- Evidence items used: ${(business.evidenceItems ?? []).slice(0, 3).map((item) => item.id).join(', ') || 'none'}\n\n## Files\n${files.map((file) => `- ${file.path}: ${file.description}`).join('\n')}\n`;
}

function createHtml(spec: ReturnType<typeof createLandingSpec>) {
  return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${escapeHtml(spec.business)} | BusinessForge bundle</title>\n  </head>\n  <body>\n    <main>\n      <h1>${escapeHtml(spec.headline)}</h1>\n      <p>${escapeHtml(spec.subheadline)}</p>\n      <button>${escapeHtml(spec.cta)}</button>\n      <section>\n        <h2>Evidence used</h2>\n        <ul>\n          ${spec.evidence.map((item) => `<li>${escapeHtml(item.statement)}</li>`).join('')}\n        </ul>\n      </section>\n    </main>\n  </body>\n</html>\n`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function validateBundle(dir: string) {
  const specPath = path.join(dir, 'landing-spec.json');
  const htmlPath = path.join(dir, 'index.html');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as { headline?: string; cta?: string; evidence?: unknown[] };
  const html = fs.readFileSync(htmlPath, 'utf8');
  const errors: string[] = [];
  if (!spec.headline) errors.push('landing spec missing headline');
  if (!spec.cta) errors.push('landing spec missing cta');
  if (!Array.isArray(spec.evidence) || spec.evidence.length === 0) errors.push('landing spec missing evidence');
  if (!/<button>.*<\/button>/.test(html)) errors.push('html missing button');
  if (!/<h1>.*<\/h1>/.test(html)) errors.push('html missing headline');
  return { ok: errors.length === 0, errors };
}

function repairBundle(dir: string, business: Business) {
  const specPath = path.join(dir, 'landing-spec.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
  if (!spec.cta) spec.cta = business.category === 'restaurant' ? 'View the offer' : 'Request availability';
  if (!Array.isArray(spec.evidence) || spec.evidence.length === 0) {
    spec.evidence = (business.evidenceItems ?? []).slice(0, 1).map((item) => ({ statement: item.statement, sources: item.sourceIds }));
  }
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  return 'Applied template repair to restore required CTA/evidence fields.';
}

export function executeBuildRun(business: Business, opportunity: Opportunity, repoRoot: string) {
  if (!business.runtime) throw new Error('runtime not ready');
  const runtime = business.runtime;
  const workspaceDir = path.join(repoRoot, 'generated', `${business.id}-${opportunity.id}`);
  ensureDir(workspaceDir);

  const run: BuildRun = {
    id: id('build'),
    opportunityId: opportunity.id,
    status: 'running',
    startedAt: new Date().toISOString(),
    workspaceDir,
    events: [],
    artifacts: [],
    validations: [],
    deploymentStatus: 'not-started',
    repairNotes: []
  };

  pushBuildEvent(run, runtime, { type: 'BUILD_STARTED', text: `Started bounded build run for ${opportunity.title}.` });
  const strategyTask = runtime.tasks[1] ?? runtime.tasks[0];
  if (strategyTask) {
    strategyTask.status = 'running';
    pushBuildEvent(run, runtime, { type: 'TASK_STARTED', text: `Started ${strategyTask.title}.`, taskId: strategyTask.id });
  }

  const spec = createLandingSpec(business, opportunity);
  const specPath = path.join(workspaceDir, 'landing-spec.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  run.artifacts.push({ path: path.relative(repoRoot, specPath), kind: 'json', description: 'Evidence-linked landing page specification.' });
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created landing-spec.json.', filePath: path.relative(repoRoot, specPath) });

  const htmlPath = path.join(workspaceDir, 'index.html');
  fs.writeFileSync(htmlPath, createHtml(spec));
  run.artifacts.push({ path: path.relative(repoRoot, htmlPath), kind: 'html', description: 'Template-backed landing page preview.' });
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created index.html.', filePath: path.relative(repoRoot, htmlPath) });

  const readmePath = path.join(workspaceDir, 'README.md');
  fs.writeFileSync(readmePath, createReadme(business, opportunity, run.artifacts));
  run.artifacts.push({ path: path.relative(repoRoot, readmePath), kind: 'md', description: 'Build run summary and artifact manifest.' });
  pushBuildEvent(run, runtime, { type: 'FILE_CREATED', text: 'Created README.md.', filePath: path.relative(repoRoot, readmePath) });

  pushBuildEvent(run, runtime, { type: 'TEST_STARTED', text: 'Started artifact validation.', testName: 'bundle validation' });
  let validation = validateBundle(workspaceDir);
  if (!validation.ok) {
    pushBuildEvent(run, runtime, { type: 'TEST_FAILED', text: `Artifact validation failed: ${validation.errors.join(', ')}.`, testName: 'bundle validation' });
    const repair = repairBundle(workspaceDir, business);
    run.repairNotes.push(repair);
    pushBuildEvent(run, runtime, { type: 'FILE_UPDATED', text: 'Updated landing-spec.json after repair.', filePath: path.relative(repoRoot, specPath) });
    pushBuildEvent(run, runtime, { type: 'TEST_STARTED', text: 'Re-ran artifact validation after repair.', testName: 'bundle validation retry' });
    validation = validateBundle(workspaceDir);
  }

  const validationTests: AgentTest[] = validation.ok
    ? [{ id: id('test'), name: 'Generated bundle validation', status: 'pass', details: 'JSON and HTML artifacts passed bounded validation.' }]
    : [{ id: id('test'), name: 'Generated bundle validation', status: 'warn', details: validation.errors.join(', ') }];
  run.validations = validationTests;

  if (validation.ok) {
    pushBuildEvent(run, runtime, { type: 'TEST_PASSED', text: 'Artifact validation passed.', testName: 'bundle validation' });
    run.deploymentStatus = 'in-progress';
    pushBuildEvent(run, runtime, { type: 'DEPLOYMENT_STARTED', text: 'Marked deployment abstraction as ready for review.' });
    run.deploymentStatus = 'complete';
    pushBuildEvent(run, runtime, { type: 'DEPLOYMENT_COMPLETE', text: 'Deployment abstraction completed as a reviewed local artifact bundle.' });
    run.status = 'passed';
  } else {
    run.status = 'failed';
  }

  run.completedAt = new Date().toISOString();
  pushBuildEvent(run, runtime, { type: 'BUILD_COMPLETE', text: `Build run ${run.status}.` });

  runtime.buildRuns.unshift(run);
  runtime.tests = mergeTests(runtime.tests, validationTests);
  runtime.status = run.status === 'passed' ? 'stable' : 'executing';
  runtime.tasks = runtime.tasks.map((task, index) => ({ ...task, status: run.status === 'passed' ? (index <= 2 ? 'done' : task.status) : task.status }));

  const deployment: Deployment = business.deployment ?? {
    id: id('dep'),
    state: 'draft',
    history: [],
    honestStatus: 'Deployment is abstract.'
  };
  deployment.state = run.status === 'passed' ? 'live' : 'validating';
  deployment.honestStatus = run.status === 'passed'
    ? 'Validated artifact bundle generated locally. No remote production deploy was attempted.'
    : 'Build artifacts failed validation. No deployment was attempted.';
  deployment.history.push({ at: new Date().toISOString(), state: 'deploying', note: 'Started bounded local artifact deployment path.' });
  deployment.history.push({ at: new Date().toISOString(), state: deployment.state, note: deployment.honestStatus });
  business.deployment = deployment;

  return business;
}

function mergeTests(existing: AgentTest[], next: AgentTest[]) {
  const map = new Map<string, AgentTest>();
  [...existing, ...next].forEach((test) => map.set(test.name, test));
  return Array.from(map.values());
}
