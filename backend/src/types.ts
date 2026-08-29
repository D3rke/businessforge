export type Source = {
  id: string;
  title: string;
  url: string;
  kind: 'website' | 'review' | 'directory' | 'social';
  excerpt: string;
  evidence: string[];
};

export type IntelligenceReport = {
  summary: string;
  strengths: string[];
  gaps: string[];
  marketSignals: string[];
  evidence: { claim: string; sourceIds: string[] }[];
};

export type Opportunity = {
  id: string;
  title: string;
  impact: number;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  rationale: string;
};

export type BuildPlanStep = {
  id: string;
  title: string;
  owner: string;
  outcome: string;
  status: 'todo' | 'ready' | 'doing' | 'done';
};

export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  goal: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  dependsOn: string[];
};

export type AgentTask = {
  id: string;
  title: string;
  agentId: string;
  status: 'queued' | 'running' | 'blocked' | 'done';
  notes: string;
};

export type AgentTest = {
  id: string;
  name: string;
  status: 'pass' | 'warn';
  details: string;
};

export type Deployment = {
  id: string;
  state: 'draft' | 'validating' | 'deploying' | 'live';
  history: { at: string; state: string; note: string }[];
};

export type AssetPreview = {
  type: 'landing-copy';
  headline: string;
  subheadline: string;
  cta: string;
  bullets: string[];
};

export type Runtime = {
  status: 'idle' | 'ready' | 'executing' | 'stable';
  agents: AgentDefinition[];
  tasks: AgentTask[];
  tests: AgentTest[];
  assetPreview: AssetPreview;
  eventLog: { at: string; text: string }[];
};

export type Business = {
  id: string;
  name: string;
  category: string;
  city: string;
  description: string;
  sources: Source[];
  report?: IntelligenceReport;
  opportunities?: Opportunity[];
  selectedOpportunityId?: string;
  buildPlan?: BuildPlanStep[];
  runtime?: Runtime;
  deployment?: Deployment;
};

export type ResearchRun = {
  id: string;
  businessId: string;
  status: 'running' | 'complete';
  createdAt: string;
  startedAt: number;
  stageDurationsMs: number[];
  stages: string[];
  completedAt?: string;
};

export type State = {
  businesses: Business[];
  researchRuns: ResearchRun[];
  deployments: Deployment[];
};
