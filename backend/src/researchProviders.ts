import { createEvidenceItems } from './demoData.js';
import type { Business, EvidenceItem, Source } from './types.js';
import { researchWebsite } from './websiteResearch.js';

export type ResearchProviderResult = {
  provider: string;
  sources: Source[];
  evidenceItems: EvidenceItem[];
};

export interface ResearchProvider {
  name: string;
  isConfigured(): boolean;
  research(business: Business): Promise<ResearchProviderResult>;
}

class LocalResearchProvider implements ResearchProvider {
  name = 'local-fallback';
  isConfigured() {
    return true;
  }
  async research(business: Business): Promise<ResearchProviderResult> {
    const websiteResult = await researchWebsite(business);
    if (websiteResult) {
      return websiteResult;
    }

    return {
      provider: this.name,
      sources: business.sources,
      evidenceItems: createEvidenceItems(business)
    };
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
    const payload = (await res.json()) as Partial<ResearchProviderResult>;
    return {
      provider: payload.provider ?? this.name,
      sources: payload.sources ?? business.sources,
      evidenceItems: payload.evidenceItems ?? createEvidenceItems(business)
    };
  }
}

const providers: ResearchProvider[] = [new ExternalResearchProvider(), new LocalResearchProvider()];

export function getResearchProvider() {
  return providers.find((provider) => provider.isConfigured()) ?? providers[providers.length - 1];
}
