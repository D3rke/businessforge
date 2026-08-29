import type { AgentDefinition, AgentTask, AgentTest, AssetPreview, BuildPlanStep, Business, Deployment, EvidenceItem, IntelligenceReport, Opportunity, Runtime, RuntimeEvent, Source } from './types.js';

const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local-business';

function demoSource(id: string, title: string, url: string, kind: Source['kind'], excerpt: string, evidence: string[]): Source {
  return {
    id,
    title,
    url,
    domain: 'demo.local',
    kind,
    sourceType: kind === 'website' ? 'official-website' : kind === 'search' ? 'search-result' : 'general-mention',
    excerpt,
    evidence,
    provenance: 'DEMO_DATA',
    availability: 'available',
    qualityScore: 35,
    relevanceScore: 70,
    entityConfidence: 78,
    entityDisposition: 'target'
  };
}

export function createJoeBusiness(): Business {
  const name = "Joe's Pizza";
  const websiteUrl = 'https://demo.local/joes-pizza';
  const sources: Source[] = [
    demoSource('src-site', "Joe's Pizza official site", websiteUrl, 'website', 'Family-owned pizza shop serving Brooklyn-style pies, slices, and catering.', ['Online ordering link is buried in navigation', 'No explicit lunch bundle or office catering lead capture']),
    demoSource('src-reviews', 'Recent customer reviews', 'https://demo.local/joes-pizza/reviews', 'review', 'Customers love speed and crust quality, but mention inconsistent discovery of specials and delivery zones.', ['Repeated praise for lunch slices', 'Confusion about daily specials appears in review excerpts']),
    demoSource('src-directory', 'Local business directory profile', 'https://demo.local/joes-pizza/listing', 'directory', 'Shows high foot traffic location near offices and schools.', ['Open late on Fridays', 'Dense lunchtime corridor within 0.8 miles']),
    demoSource('src-social', 'Instagram highlights', 'https://demo.local/joes-pizza/social', 'social', 'High engagement on limited-time pies and behind-the-scenes kitchen videos.', ['Special posts outperform baseline menu posts', 'Fans ask for preorder options in comments'])
  ];

  return {
    id: 'biz-joes-pizza',
    query: name,
    name,
    mode: 'BUSINESS',
    category: 'restaurant',
    city: 'Brooklyn, NY',
    description: 'Neighborhood pizza shop with strong product love, steady walk-in demand, and underdeveloped digital conversion.',
    researchBasis: 'demo',
    stage: 'candidate',
    discoveryScore: 98,
    websiteUrl,
    sources,
    identity: {
      name,
      normalizedName: 'joes pizza',
      mode: 'BUSINESS',
      city: 'Brooklyn',
      state: 'NY',
      websiteUrl,
      websiteDomain: 'demo.local',
      category: 'restaurant',
      listingIds: { demo: 'joes-pizza' }
    },
    researchMetadata: {
      plannerQuestions: ['What offer is visible?', 'How clear is the conversion path?', 'What proof is public?'],
      limitations: ['This seeded business is demo data.'],
      providerAvailability: ['live-search unavailable for seeded demo business']
    }
  };
}

function inferCategory(query: string) {
  const q = query.toLowerCase();
  if (/(pizza|restaurant|cafe|coffee|bakery|bar|grill|bistro|deli|mcdonald)/.test(q)) return 'restaurant';
  if (/(salon|spa|barber|beauty|nails|lash)/.test(q)) return 'beauty';
  if (/(gym|fitness|pilates|yoga|crossfit)/.test(q)) return 'fitness';
  if (/(dentist|dental|clinic|med|chiro|therapy)/.test(q)) return 'healthcare';
  if (/(plumber|roof|electric|cleaning|hvac|landscap)/.test(q)) return 'home-services';
  if (/(boutique|shop|store|florist|retail)/.test(q)) return 'retail';
  return 'local-service';
}

function inferCity(query: string) {
  const match = query.match(/\b(in|near|around)\s+([a-z][a-z\s,.]+)$/i);
  return match?.[2]?.trim().replace(/\s+/g, ' ') ?? 'Local market';
}

function categoryDescription(category: string) {
  const descriptions: Record<string, string> = {
    restaurant: 'Local food business with repeat demand, menu-led conversion, and strong review visibility.',
    beauty: 'Appointment-based business where trust, proof, and easy booking shape conversion.',
    fitness: 'Membership or class-driven business that depends on intent capture and retention nudges.',
    healthcare: 'Trust-sensitive practice where clarity, proof, and follow-up strongly influence lead conversion.',
    'home-services': 'Service business where response speed, estimate flow, and local trust signals drive revenue.',
    retail: 'Product business where merchandising, proof, and repeat promotion drive basket growth.',
    'local-service': 'Local business with demand capture, credibility, and follow-up opportunities.'
  };
  return descriptions[category] ?? descriptions['local-service'];
}

export function createFallbackBusiness(query: string, variant = 0, websiteUrl?: string): Business {
  const category = inferCategory(query);
  const city = inferCity(query);
  const baseName = titleCase((query || 'Local Business').replace(/\b(in|near|around)\s+[a-z][a-z\s,.]+$/i, '').trim() || 'Local Business');
  const name = [baseName, `${baseName} Collective`, `${baseName} Studio`][variant] ?? baseName;
  const id = `biz-${slug(name)}-${variant + 1}`;
  const source = demoSource(`src-${slug(name)}-site`, `${name} website snapshot`, websiteUrl ?? `https://demo.local/${slug(name)}`, 'website', `${titleCase(category.replace(/-/g, ' '))} website for ${name} in ${city}.`, ['Primary call-to-action exists but supporting proof is limited above the fold', 'This is fallback/demo-style content, not live retrieval.']);
  return {
    id,
    query,
    name,
    mode: 'BUSINESS',
    category,
    city,
    description: categoryDescription(category),
    websiteUrl,
    researchBasis: websiteUrl ? 'website' : 'synthetic',
    stage: 'candidate',
    discoveryScore: Math.max(63, 92 - variant * 11),
    sources: [source],
    identity: {
      name,
      normalizedName: slug(name).replace(/-/g, ' '),
      mode: 'BUSINESS',
      city,
      websiteUrl,
      websiteDomain: websiteUrl ? new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, '') : undefined,
      category,
      listingIds: { fallback: id }
    },
    researchMetadata: {
      plannerQuestions: ['What public offer is visible?', 'Is the next step clear?', 'What proof appears public?'],
      limitations: ['Live providers did not return a confident business match.'],
      providerAvailability: ['osm discovery returned no confident result']
    }
  };
}

export function createEvidenceItems(business: Business): EvidenceItem[] {
  return [
    {
      id: `ev-${business.id}-demo-conversion`,
      theme: 'conversion clarity',
      statement: `${business.name} likely loses intent because the next step is not packaged clearly enough on key channels.`,
      type: 'friction',
      sentiment: 'negative',
      strength: 'medium',
      sourceIds: business.sources.map((source) => source.id),
      implication: 'A cleaner conversion funnel is a strong first wedge.',
      confidence: 55,
      evidenceCount: business.sources.length,
      sourceDiversity: new Set(business.sources.map((source) => source.domain)).size,
      provenance: 'DEMO_DATA',
      supportingExcerpts: business.sources.map((source) => ({ sourceId: source.id, text: source.excerpt }))
    }
  ];
}

export function createReport(business: Business, evidenceItems: EvidenceItem[]): IntelligenceReport {
  return {
    summary: `${business.name} shows usable signals, but the clearest upside comes from packaging the next step more clearly for ${business.category.replace(/-/g, ' ')} buyers in ${business.city}.`,
    strengths: evidenceItems.filter((item) => item.sentiment === 'positive').map((item) => item.statement).slice(0, 3),
    gaps: evidenceItems.filter((item) => item.sentiment !== 'positive').map((item) => item.statement).slice(0, 3),
    marketSignals: evidenceItems.map((item) => item.implication).slice(0, 3),
    evidence: evidenceItems.map((item) => ({ claim: item.statement, sourceIds: item.sourceIds, evidenceIds: [item.id] })),
    keyThemes: [...new Set(evidenceItems.map((item) => item.theme))],
    methodology: ['Demo evidence was used because live retrieval was unavailable.'],
    limitations: business.researchMetadata?.limitations ?? ['Evidence is limited.']
  };
}

export function createOpportunities(business: Business, evidenceItems: EvidenceItem[]): Opportunity[] {
  return [
    {
      id: `opp-${business.id}-conversion`,
      title: business.category === 'restaurant' ? 'Launch an offer-led order conversion funnel' : 'Clarify the primary conversion path',
      impact: 72,
      confidence: 60,
      effort: 'medium',
      rationale: 'The visible next step appears weaker than the apparent buyer intent.',
      evidenceIds: evidenceItems.map((item) => item.id),
      capabilityNeeds: ['strategy', 'copywriting', 'operations'],
      category: 'conversion'
    }
  ];
}

export function createBuildPlan(opportunity: Opportunity, agents: AgentDefinition[]): BuildPlanStep[] {
  return agents.map((agent, index) => ({
    id: `plan-${index + 1}`,
    title: index === 0 ? `Frame ${opportunity.title.toLowerCase()}` : `Execute ${agent.role} workflow`,
    owner: agent.name,
    outcome: `${agent.outputs.join(', ')} ready for downstream use.`,
    status: index === 0 ? 'done' : index === 1 ? 'doing' : 'ready',
    evidenceIds: opportunity.evidenceIds
  }));
}

export function createAgentArchitecture(business: Business, opportunity: Opportunity, report: IntelligenceReport): AgentDefinition[] {
  return [
    { id: 'agent-strategist', name: 'Strategist Agent', role: 'market-analysis', goal: `Turn evidence themes into a focused thesis for ${opportunity.title.toLowerCase()}.`, inputs: ['research report', 'source evidence', 'selected opportunity'], outputs: ['offer brief', 'success metrics'], tools: ['report-synthesizer', 'evidence-linker'], dependsOn: [], capability: 'strategy' },
    { id: 'agent-growth', name: business.category === 'restaurant' ? 'Offer Agent' : 'Growth Agent', role: business.category === 'restaurant' ? 'offer-and-funnel' : 'copy-and-funnel', goal: 'Convert the winning thesis into landing copy, offer framing, and customer-facing calls to action.', inputs: ['offer brief', 'brand context'], outputs: ['landing copy', 'cta variants', 'form spec'], tools: ['copy-generator', 'cta-optimizer'], dependsOn: ['agent-strategist'], capability: 'copywriting' },
    { id: 'agent-ops', name: 'Operations Agent', role: business.category === 'restaurant' ? 'order-handoff' : 'lead-routing', goal: 'Route qualified demand into clear downstream actions for staff or systems.', inputs: ['form submissions', 'offer rules'], outputs: ['handoff workflow', 'staff actions'], tools: ['task-router', 'sla-checker'], dependsOn: ['agent-growth'], capability: 'operations' },
    { id: 'agent-qa', name: 'QA Agent', role: 'validation', goal: `Validate that ${report.keyThemes.join(', ')} are represented in the final workflow.`, inputs: ['generated assets', 'task graph'], outputs: ['test report', 'launch verdict'], tools: ['schema-checker', 'journey-smoke-test'], dependsOn: ['agent-ops'], capability: 'quality' }
  ];
}

export function createTasks(agents: AgentDefinition[], opportunity: Opportunity): AgentTask[] {
  return agents.map((agent, index) => ({
    id: `task-${index + 1}`,
    title: `Execute ${agent.role} workflow`,
    agentId: agent.id,
    status: index === 0 ? 'done' : index === 1 ? 'running' : 'queued',
    notes: index === 0 ? 'Evidence-linked thesis published.' : index === 1 ? `Working on ${opportunity.title.toLowerCase()}.` : 'Waiting on upstream handoff.',
    evidenceIds: opportunity.evidenceIds
  }));
}

export function createTests(runtime: Runtime): AgentTest[] {
  return [
    { id: 'test-evidence', name: 'Evidence traceability', status: 'pass', details: `${runtime.tasks.length} task outputs trace back to linked opportunity evidence.` },
    { id: 'test-agent-coverage', name: 'Capability coverage', status: runtime.missingCapabilities.length ? 'warn' : 'pass', details: runtime.missingCapabilities.length ? `Missing runtime capabilities: ${runtime.missingCapabilities.join(', ')}.` : 'Runtime capabilities cover selected opportunity needs.' },
    { id: 'test-handoff', name: 'Task handoff readiness', status: 'warn', details: 'External execution remains bounded, but internal handoffs and build events are real.' }
  ];
}

export function createAssetPreview(business: Business, opportunity: Opportunity): AssetPreview {
  return {
    type: 'landing-copy',
    headline: business.category === 'restaurant' ? `Turn neighborhood demand into higher-value orders for ${business.name}` : `Make it easy to choose ${business.name} with confidence`,
    subheadline: 'Use evidence-backed messaging and a simpler conversion path to capture more real demand.',
    cta: opportunity.category === 'operations' ? 'Review the handoff plan' : business.category === 'restaurant' ? 'See the offer' : 'Request availability',
    bullets: [`Built around ${opportunity.title.toLowerCase()}`, `References ${opportunity.evidenceIds.length} linked evidence signals`, `Supports ${business.category.replace(/-/g, ' ')} conversion in ${business.city}`]
  };
}

export function createDeployment(): Deployment {
  const now = new Date();
  return {
    id: `dep-${nowId()}`,
    state: 'validating',
    history: [
      { at: new Date(now.getTime() - 4 * 60_000).toISOString(), state: 'draft', note: 'Opportunity selected and architecture generated.' },
      { at: new Date(now.getTime() - 2 * 60_000).toISOString(), state: 'validating', note: 'Evidence-linked tasks and checks prepared.' }
    ],
    honestStatus: 'Deployment is abstract until a bounded build run produces validated artifacts.'
  };
}

export function createInitialEvents(agents: AgentDefinition[], opportunity: Opportunity): RuntimeEvent[] {
  return [
    { id: `evt-${nowId()}`, at: new Date(Date.now() - 90_000).toISOString(), type: 'system', actor: 'system', text: 'Research evidence normalized into structured findings.' },
    { id: `evt-${nowId()}`, at: new Date(Date.now() - 60_000).toISOString(), type: 'handoff', actor: agents[0]?.id ?? 'system', text: `Selected opportunity mapped into ${agents.length} agent roles for ${opportunity.title.toLowerCase()}.` }
  ];
}

export function createRuntime(business: Business, opportunity: Opportunity, report: IntelligenceReport): Runtime {
  const agents = createAgentArchitecture(business, opportunity, report);
  const runtime: Runtime = {
    status: 'executing',
    agents,
    tasks: createTasks(agents, opportunity),
    tests: [],
    assetPreview: createAssetPreview(business, opportunity),
    eventLog: createInitialEvents(agents, opportunity),
    interactions: [],
    missingCapabilities: [],
    buildRuns: []
  };
  runtime.tests = createTests(runtime);
  return runtime;
}
