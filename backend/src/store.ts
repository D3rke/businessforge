import fs from 'node:fs';
import path from 'node:path';
import { createAssetPreview, createBuildPlan, createBusiness, createDeployment, createOpportunities, createReport, createRuntime } from './demoData.js';
import type { Business, Opportunity, ResearchRun, State } from './types.js';

const statePath = path.resolve(process.cwd(), '..', 'data/state.json');

function ensureStateFile() {
  if (!fs.existsSync(statePath)) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ businesses: [], researchRuns: [], deployments: [] }, null, 2));
  }
}

function readState(): State {
  ensureStateFile();
  const raw = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(raw) as State;
}

function writeState(state: State) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function ensureBusiness(state: State): Business {
  let business = state.businesses.find((entry) => entry.id === 'biz-joes-pizza');
  if (!business) {
    business = createBusiness();
    state.businesses = [business];
    writeState(state);
  }
  return business;
}

function maybeFinalizeRun(state: State, run: ResearchRun) {
  if (run.status === 'complete') return;
  const elapsed = Date.now() - run.startedAt;
  const total = run.stageDurationsMs.reduce((sum, ms) => sum + ms, 0);
  if (elapsed < total) return;

  run.status = 'complete';
  run.completedAt = new Date().toISOString();

  const business = ensureBusiness(state);
  const report = createReport();
  const opportunities = createOpportunities();
  const selected = opportunities[0];
  business.report = report;
  business.opportunities = opportunities;
  business.selectedOpportunityId = selected.id;
  business.buildPlan = createBuildPlan(selected);
  business.runtime = createRuntime(selected, report);
  business.runtime.assetPreview = createAssetPreview(selected);
  business.deployment = createDeployment();
  state.deployments = [business.deployment];
  writeState(state);
}

export function getDiscovery(query: string) {
  const state = readState();
  const business = ensureBusiness(state);
  if (!query.toLowerCase().includes('joe')) {
    return {
      matches: [],
      suggestion: 'Demo mode currently includes Joe\'s Pizza. Search for Joe\'s Pizza to explore the full tier-1 flow.'
    };
  }
  return { matches: [business], suggestion: null };
}

export function startResearch(businessId: string) {
  const state = readState();
  ensureBusiness(state);

  const existing = state.researchRuns.find((run) => run.businessId === businessId && run.status === 'running');
  if (existing) {
    maybeFinalizeRun(state, existing);
    return getResearch(existing.id);
  }

  const run: ResearchRun = {
    id: `run-${Date.now()}`,
    businessId,
    status: 'running',
    createdAt: new Date().toISOString(),
    startedAt: Date.now(),
    stages: ['Discovering sources', 'Extracting evidence', 'Synthesizing report', 'Generating build plan', 'Preparing agent runtime'],
    stageDurationsMs: [1500, 1700, 1600, 1500, 1700]
  };
  state.researchRuns.unshift(run);
  writeState(state);
  return getResearch(run.id);
}

export function getResearch(runId: string) {
  const state = readState();
  const run = state.researchRuns.find((entry) => entry.id === runId);
  if (!run) return null;
  maybeFinalizeRun(state, run);

  const elapsed = Math.max(0, Date.now() - run.startedAt);
  let acc = 0;
  let stageIndex = 0;
  for (let i = 0; i < run.stageDurationsMs.length; i++) {
    acc += run.stageDurationsMs[i];
    if (elapsed < acc) {
      stageIndex = i;
      break;
    }
    stageIndex = Math.min(i + 1, run.stages.length - 1);
  }
  const total = run.stageDurationsMs.reduce((sum, ms) => sum + ms, 0);
  const progress = Math.min(100, Math.round((elapsed / total) * 100));
  const business = state.businesses.find((entry) => entry.id === run.businessId) ?? createBusiness();

  return {
    run,
    progress,
    currentStage: run.status === 'complete' ? 'Complete' : run.stages[stageIndex],
    business
  };
}

export function selectOpportunity(businessId: string, opportunityId: string) {
  const state = readState();
  const business = ensureBusiness(state);
  const report = business.report ?? createReport();
  const opportunities = business.opportunities ?? createOpportunities();
  const selected = opportunities.find((entry) => entry.id === opportunityId) ?? opportunities[0];

  business.report = report;
  business.opportunities = opportunities;
  business.selectedOpportunityId = selected.id;
  business.buildPlan = createBuildPlan(selected);
  business.runtime = createRuntime(selected, report);
  business.deployment = createDeployment();
  state.deployments = [business.deployment];
  writeState(state);
  return business;
}

export function updateTask(businessId: string, taskId: string, action: 'advance' | 'block') {
  const state = readState();
  const business = ensureBusiness(state);
  if (!business.runtime) {
    const selected = (business.opportunities ?? createOpportunities())[0];
    business.runtime = createRuntime(selected, business.report ?? createReport());
  }
  const task = business.runtime.tasks.find((entry) => entry.id === taskId);
  if (!task) return null;

  if (action === 'advance') {
    task.status = task.status === 'queued' ? 'running' : 'done';
    task.notes = task.status === 'done' ? 'Marked complete from the live dashboard.' : 'Pulled into active execution.';
  } else {
    task.status = 'blocked';
    task.notes = 'Blocked manually from the live dashboard for operator review.';
  }

  business.runtime.eventLog.unshift({ at: new Date().toISOString(), text: `${task.title} updated to ${task.status}.` });
  if (business.deployment) {
    const allDone = business.runtime.tasks.every((entry) => entry.status === 'done');
    if (allDone) {
      business.deployment.state = 'live';
      business.deployment.history.push({ at: new Date().toISOString(), state: 'live', note: 'All agent tasks completed.' });
      business.runtime.status = 'stable';
    }
  }
  writeState(state);
  return business;
}

export function getBusiness(businessId: string) {
  const state = readState();
  return state.businesses.find((entry) => entry.id === businessId) ?? null;
}
