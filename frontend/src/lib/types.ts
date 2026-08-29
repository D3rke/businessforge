export type Source = {
  id: string;
  title: string;
  url: string;
  kind: string;
  excerpt: string;
  evidence: string[];
};

export type EvidenceItem = {
  id: string;
  theme: string;
  statement: string;
  type: string;
  sentiment: string;
  strength: string;
  sourceIds: string[];
  implication: string;
};

export type IntelligenceReport = {
  summary: string;
  strengths: string[];
  gaps: string[];
  marketSignals: string[];
  evidence: { claim: string; sourceIds: string[]; evidenceIds: string[] }[];
  keyThemes: string[];
};

export type Opportunity = {
  id: string;
  title: string;
  impact: number;
  confidence: number;
  effort: string;
  rationale: string;
  evidenceIds: string[];
  capabilityNeeds: string[];
  category: string;
};

export type BuildPlanStep = {
  id: string;
  title: string;
  owner: string;
  outcome: string;
  status: string;
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
  status: string;
  notes: string;
  evidenceIds: string[];
};

export type AgentTest = {
  id: string;
  name: string;
  status: string;
  details: string;
};

export type Deployment = {
  id: string;
  state: string;
  history: { at: string; state: string; note: string }[];
};

export type AssetPreview = {
  type: string;
  headline: string;
  subheadline: string;
  cta: string;
  bullets: string[];
};

export type RuntimeEvent = {
  id: string;
  at: string;
  type: string;
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
  status: string;
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
  stage: string;
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

export type ResearchResponse = {
  run: { id: string; status: string; provider: string };
  progress: number;
  currentStage: string;
  business: Business;
};

export type RuntimeInteractionResponse = {
  business: Business;
  interaction: RuntimeInteraction;
};
