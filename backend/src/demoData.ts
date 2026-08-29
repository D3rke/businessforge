import type {
  AgentDefinition,
  AgentTask,
  AgentTest,
  AssetPreview,
  BuildPlanStep,
  Business,
  Deployment,
  EvidenceItem,
  IntelligenceReport,
  Opportunity,
  Runtime,
  RuntimeEvent,
  Source
} from './types.js';

const nowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());

export const joeSources: Source[] = [
  {
    id: 'src-site',
    title: "Joe's Pizza official site",
    url: 'https://demo.local/joes-pizza',
    kind: 'website',
    excerpt: 'Family-owned pizza shop serving Brooklyn-style pies, slices, and catering.',
    evidence: ['Online ordering link is buried in navigation', 'No explicit lunch bundle or office catering lead capture']
  },
  {
    id: 'src-reviews',
    title: 'Recent customer reviews',
    url: 'https://demo.local/joes-pizza/reviews',
    kind: 'review',
    excerpt: 'Customers love speed and crust quality, but mention inconsistent discovery of specials and delivery zones.',
    evidence: ['Repeated praise for lunch slices', 'Confusion about daily specials appears in 3 review excerpts']
  },
  {
    id: 'src-directory',
    title: 'Local business directory profile',
    url: 'https://demo.local/joes-pizza/listing',
    kind: 'directory',
    excerpt: 'Shows high foot traffic location near offices and schools.',
    evidence: ['Open late on Fridays', 'Dense lunchtime corridor within 0.8 miles']
  },
  {
    id: 'src-social',
    title: 'Instagram highlights',
    url: 'https://demo.local/joes-pizza/social',
    kind: 'social',
    excerpt: 'High engagement on limited-time pies and behind-the-scenes kitchen videos.',
    evidence: ['Special posts outperform baseline menu posts', 'Fans ask for preorder options in comments']
  }
];

export function createJoeBusiness(): Business {
  return {
    id: 'biz-joes-pizza',
    query: "Joe's Pizza",
    name: "Joe's Pizza",
    category: 'restaurant',
    city: 'Brooklyn, NY',
    description: 'Neighborhood pizza shop with strong product love, steady walk-in demand, and underdeveloped digital conversion.',
    researchBasis: 'demo',
    stage: 'candidate',
    discoveryScore: 98,
    sources: joeSources
  };
}

function sanitizeQuery(query: string) {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local-business';
}

function inferCategory(query: string) {
  const q = query.toLowerCase();
  if (/(pizza|restaurant|cafe|coffee|bakery|bar|grill|bistro|deli)/.test(q)) return 'restaurant';
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

function buildGenericSources(name: string, category: string, city: string, websiteUrl?: string): Source[] {
  const base = sanitizeQuery(name);
  const categoryLabel = category.replace(/-/g, ' ');
  return [
    {
      id: `src-${base}-site`,
      title: websiteUrl ? `${name} provided website` : `${name} website snapshot`,
      url: websiteUrl ?? `https://demo.local/${base}`,
      kind: 'website',
      excerpt: websiteUrl ? `Provided website for ${name}. BusinessForge will try to fetch accessible public pages from this domain.` : `${titleCase(categoryLabel)} website for ${name} in ${city}.`,
      evidence: [
        websiteUrl ? 'Public website provided for live research' : 'Primary call-to-action exists but supporting proof is limited above the fold',
        websiteUrl ? 'If the site is reachable, BusinessForge can ground evidence in real page content' : 'Core offer is visible, but urgency and conversion path are not tightly packaged'
      ]
    },
    {
      id: `src-${base}-reviews`,
      title: `${name} review themes`,
      url: `https://demo.local/${base}/reviews`,
      kind: 'review',
      excerpt: `Recurring themes from customer feedback around ${name}.`,
      evidence: [
        'Positive quality mentions suggest a reliable core offer',
        'At least one recurring friction point appears around booking, ordering, or response clarity'
      ]
    },
    {
      id: `src-${base}-directory`,
      title: `${name} local listing footprint`,
      url: `https://demo.local/${base}/listing`,
      kind: 'directory',
      excerpt: `Directory-style market context for ${name} in ${city}.`,
      evidence: [
        `Local intent exists for ${categoryLabel} searches in ${city}`,
        'Hours, service area, or offer details could be packaged more clearly'
      ]
    },
    {
      id: `src-${base}-social`,
      title: `${name} social engagement snapshot`,
      url: `https://demo.local/${base}/social`,
      kind: 'social',
      excerpt: `Social content patterns associated with ${name}.`,
      evidence: [
        'Educational or behind-the-scenes content outperforms plain announcements',
        'Audience responses hint at demand for a more guided next step'
      ]
    }
  ];
}

export function createFallbackBusiness(query: string, variant = 0, websiteUrl?: string): Business {
  const category = inferCategory(query);
  const city = inferCity(query);
  const normalized = query.trim() || 'Local Business';
  const cleanName = normalized.replace(/\b(in|near|around)\s+[a-z][a-z\s,.]+$/i, '').trim() || normalized;
  const displayName = titleCase(cleanName);
  const names = [
    displayName,
    `${displayName} Collective`,
    `${displayName} Studio`
  ];
  const name = names[variant] ?? names[0];

  return {
    id: `biz-${sanitizeQuery(name)}-${variant + 1}`,
    query,
    name,
    category,
    city,
    description: categoryDescription(category),
    websiteUrl,
    researchBasis: websiteUrl ? 'website' : 'synthetic',
    stage: 'candidate',
    discoveryScore: Math.max(63, 92 - variant * 11),
    sources: buildGenericSources(name, category, city, websiteUrl)
  };
}

export function createEvidenceItems(business: Business): EvidenceItem[] {
  if (business.id === 'biz-joes-pizza') {
    return [
      {
        id: 'ev-lunch-demand',
        theme: 'weekday demand capture',
        statement: 'Lunch demand is strong, but the digital path does not package it into a clear office-ready offer.',
        type: 'demand',
        sentiment: 'mixed',
        strength: 'high',
        sourceIds: ['src-reviews', 'src-directory', 'src-site'],
        implication: 'A guided lunch bundle flow can increase weekday conversion.'
      },
      {
        id: 'ev-specials-proof',
        theme: 'promotion resonance',
        statement: 'Special-menu content already triggers above-baseline engagement and direct preorder intent.',
        type: 'proof',
        sentiment: 'positive',
        strength: 'high',
        sourceIds: ['src-social'],
        implication: 'Specials can support automated campaigns tied to preorder capture.'
      },
      {
        id: 'ev-discovery-friction',
        theme: 'conversion friction',
        statement: 'Ordering, specials, and delivery details are harder to find than they should be.',
        type: 'friction',
        sentiment: 'negative',
        strength: 'high',
        sourceIds: ['src-site', 'src-reviews'],
        implication: 'Clarifying the conversion path should improve intent completion.'
      }
    ];
  }

  const category = business.category;
  const isService = ['beauty', 'fitness', 'healthcare', 'home-services', 'local-service'].includes(category);
  const isRestaurant = category === 'restaurant';
  const isRetail = category === 'retail';

  return [
    {
      id: `ev-${business.id}-offer-proof`,
      theme: 'core offer quality',
      statement: `${business.name} appears to have a credible core offer with positive feedback around quality or reliability.`,
      type: 'proof',
      sentiment: 'positive',
      strength: 'medium',
      sourceIds: [business.sources[1]?.id, business.sources[3]?.id].filter(Boolean) as string[],
      implication: 'Traffic improvements should compound rather than patch a broken offer.'
    },
    {
      id: `ev-${business.id}-conversion-friction`,
      theme: 'conversion clarity',
      statement: `${business.name} likely loses intent because the next step is not packaged clearly enough on key channels.`,
      type: 'friction',
      sentiment: 'negative',
      strength: 'high',
      sourceIds: [business.sources[0]?.id, business.sources[2]?.id].filter(Boolean) as string[],
      implication: 'A cleaner conversion funnel is a strong first wedge.'
    },
    {
      id: `ev-${business.id}-audience-pattern`,
      theme: isService ? 'trust and follow-up' : isRestaurant ? 'repeat local demand' : isRetail ? 'merchandising response' : 'local demand capture',
      statement: isService
        ? 'Prospects need stronger proof, responsiveness, and follow-up to convert with confidence.'
        : isRestaurant
          ? 'Local demand exists, and timed offers could convert more of it into repeat orders.'
          : isRetail
            ? 'Audience engagement suggests room for offer packaging and repeat promotion.'
            : 'Local demand exists, but the business could route it into a more guided workflow.',
      type: isService ? 'audience' : 'demand',
      sentiment: 'mixed',
      strength: 'medium',
      sourceIds: business.sources.map((source) => source.id).slice(1, 4),
      implication: isService
        ? 'Booking or estimate workflows should reduce hesitation and improve handoff speed.'
        : 'Offer-led campaigns can convert ambient intent into measurable actions.'
    }
  ];
}

export function createReport(business: Business, evidenceItems: EvidenceItem[]): IntelligenceReport {
  const strengths = evidenceItems.filter((item) => item.sentiment === 'positive' || item.type === 'proof').map((item) => item.statement);
  const gaps = evidenceItems.filter((item) => item.sentiment === 'negative' || item.type === 'friction').map((item) => item.statement);
  const marketSignals = evidenceItems.filter((item) => ['demand', 'audience', 'offer'].includes(item.type)).map((item) => item.implication);
  return {
    summary: `${business.name} shows usable demand and proof signals, but the clearest upside comes from packaging the next step more clearly for ${business.category.replace(/-/g, ' ')} buyers in ${business.city}.`,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    marketSignals: marketSignals.slice(0, 3),
    evidence: evidenceItems.map((item) => ({ claim: item.statement, sourceIds: item.sourceIds, evidenceIds: [item.id] })),
    keyThemes: [...new Set(evidenceItems.map((item) => item.theme))]
  };
}

export function createOpportunities(business: Business, evidenceItems: EvidenceItem[]): Opportunity[] {
  const hasFriction = evidenceItems.some((item) => item.type === 'friction');
  const hasDemand = evidenceItems.some((item) => item.type === 'demand');
  const hasProof = evidenceItems.some((item) => item.type === 'proof');
  const isService = ['beauty', 'fitness', 'healthcare', 'home-services', 'local-service'].includes(business.category);
  const isRestaurant = business.category === 'restaurant';

  const opportunities: Opportunity[] = [];

  if (hasFriction) {
    opportunities.push({
      id: `opp-${business.id}-conversion`,
      title: isService ? 'Launch a guided booking and follow-up funnel' : isRestaurant ? 'Launch an offer-led order conversion funnel' : 'Clarify the primary conversion path',
      impact: isService ? 88 : 84,
      confidence: 82,
      effort: 'medium',
      rationale: 'Evidence points to real intent, but buyers are not being routed into a simple, confident next step.',
      evidenceIds: evidenceItems.filter((item) => item.type === 'friction' || item.type === 'demand').map((item) => item.id),
      capabilityNeeds: ['strategy', 'copywriting', isService ? 'crm-handoff' : 'checkout-handoff'],
      category: 'conversion'
    });
  }

  if (hasDemand || hasProof) {
    opportunities.push({
      id: `opp-${business.id}-campaign`,
      title: isRestaurant ? 'Automate timed promotions around peak demand windows' : 'Build a repeatable campaign loop from proven demand signals',
      impact: 76,
      confidence: hasProof ? 80 : 71,
      effort: 'low',
      rationale: 'Existing proof signals suggest a lightweight promotion system can turn periodic attention into measurable action.',
      evidenceIds: evidenceItems.filter((item) => item.type === 'proof' || item.type === 'demand').map((item) => item.id),
      capabilityNeeds: ['campaigns', 'copywriting'],
      category: 'acquisition'
    });
  }

  opportunities.push({
    id: `opp-${business.id}-ops`,
    title: isService ? 'Tighten lead response and staff handoff operations' : 'Improve fulfillment visibility and post-conversion handoff',
    impact: 68,
    confidence: 78,
    effort: 'low',
    rationale: 'Operational clarity usually compounds growth changes and reduces dropped demand.',
    evidenceIds: evidenceItems.map((item) => item.id).slice(0, 2),
    capabilityNeeds: ['operations'],
    category: 'operations'
  });

  return opportunities;
}

export function createBuildPlan(opportunity: Opportunity, agents: AgentDefinition): BuildPlanStep[];
export function createBuildPlan(opportunity: Opportunity, agents: AgentDefinition[]): BuildPlanStep[];
export function createBuildPlan(opportunity: Opportunity, agents: AgentDefinition | AgentDefinition[]): BuildPlanStep[] {
  const list = Array.isArray(agents) ? agents : [agents];
  return list.map((agent, index) => ({
    id: `plan-${index + 1}`,
    title: index === 0 ? `Frame ${opportunity.title.toLowerCase()}` : `Execute ${agent.role} workflow`,
    owner: agent.name,
    outcome: `${agent.outputs.join(', ')} ready for downstream use.`,
    status: index === 0 ? 'done' : index === 1 ? 'doing' : 'ready',
    evidenceIds: opportunity.evidenceIds
  }));
}

export function createAgentArchitecture(business: Business, opportunity: Opportunity, report: IntelligenceReport): AgentDefinition[] {
  const agents: AgentDefinition[] = [
    {
      id: 'agent-strategist',
      name: 'Strategist Agent',
      role: 'market-analysis',
      goal: `Turn evidence themes into a focused thesis for ${opportunity.title.toLowerCase()}.`,
      inputs: ['research report', 'source evidence', 'selected opportunity'],
      outputs: ['offer brief', 'success metrics'],
      tools: ['report-synthesizer', 'evidence-linker'],
      dependsOn: [],
      capability: 'strategy'
    }
  ];

  if (opportunity.capabilityNeeds.includes('copywriting')) {
    agents.push({
      id: 'agent-growth',
      name: business.category === 'restaurant' ? 'Offer Agent' : 'Growth Agent',
      role: business.category === 'restaurant' ? 'offer-and-funnel' : 'copy-and-funnel',
      goal: 'Convert the winning thesis into landing copy, offer framing, and customer-facing calls to action.',
      inputs: ['offer brief', 'brand context'],
      outputs: ['landing copy', 'cta variants', 'form spec'],
      tools: ['copy-generator', 'cta-optimizer'],
      dependsOn: ['agent-strategist'],
      capability: 'copywriting'
    });
  }

  if (opportunity.capabilityNeeds.includes('campaigns')) {
    agents.push({
      id: 'agent-campaign',
      name: 'Campaign Agent',
      role: 'promotion-orchestration',
      goal: 'Turn demand signals into scheduled campaigns and response loops.',
      inputs: ['offer brief', 'signal themes'],
      outputs: ['campaign plan', 'timing recommendations'],
      tools: ['schedule-builder', 'segment-selector'],
      dependsOn: ['agent-strategist'],
      capability: 'campaigns'
    });
  }

  if (opportunity.capabilityNeeds.includes('crm-handoff') || opportunity.capabilityNeeds.includes('checkout-handoff') || opportunity.capabilityNeeds.includes('operations')) {
    agents.push({
      id: 'agent-ops',
      name: 'Operations Agent',
      role: business.category === 'restaurant' ? 'order-handoff' : 'lead-routing',
      goal: 'Route qualified demand into clear downstream actions for staff or systems.',
      inputs: ['form submissions', 'offer rules'],
      outputs: ['handoff workflow', 'staff actions'],
      tools: ['task-router', 'sla-checker'],
      dependsOn: agents.some((agent) => agent.id === 'agent-growth') ? ['agent-growth'] : ['agent-strategist'],
      capability: opportunity.capabilityNeeds.includes('crm-handoff') ? 'crm-handoff' : 'operations'
    });
  }

  agents.push({
    id: 'agent-qa',
    name: 'QA Agent',
    role: 'validation',
    goal: `Validate that ${report.keyThemes.join(', ')} are represented in the final workflow.`,
    inputs: ['generated assets', 'task graph'],
    outputs: ['test report', 'launch verdict'],
    tools: ['schema-checker', 'journey-smoke-test'],
    dependsOn: agents.filter((agent) => agent.id !== 'agent-qa').slice(-1).map((agent) => agent.id),
    capability: 'quality'
  });

  return agents;
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
    {
      id: 'test-evidence',
      name: 'Evidence traceability',
      status: 'pass',
      details: `${runtime.tasks.length} task outputs trace back to linked opportunity evidence.`
    },
    {
      id: 'test-agent-coverage',
      name: 'Capability coverage',
      status: runtime.missingCapabilities.length ? 'warn' : 'pass',
      details: runtime.missingCapabilities.length ? `Missing runtime capabilities: ${runtime.missingCapabilities.join(', ')}.` : 'Runtime capabilities cover selected opportunity needs.'
    },
    {
      id: 'test-handoff',
      name: 'Task handoff readiness',
      status: 'warn',
      details: 'External execution remains simulated, but the runtime now performs internal handoffs and event emission.'
    }
  ];
}

export function createAssetPreview(business: Business, opportunity: Opportunity): AssetPreview {
  const serviceMode = ['beauty', 'fitness', 'healthcare', 'home-services', 'local-service'].includes(business.category);
  const restaurantMode = business.category === 'restaurant';
  return {
    type: 'landing-copy',
    headline: serviceMode
      ? `Make it easy to book ${business.name} with confidence`
      : restaurantMode
        ? `Turn neighborhood demand into higher-value orders for ${business.name}`
        : `Package the clearest next step for ${business.name}`,
    subheadline: serviceMode
      ? 'Lead with trust signals, a clearer booking path, and fast follow-up for ready buyers.'
      : restaurantMode
        ? 'Highlight the winning offer, remove ordering friction, and route demand into a repeatable workflow.'
        : 'Use evidence-backed messaging and a simpler conversion path to capture more local intent.',
    cta: opportunity.category === 'operations' ? 'Review the handoff plan' : serviceMode ? 'Request availability' : 'See the offer',
    bullets: [
      `Built around ${opportunity.title.toLowerCase()}`,
      `References ${opportunity.evidenceIds.length} linked evidence signals`,
      `Supports ${business.category.replace(/-/g, ' ')} conversion in ${business.city}`
    ]
  };
}

export function createDeployment(): Deployment {
  const now = new Date();
  return {
    id: `dep-${nowId()}`,
    state: 'deploying',
    history: [
      { at: new Date(now.getTime() - 4 * 60_000).toISOString(), state: 'draft', note: 'Opportunity selected and architecture generated.' },
      { at: new Date(now.getTime() - 2 * 60_000).toISOString(), state: 'validating', note: 'Evidence-linked tasks and tests prepared.' },
      { at: new Date(now.getTime() - 30_000).toISOString(), state: 'deploying', note: 'Runtime graph published to the live workspace.' }
    ]
  };
}

export function createInitialEvents(agents: AgentDefinition[], opportunity: Opportunity): RuntimeEvent[] {
  return [
    { id: `evt-${nowId()}`, at: new Date(Date.now() - 90_000).toISOString(), type: 'system', actor: 'system', text: 'Research evidence normalized into structured findings.' },
    { id: `evt-${nowId()}`, at: new Date(Date.now() - 60_000).toISOString(), type: 'handoff', actor: agents[0]?.id ?? 'system', text: `Selected opportunity mapped into ${agents.length} agent roles for ${opportunity.title.toLowerCase()}.` },
    { id: `evt-${nowId()}`, at: new Date(Date.now() - 15_000).toISOString(), type: 'task-update', actor: agents[1]?.id ?? 'system', text: 'Primary execution task is in progress.', taskId: 'task-2' }
  ];
}

export function createRuntime(business: Business, opportunity: Opportunity, report: IntelligenceReport): Runtime {
  const agents = createAgentArchitecture(business, opportunity, report);
  const missingCapabilities = opportunity.capabilityNeeds.filter((need) => !agents.some((agent) => agent.capability === need));
  const runtime: Runtime = {
    status: 'executing',
    agents,
    tasks: createTasks(agents, opportunity),
    tests: [],
    assetPreview: createAssetPreview(business, opportunity),
    eventLog: createInitialEvents(agents, opportunity),
    interactions: [],
    missingCapabilities
  };
  runtime.tests = createTests(runtime);
  return runtime;
}
