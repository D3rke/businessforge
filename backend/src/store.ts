import fs from 'node:fs';
import path from 'node:path';
import { createPendingBuildRun, executeBuildRun } from './buildRuntime.js';
import { createBuildPlan, createDeployment, createJoeBusiness, createOpportunities, createReport, createRuntime } from './demoData.js';
import { discoverBusinesses } from './discovery.js';
import { interactWithRuntime } from './orchestrator.js';
import { getResearchProvider } from './researchProviders.js';
import type { BuildRun, Business, DiscoveryInput, DiscoveryResponse, ResearchResponse, ResearchRun, RuntimeInteractionResponse, State } from './types.js';

const repoRoot = path.resolve(process.cwd(), '..');
const statePath = path.resolve(repoRoot, 'data/state.json');
const activeBuilds = new Map<string, Promise<void>>();

function ensureStateFile() {
  if (!fs.existsSync(statePath)) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ businesses: [], researchRuns: [], deployments: [] }, null, 2));
  }
}

function readState(): State {
  ensureStateFile();
  const raw = fs.readFileSync(statePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<State>;
  return {
    businesses: Array.isArray(parsed.businesses) ? parsed.businesses : [],
    researchRuns: Array.isArray(parsed.researchRuns) ? parsed.researchRuns : [],
    deployments: Array.isArray(parsed.deployments) ? parsed.deployments : []
  };
}

function writeState(state: State) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function upsertBusiness(state: State, business: Business) {
  const index = state.businesses.findIndex((entry) => entry.id === business.id);
  if (index === -1) state.businesses.unshift(business);
  else state.businesses[index] = business;
  return business;
}

function ensureSeedBusiness(state: State) {
  const joe = state.businesses.find((entry) => entry.id === 'biz-joes-pizza');
  if (joe) return joe;
  const created = createJoeBusiness();
  upsertBusiness(state, created);
  writeState(state);
  return created;
}

function getBusinessOrThrow(state: State, businessId: string) {
  const business = state.businesses.find((entry) => entry.id === businessId);
  if (!business) throw new Error('business not found');
  return business;
}

function finalizeBusinessResearch(state: State, business: Business, providerName: string) {
  const evidenceItems = business.evidenceItems ?? [];
  const report = createReport(business, evidenceItems);
  const opportunities = createOpportunities(business, evidenceItems);
  const selected = opportunities[0];
  const runtime = createRuntime(business, selected, report);

  business.stage = 'researched';
  business.report = report;
  business.opportunities = opportunities;
  business.selectedOpportunityId = selected.id;
  business.buildPlan = createBuildPlan(selected, runtime.agents);
  business.runtime = runtime;
  business.deployment = createDeployment();
  state.deployments = [business.deployment, ...state.deployments.filter((entry) => entry.id !== business.deployment?.id)].slice(0, 5);
  upsertBusiness(state, business);

  const run = state.researchRuns.find((entry) => entry.businessId === business.id && entry.status === 'running');
  if (run) run.provider = providerName;
  writeState(state);
}

function maybeFinalizeRun(state: State, run: ResearchRun) {
  if (run.status === 'complete') return;
  const elapsed = Date.now() - run.startedAt;
  const total = run.stageDurationsMs.reduce((sum, ms) => sum + ms, 0);
  if (elapsed < total) return;
  const business = getBusinessOrThrow(state, run.businessId);
  finalizeBusinessResearch(state, business, run.provider);
  run.status = 'complete';
  run.completedAt = new Date().toISOString();
  writeState(state);
}

function syncDeploymentList(state: State, business: Business) {
  if (!business.deployment) return;
  state.deployments = [business.deployment, ...state.deployments.filter((entry) => entry.id !== business.deployment?.id)].slice(0, 8);
}

function startBuildJob(businessId: string, opportunityId: string) {
  if (activeBuilds.has(businessId)) return;
  const work = (async () => {
    const state = readState();
    const business = getBusinessOrThrow(state, businessId);
    if (!business.runtime || !business.opportunities) return;
    const opportunity = business.opportunities.find((entry) => entry.id === opportunityId) ?? business.opportunities[0];
    let run = business.runtime.buildRuns.find((entry) => entry.opportunityId === opportunity.id && entry.status !== 'passed') as BuildRun | undefined;
    if (!run) {
      run = createPendingBuildRun(business, opportunity, repoRoot);
      business.runtime.buildRuns.unshift(run);
      business.runtime.status = 'executing';
      upsertBusiness(state, business);
      syncDeploymentList(state, business);
      writeState(state);
    }
    await executeBuildRun(business, opportunity, repoRoot, run);
    const nextState = readState();
    upsertBusiness(nextState, business);
    syncDeploymentList(nextState, business);
    writeState(nextState);
  })().finally(() => activeBuilds.delete(businessId));
  activeBuilds.set(businessId, work);
}

export async function getDiscovery(input: string | DiscoveryInput): Promise<DiscoveryResponse> {
  const state = readState();
  ensureSeedBusiness(state);
  const response = await discoverBusinesses(input);
  response.matches.forEach((business) => upsertBusiness(state, business));
  writeState(state);
  return response;
}

export async function startResearch(businessId: string): Promise<ResearchResponse | null> {
  const state = readState();
  ensureSeedBusiness(state);
  const business = getBusinessOrThrow(state, businessId);
  const existing = state.researchRuns.find((run) => run.businessId === businessId && run.status === 'running');
  if (existing) {
    maybeFinalizeRun(state, existing);
    return getResearch(existing.id);
  }

  const provider = getResearchProvider();
  const run: ResearchRun = {
    id: `run-${Date.now()}`,
    businessId,
    status: 'running',
    createdAt: new Date().toISOString(),
    startedAt: Date.now(),
    stages: ['Resolving business identity', 'Gathering official, review, forum, news, and directory evidence', 'Filtering and matching entities', 'Aggregating findings', 'Preparing build workspace'],
    stageDurationsMs: [700, 1500, 1200, 900, 900],
    provider: provider.name
  };

  state.researchRuns.unshift(run);
  writeState(state);

  try {
    const result = await provider.research(business);
    const nextState = readState();
    const nextBusiness = nextState.businesses.find((entry) => entry.id === businessId);
    if (nextBusiness) {
      nextBusiness.sources = result.sources;
      nextBusiness.evidenceItems = result.evidenceItems;
      nextBusiness.identity = result.identity;
      nextBusiness.researchEvents = result.events;
      nextBusiness.researchBasis = result.provider === 'demo-fallback' ? (nextBusiness.researchBasis ?? 'demo') : 'hybrid';
      nextBusiness.researchMetadata = {
        plannerQuestions: result.plannerQuestions,
        limitations: result.limitations,
        providerAvailability: result.providerAvailability,
        sampleNote: result.sampleNote
      };
      upsertBusiness(nextState, nextBusiness);
      const nextRun = nextState.researchRuns.find((entry) => entry.id === run.id);
      if (nextRun) nextRun.provider = result.provider;
      writeState(nextState);
    }
  } catch (error) {
    const nextState = readState();
    const nextBusiness = nextState.businesses.find((entry) => entry.id === businessId);
    if (nextBusiness) {
      nextBusiness.researchMetadata = {
        plannerQuestions: nextBusiness.researchMetadata?.plannerQuestions ?? [],
        limitations: [...(nextBusiness.researchMetadata?.limitations ?? []), error instanceof Error ? error.message : 'Research provider failed.'],
        providerAvailability: nextBusiness.researchMetadata?.providerAvailability ?? []
      };
      upsertBusiness(nextState, nextBusiness);
      writeState(nextState);
    }
  }

  return getResearch(run.id);
}

export function getResearch(runId: string): ResearchResponse | null {
  const state = readState();
  const run = state.researchRuns.find((entry) => entry.id === runId);
  if (!run) return null;
  maybeFinalizeRun(state, run);
  const elapsed = Math.max(0, Date.now() - run.startedAt);
  const total = run.stageDurationsMs.reduce((sum, ms) => sum + ms, 0);
  let stageIndex = run.stages.length - 1;
  let acc = 0;
  for (let i = 0; i < run.stageDurationsMs.length; i++) {
    acc += run.stageDurationsMs[i];
    if (elapsed < acc) {
      stageIndex = i;
      break;
    }
  }
  const business = state.businesses.find((entry) => entry.id === run.businessId);
  if (!business) return null;
  return { run, progress: Math.min(100, Math.round((elapsed / total) * 100)), currentStage: run.status === 'complete' ? 'Complete' : run.stages[stageIndex], business };
}

export function selectOpportunity(businessId: string, opportunityId: string) {
  const state = readState();
  const business = getBusinessOrThrow(state, businessId);
  if (!business.report || !business.opportunities) return business;
  const selected = business.opportunities.find((entry) => entry.id === opportunityId) ?? business.opportunities[0];
  business.selectedOpportunityId = selected.id;
  business.runtime = createRuntime(business, selected, business.report);
  business.buildPlan = createBuildPlan(selected, business.runtime.agents);
  business.deployment = createDeployment();
  upsertBusiness(state, business);
  syncDeploymentList(state, business);
  writeState(state);
  return business;
}

export function startBuild(businessId: string) {
  const state = readState();
  const business = getBusinessOrThrow(state, businessId);
  if (!business.report || !business.opportunities || !business.runtime || !business.selectedOpportunityId) return business;
  const selected = business.opportunities.find((entry) => entry.id === business.selectedOpportunityId) ?? business.opportunities[0];
  const existing = business.runtime.buildRuns.find((run) => run.opportunityId === selected.id && (run.status === 'pending' || run.status === 'running'));
  if (!existing) {
    const pending = createPendingBuildRun(business, selected, repoRoot);
    business.runtime.buildRuns.unshift(pending);
    business.runtime.status = 'executing';
    business.runtime.eventLog.unshift({ id: `evt-${Date.now()}`, at: new Date().toISOString(), type: 'system', actor: 'system', text: `Build approved for ${selected.title}.` });
    upsertBusiness(state, business);
    syncDeploymentList(state, business);
    writeState(state);
    startBuildJob(businessId, selected.id);
  }
  return getBusiness(businessId);
}

export function updateTask(businessId: string, taskId: string, action: 'advance' | 'block') {
  const state = readState();
  const business = getBusinessOrThrow(state, businessId);
  const task = business.runtime?.tasks.find((entry) => entry.id === taskId);
  if (!task || !business.runtime) return null;
  if (action === 'advance') {
    task.status = task.status === 'queued' ? 'running' : 'done';
    task.notes = task.status === 'done' ? 'Marked complete from the workspace.' : 'Pulled into active execution.';
  } else {
    task.status = 'blocked';
    task.notes = 'Blocked manually from the workspace for operator review.';
  }
  business.runtime.eventLog.unshift({ id: `evt-${Date.now()}`, at: new Date().toISOString(), type: 'task-update', actor: 'operator', text: `${task.title} updated to ${task.status}.`, taskId: task.id });
  const allDone = business.runtime.tasks.every((entry) => entry.status === 'done');
  if (business.deployment && allDone) {
    business.deployment.state = 'live';
    business.deployment.history.push({ at: new Date().toISOString(), state: 'live', note: 'All bounded tasks completed.' });
    business.deployment.honestStatus = 'All bounded local tasks completed. No remote deployment was attempted.';
    business.runtime.status = 'stable';
  }
  upsertBusiness(state, business);
  syncDeploymentList(state, business);
  writeState(state);
  return business;
}

export function interact(businessId: string, agentId: string, message: string): RuntimeInteractionResponse {
  const state = readState();
  const business = getBusinessOrThrow(state, businessId);
  const response = interactWithRuntime(business, agentId, message);
  upsertBusiness(state, response.business);
  syncDeploymentList(state, response.business);
  writeState(state);
  return response;
}

export function getBusiness(businessId: string) {
  const state = readState();
  return state.businesses.find((entry) => entry.id === businessId) ?? null;
}

export function readBuildFile(businessId: string, relativePath: string) {
  const business = getBusiness(businessId);
  const latestRun = business?.runtime?.buildRuns?.[0];
  if (!business || !latestRun) return null;
  const candidate = path.resolve(repoRoot, relativePath);
  const runRoot = path.resolve(latestRun.workspaceDir);
  if (!candidate.startsWith(runRoot)) throw new Error('invalid file path');
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  return { path: relativePath, content: fs.readFileSync(candidate, 'utf8') };
}
