export type ResearchMode = 'BUSINESS' | 'CORPORATION';
export type Provenance = 'REAL_RETRIEVED' | 'DEMO_DATA' | 'LLM_INFERENCE' | 'UNAVAILABLE';
export type SourceKind = 'website' | 'review' | 'directory' | 'social' | 'search' | 'menu' | 'operations' | 'knowledge' | 'news' | 'forum';
export type SourceType = 'official-website' | 'official-about' | 'official-menu' | 'official-contact' | 'official-newsroom' | 'official-investor' | 'directory-listing' | 'map-listing' | 'knowledge-base' | 'search-result' | 'general-mention' | 'competitor-mention';
export type EvidenceStrength = 'low' | 'medium' | 'high';
export type EvidenceSentiment = 'positive' | 'negative' | 'mixed' | 'neutral';
export type FindingType = 'demand' | 'friction' | 'offer' | 'operations' | 'proof' | 'audience';
export type ResearchEventType = 'BUSINESS_IDENTIFIED' | 'WEBSITE_RESOLVED' | 'QUERY_EXECUTED' | 'RESULT_DISCOVERED' | 'PAGE_FETCHED' | 'PAGE_BLOCKED' | 'SOURCE_REJECTED' | 'EVIDENCE_EXTRACTED' | 'RESEARCH_COMPLETE';
export type BuildEventType = 'BUILD_QUEUED' | 'BUILD_STARTED' | 'TASK_STARTED' | 'FILE_CREATED' | 'FILE_UPDATED' | 'TEST_STARTED' | 'TEST_PASSED' | 'TEST_FAILED' | 'DEPLOYMENT_STARTED' | 'DEPLOYMENT_COMPLETE' | 'BUILD_COMPLETE';

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

export type SearchResultMeta = {
  provider: string;
  distanceMeters?: number;
  phone?: string;
  hours?: string[];
  websiteUrl?: string;
  rating?: number;
  reviewCount?: number;
  categories: string[];
  locationLabel?: string;
};

export type SourceExcerpt = {
  text: string;
  evidenceRole: 'identity' | 'offer' | 'proof' | 'friction' | 'operations' | 'general';
};

export type ResearchEvent = {
  id: string;
  at: string;
  type: ResearchEventType;
  text: string;
  detail?: string;
  query?: string;
  sourceId?: string;
  sourceUrl?: string;
  count?: number;
};

export type Source = {
  id: string;
  title: string;
  url: string;
  domain: string;
  originalUrl?: string;
  retrievalUrl?: string;
  kind: SourceKind;
  sourceType: SourceType;
  sourceFamily?: string;
  excerpt: string;
  evidence: string[];
  content?: string;
  excerpts?: SourceExcerpt[];
  retrievedAt?: string;
  provenance: Provenance;
  availability: 'available' | 'snippet-only' | 'blocked' | 'unavailable';
  qualityScore: number;
  relevanceScore: number;
  entityConfidence: number;
  entityDisposition: 'target' | 'general' | 'competitor' | 'rejected';
  dates?: string[];
  notes?: string[];
  contentAvailability?: 'full' | 'snippet' | 'blocked' | 'none';
  businessMatchReason?: string[];
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
  confidence: number;
  evidenceCount: number;
  sourceDiversity: number;
  provenance: Provenance;
  supportingExcerpts: Array<{ sourceId: string; text: string }>;
  firstObservedAt?: string;
  lastObservedAt?: string;
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
  methodology: string[];
  limitations: string[];
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

export type BuildArtifact = {
  path: string;
  kind: 'json' | 'md' | 'html' | 'css' | 'js';
  description: string;
  sizeBytes?: number;
};

export type BuildFile = {
  path: string;
  name: string;
  kind: 'file';
  sizeBytes: number;
};

export type BuildRun = {
  id: string;
  opportunityId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  startedAt: string;
  completedAt?: string;
  workspaceDir: string;
  previewUrl?: string;
  events: BuildEvent[];
  artifacts: BuildArtifact[];
  files: BuildFile[];
  validations: AgentTest[];
  deploymentStatus: 'not-started' | 'in-progress' | 'complete';
  repairNotes: string[];
};

export type BuildEvent = {
  id: string;
  at: string;
  type: BuildEventType;
  text: string;
  taskId?: string;
  filePath?: string;
  testName?: string;
};

export type Deployment = {
  id: string;
  state: 'draft' | 'validating' | 'deploying' | 'live';
  history: { at: string; state: string; note: string }[];
  honestStatus: string;
  previewUrl?: string;
};

export type AssetPreview = {
  type: 'landing-copy';
  headline: string;
  subheadline: string;
  cta: string;
  bullets: string[];
};

export type RuntimeEventType = 'task-update' | 'handoff' | 'interaction' | 'capability-request' | 'system' | 'build-event';

export type RuntimeEvent = {
  id: string;
  at: string;
  type: RuntimeEventType;
  actor: string;
  text: string;
  taskId?: string;
  capability?: string;
  buildEventType?: BuildEventType;
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
  buildRuns: BuildRun[];
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
  phone?: string;
  hours?: string[];
  latitude?: number;
  longitude?: number;
  discoveryProvider?: string;
  researchBasis?: 'demo' | 'synthetic' | 'website' | 'provider' | 'hybrid';
  stage: 'candidate' | 'researched';
  discoveryScore: number;
  searchMeta?: SearchResultMeta;
  sources: Source[];
  identity: BusinessIdentity;
  evidenceItems?: EvidenceItem[];
  report?: IntelligenceReport;
  opportunities?: Opportunity[];
  selectedOpportunityId?: string;
  buildPlan?: BuildPlanStep[];
  runtime?: Runtime;
  deployment?: Deployment;
  researchEvents?: ResearchEvent[];
  researchMetadata?: {
    sampleNote?: string;
    plannerQuestions: string[];
    limitations: string[];
    providerAvailability: string[];
  };
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
