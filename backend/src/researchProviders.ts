import { createEvidenceItems } from './demoData.js';
import { runEvidenceResearch } from './researchPipeline.js';
import type { Business, BusinessIdentity, EvidenceItem, Source } from './types.js';

export type ResearchProviderResult = {
  provider: string;
  sources: Source[];
  evidenceItems: EvidenceItem[];
  identity: BusinessIdentity;
  plannerQuestions: string[];
  limitations: string[];
  providerAvailability: string[];
  sampleNote?: string;
};

export interface ResearchProvider {
  name: string;
  isConfigured(): boolean;
  research(business: Business): Promise<ResearchProviderResult>;
}

class LocalEvidenceProvider implements ResearchProvider {
  name = 'evidence-pipeline';
  isConfigured() {
    return true;
  }
  async research(business: Business): Promise<ResearchProviderResult> {
    if (business.researchBasis === 'demo' || business.sources.every((source) => source.provenance === 'DEMO_DATA' || source.url.includes('demo.local'))) {
      return {
        provider: 'demo-fallback',
        sources: business.sources,
        evidenceItems: createEvidenceItems(business),
        identity: business.identity,
        plannerQuestions: business.researchMetadata?.plannerQuestions ?? [],
        limitations: ['Using demo fallback sources only.'],
        providerAvailability: ['live retrieval skipped for demo-seeded business']
      };
    }
    return runEvidenceResearch(business);
  }
}

class ExternalResearchProvider implements ResearchProvider {
  name = 'external-http';
  isConfigured() {
    return Boolean(process.env.RESEARCH_PROVIDER_URL);
  }
  async research(business: Business): Promise<ResearchProviderResult> {
    const endpoint = process.env.RESEARCH_PROVIDER_URL;
    if (!endpoint) throw new Error('RESEARCH_PROVIDER_URL not configured');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business })
    });
    if (!res.ok) throw new Error(`Provider request failed: ${res.status}`);
    const payload = await res.json() as Partial<ResearchProviderResult>;
    return {
      provider: payload.provider ?? this.name,
      sources: payload.sources ?? business.sources,
      evidenceItems: payload.evidenceItems ?? createEvidenceItems(business),
      identity: payload.identity ?? business.identity,
      plannerQuestions: payload.plannerQuestions ?? [],
      limitations: payload.limitations ?? ['External provider did not supply limitations.'],
      providerAvailability: payload.providerAvailability ?? []
    };
  }
}

const providers: ResearchProvider[] = [new ExternalResearchProvider(), new LocalEvidenceProvider()];

export function getResearchProvider() {
  return providers.find((provider) => provider.isConfigured()) ?? providers[providers.length - 1];
}
