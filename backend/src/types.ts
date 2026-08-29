export type SourceKind = 'website' | 'review' | 'directory' | 'social' | 'search' | 'menu' | 'operations';

export type EvidenceStrength = 'low' | 'medium' | 'high';
export type EvidenceSentiment = 'positive' | 'negative' | 'mixed' | 'neutral';
export type FindingType = 'demand' | 'friction' | 'offer' | 'operations' | 'proof' | 'audience';

export type Source = {
  id: string;
  title: string;
  url: string;
  kind: SourceKind;
  excerpt: string;
  evidence: string[];
};

export type EvidenceItem = {
  id: string;
  theme: string;
  statement: string;
  type: FindingType;
  sentiment: EvidenceSentiment;
  strength: EvidenceStrength;
  sourceIds: string[];
  implication: string;
};

export type EvidenceClaim = {
  claim: string;
  sourceIds: string[];
  evidenceIds: string[];
};

export type IntelligenceReport = {
  summary: string;
  strengths: string[];
  gaps: string[];
  marketSignals: string[];
  evidence: EvidenceClaim[];
  keyThemes: string[];
};

export type Opportunity = {
  id: string;
  title: string;
  impact: number;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  rationale: string;
  evidenceIds: string[];
  capabilityNeeds: string[];
  category: 'acquisition' | 'conversion' | 'retention' | 'operations';
};

export type BuildPlanStep = {
  id: string;
  title: string;
  owner: string;
  outcome: string;
  status: 'todo' | 'ready' | 'doing' | 'done';
  evidenceIds: string[];
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
  capability: string;
};

export type AgentTask = {
  id: string;
  title: string;
  agentId: string;
  status: 'queued' | 'running' | 'blocked' | 'done';
  notes: string;
  evidenceIds: string[];
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

export type RuntimeEventType = 'task-update' | 'handoff' | 'interaction' | 'capability-request' | 'system';

export type RuntimeEvent = {
  id: string;
  at: string;
  type: RuntimeEventType;
  actor: string;
  text: string;
  taskId?: string;
  capability?: string;
};

export type RuntimeInteraction = {
  id: string;
  at: string;
  agentId: string;
  userMessage: string;
  response: string;
};

export type Runtime = {
  status: 'idle' | 'ready' | 'executing' | 'stable';
  agents: AgentDefinition[];
  tasks: AgentTask[];
  tests: AgentTest[];
  assetPreview: AssetPreview;
  eventLog: RuntimeEvent[];
  interactions: RuntimeInteraction[];
  missingCapabilities: string[];
};

export type Business = {
  id: string;
  query: string;
  name: string;
  category: string;
  city: string;
  description: string;
  stage: 'candidate' | 'researched';
  discoveryScore: number;
  sources: Source[];
  evidenceItems?: EvidenceItem[];
  report?: IntelligenceReport;
  opportunities?: Opportunity[];
  selectedOpportunityId?: string;
  buildPlan?: BuildPlanStep[];
  runtime?: Runtime;
  deployment?: Deployment;
};

export type DiscoveryResponse = {
  matches: Business[];
  suggestion: string | null;
};

export type ResearchRun = {
  id: string;
  businessId: string;
  status: 'running' | 'complete';
  createdAt: string;
  startedAt: number;
  stageDurationsMs: number[];
  stages: string[];
  provider: string;
  completedAt?: string;
};

export type State = {
  businesses: Business[];
  researchRuns: ResearchRun[];
  deployments: Deployment[];
};

export type ResearchResponse = {
  run: ResearchRun;
  progress: number;
  currentStage: string;
  business: Business;
};

export type RuntimeInteractionResponse = {
  business: Business;
  interaction: RuntimeInteraction;
};
