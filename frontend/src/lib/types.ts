export type Source = {
  id: string;
  title: string;
  url: string;
  kind: string;
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
  effort: string;
  rationale: string;
};

export type BuildPlanStep = {
  id: string;
  title: string;
  owner: string;
  outcome: string;
  status: string;
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
  status: string;
  notes: string;
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

export type Runtime = {
  status: string;
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

export type ResearchResponse = {
  run: { id: string; status: string };
  progress: number;
  currentStage: string;
  business: Business;
};
