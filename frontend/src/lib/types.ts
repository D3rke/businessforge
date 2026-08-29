export type ResearchMode = 'BUSINESS' | 'CORPORATION';
export type Provenance = 'REAL_RETRIEVED' | 'DEMO_DATA' | 'LLM_INFERENCE' | 'UNAVAILABLE';

export type SourceExcerpt = {
  text: string;
  evidenceRole: string;
};

export type Source = {
  id: string;
  title: string;
  url: string;
  domain: string;
  kind: string;
  sourceType: string;
  excerpt: string;
  evidence: string[];
  content?: string;
  excerpts?: SourceExcerpt[];
  retrievedAt?: string;
  provenance: Provenance;
  availability: string;
  qualityScore: number;
  relevanceScore: number;
  entityConfidence: number;
  entityDisposition: string;
  dates?: string[];
  notes?: string[];
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
  confidence: number;
  evidenceCount: number;
  sourceDiversity: number;
  provenance: Provenance;
  supportingExcerpts: Array<{ sourceId: string; text: string }>;
  firstObservedAt?: string;
  lastObservedAt?: string;
};

export type IntelligenceReport = {
  summary: string;
  strengths: string[];
  gaps: string[];
  marketSignals: string[];
  evidence: { claim: string; sourceIds: string[]; evidenceIds: string[] }[];
  keyThemes: string[];
  methodology: string[];
  limitations: string[];
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

export type BuildRun = {
  id: string;
  opportunityId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  workspaceDir: string;
  events: Array<{ id: string; at: string; type: string; text: string; taskId?: string; filePath?: string; testName?: string }>;
  artifacts: Array<{ path: string; kind: string; description: string }>;
  validations: AgentTest[];
  deploymentStatus: string;
  repairNotes: string[];
};

export type Deployment = {
  id: string;
  state: string;
  history: { at: string; state: string; note: string }[];
  honestStatus: string;
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
  buildEventType?: string;
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
  buildRuns: BuildRun[];
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type BusinessIdentity = {
  name: string;
  normalizedName: string;
  mode: ResearchMode;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  phone?: string;
  websiteUrl?: string;
  websiteDomain?: string;
  category?: string;
  coordinates?: GeoPoint;
  listingIds: Record<string, string>;
};

export type Business = {
  id: string;
  query: string;
  name: string;
  mode: ResearchMode;
  category: string;
  city: string;
  description: string;
  address?: string;
  websiteUrl?: string;
  latitude?: number;
  longitude?: number;
  discoveryProvider?: string;
  researchBasis?: string;
  stage: string;
  discoveryScore: number;
  sources: Source[];
  identity: BusinessIdentity;
  evidenceItems?: EvidenceItem[];
  report?: IntelligenceReport;
  opportunities?: Opportunity[];
  selectedOpportunityId?: string;
  buildPlan?: BuildPlanStep[];
  runtime?: Runtime;
  deployment?: Deployment;
  researchMetadata?: { sampleNote?: string; plannerQuestions: string[]; limitations: string[]; providerAvailability: string[] };
};

export type DiscoveryResponse = {
  matches: Business[];
  suggestion: string | null;
};

export type DiscoveryInput = {
  query: string;
  websiteUrl?: string;
  locationText?: string;
  coordinates?: GeoPoint;
  mode?: ResearchMode;
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
