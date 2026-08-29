import type { AgentDefinition, AgentTask, AgentTest, AssetPreview, BuildPlanStep, Business, Deployment, IntelligenceReport, Opportunity, Runtime, Source } from './types.js';

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

export function createBusiness(): Business {
  return {
    id: 'biz-joes-pizza',
    name: "Joe's Pizza",
    category: 'Restaurant',
    city: 'Brooklyn, NY',
    description: 'Neighborhood pizza shop with strong product love, steady walk-in demand, and underdeveloped digital conversion.',
    sources: joeSources
  };
}

export function createReport(): IntelligenceReport {
  return {
    summary: "Joe's Pizza has authentic product-market fit offline, but its digital funnel under-monetizes strong local demand. The clearest win is packaging lunch and catering intent into a guided conversion path.",
    strengths: ['Strong review sentiment on product quality', 'High local density of offices and schools', 'Engaging special-menu content already resonates on social'],
    gaps: ['Ordering and specials are hard to discover', 'No structured office catering capture', 'No reusable campaign or follow-up motion for limited-time pies'],
    marketSignals: ['Lunch buyers want fast bundles', 'Office managers ask for preorder/catering clarity', 'Special announcements spike engagement'],
    evidence: [
      { claim: 'Lunch demand exists and is time-sensitive.', sourceIds: ['src-reviews', 'src-directory'] },
      { claim: 'Special-menu promotions already create demand without a formal funnel.', sourceIds: ['src-social'] },
      { claim: 'Site structure likely suppresses online conversion.', sourceIds: ['src-site', 'src-reviews'] }
    ]
  };
}

export function createOpportunities(): Opportunity[] {
  return [
    {
      id: 'opp-lunch-funnel',
      title: 'Launch a lunch bundle and catering conversion funnel',
      impact: 92,
      confidence: 87,
      effort: 'medium',
      rationale: 'Matches office corridor demand, improves digital discoverability, and creates repeatable weekday revenue.'
    },
    {
      id: 'opp-specials-bot',
      title: 'Automate limited-time pie announcements and preorder capture',
      impact: 78,
      confidence: 81,
      effort: 'low',
      rationale: 'Social proof already exists, and an automated campaign loop could monetize spikes in interest.'
    },
    {
      id: 'opp-zone-clarity',
      title: 'Clarify delivery zones and order expectations',
      impact: 64,
      confidence: 90,
      effort: 'low',
      rationale: 'Removes friction called out in reviews, but revenue upside is smaller than a new funnel.'
    }
  ];
}

export function createBuildPlan(opportunity: Opportunity): BuildPlanStep[] {
  return [
    {
      id: 'plan-1',
      title: `Define ${opportunity.title.toLowerCase()} offer structure`,
      owner: 'Strategist Agent',
      outcome: 'Bundle definition, pricing hypothesis, and target audience rubric',
      status: 'done'
    },
    {
      id: 'plan-2',
      title: 'Produce landing page copy and lead form schema',
      owner: 'Growth Agent',
      outcome: 'Conversion-focused copy and captured lead fields',
      status: 'doing'
    },
    {
      id: 'plan-3',
      title: 'Wire fulfillment and outreach follow-up',
      owner: 'Operations Agent',
      outcome: 'Task routing for catering requests and daily special follow-up',
      status: 'ready'
    },
    {
      id: 'plan-4',
      title: 'Validate agent workflows against guardrail tests',
      owner: 'QA Agent',
      outcome: 'Passing smoke coverage for data flow, copy quality, and deployment readiness',
      status: 'todo'
    }
  ];
}

export function createAgentArchitecture(opportunity: Opportunity, report: IntelligenceReport): AgentDefinition[] {
  const needsCatering = /catering|lunch/i.test(opportunity.title + ' ' + opportunity.rationale + ' ' + report.summary);
  const needsCampaign = /special|promotion|campaign|announcement/i.test(opportunity.title + ' ' + report.summary);

  const agents: AgentDefinition[] = [
    {
      id: 'agent-strategist',
      name: 'Strategist Agent',
      role: 'market-analysis',
      goal: `Translate evidence into a focused go-to-market thesis for ${opportunity.title.toLowerCase()}.`,
      inputs: ['research report', 'source evidence', 'selected opportunity'],
      outputs: ['offer brief', 'success metrics'],
      tools: ['report-synthesizer', 'evidence-linker'],
      dependsOn: []
    },
    {
      id: 'agent-growth',
      name: 'Growth Agent',
      role: 'copy-and-funnel',
      goal: 'Generate the customer-facing assets that convert demand into orders or leads.',
      inputs: ['offer brief', 'brand context'],
      outputs: ['landing copy', 'CTA variants', 'form spec'],
      tools: ['copy-generator', 'cta-optimizer'],
      dependsOn: ['agent-strategist']
    },
    {
      id: 'agent-qa',
      name: 'QA Agent',
      role: 'validation',
      goal: 'Check that evidence, copy, and workflow outputs are complete and safe to launch.',
      inputs: ['generated assets', 'task graph'],
      outputs: ['test report', 'launch verdict'],
      tools: ['schema-checker', 'journey-smoke-test'],
      dependsOn: ['agent-growth']
    }
  ];

  if (needsCatering) {
    agents.splice(2, 0, {
      id: 'agent-ops',
      name: 'Operations Agent',
      role: 'fulfillment-routing',
      goal: 'Convert inbound orders or leads into trackable staff actions.',
      inputs: ['qualified form submissions', 'offer rules'],
      outputs: ['staff tasks', 'handoff confirmations'],
      tools: ['task-router', 'sla-checker'],
      dependsOn: ['agent-growth']
    });
  }

  if (needsCampaign) {
    agents.splice(2, 0, {
      id: 'agent-campaign',
      name: 'Campaign Agent',
      role: 'promo-orchestration',
      goal: 'Repurpose demand signals into recurring promotional sends.',
      inputs: ['special schedule', 'engagement history'],
      outputs: ['campaign draft', 'send recommendations'],
      tools: ['schedule-builder', 'segment-selector'],
      dependsOn: ['agent-strategist']
    });
  }

  return agents;
}

export function createTasks(agents: AgentDefinition[]): AgentTask[] {
  return agents.map((agent, index) => ({
    id: `task-${index + 1}`,
    title: `Execute ${agent.role} workflow`,
    agentId: agent.id,
    status: index === 0 ? 'done' : index === 1 ? 'running' : 'queued',
    notes: index === 0 ? 'Offer brief published with linked evidence.' : index === 1 ? 'Drafting customer-facing landing copy.' : 'Waiting on upstream outputs.'
  }));
}

export function createTests(): AgentTest[] {
  return [
    { id: 'test-evidence', name: 'Evidence traceability', status: 'pass', details: 'All report claims link back to at least one source.' },
    { id: 'test-copy', name: 'Copy quality smoke test', status: 'pass', details: 'Headline, CTA, and benefits are populated.' },
    { id: 'test-handoff', name: 'Task handoff readiness', status: 'warn', details: 'Staff notification channel is simulated in demo mode.' }
  ];
}

export function createAssetPreview(opportunity: Opportunity): AssetPreview {
  const lunchMode = /lunch|catering/i.test(opportunity.title);
  return {
    type: 'landing-copy',
    headline: lunchMode ? 'Feed the office with Brooklyn pizza that actually gets finished' : 'Catch every special-order spike before it cools off',
    subheadline: lunchMode ? 'Fast lunch bundles and simple catering pickup for busy teams around Joe\'s Pizza.' : 'Turn limited-time pie buzz into measurable preorders and repeat visits.',
    cta: lunchMode ? 'Request today\'s lunch plan' : 'Reserve the next special pie drop',
    bullets: lunchMode
      ? ['Office-ready bundles in a few clicks', 'Pickup timing tailored to lunch rush', 'Clear follow-up for catering requests']
      : ['Capture intent from social posts', 'Send the right promo at the right time', 'Track each preorder through fulfillment']
  };
}

export function createDeployment(): Deployment {
  const now = new Date();
  const t1 = new Date(now.getTime() - 4 * 60_000).toISOString();
  const t2 = new Date(now.getTime() - 2 * 60_000).toISOString();
  const t3 = new Date(now.getTime() - 30_000).toISOString();
  return {
    id: 'dep-1',
    state: 'deploying',
    history: [
      { at: t1, state: 'draft', note: 'Opportunity selected and architecture generated.' },
      { at: t2, state: 'validating', note: 'Agent tests executed against generated assets.' },
      { at: t3, state: 'deploying', note: 'Publishing runtime graph to live dashboard.' }
    ]
  };
}

export function createRuntime(opportunity: Opportunity, report: IntelligenceReport): Runtime {
  const agents = createAgentArchitecture(opportunity, report);
  return {
    status: 'executing',
    agents,
    tasks: createTasks(agents),
    tests: createTests(),
    assetPreview: createAssetPreview(opportunity),
    eventLog: [
      { at: new Date(Date.now() - 90_000).toISOString(), text: 'Research evidence normalized into report.' },
      { at: new Date(Date.now() - 60_000).toISOString(), text: 'Selected opportunity converted into task graph.' },
      { at: new Date(Date.now() - 15_000).toISOString(), text: 'Growth agent is drafting asset preview.' }
    ]
  };
}
