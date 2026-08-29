import type { Business } from './types.js';
import { runEvidenceResearch } from './researchPipeline.js';

export async function researchWebsite(business: Business) {
  const result = await runEvidenceResearch(business);
  const officialOnly = result.sources.filter((source) => source.domain === result.identity.websiteDomain);
  if (!officialOnly.length) return null;
  return {
    provider: 'local-web-research',
    sources: officialOnly,
    evidenceItems: result.evidenceItems.filter((item) => item.sourceIds.some((id) => officialOnly.some((source) => source.id === id)))
  };
}
