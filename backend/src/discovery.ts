import { createFallbackBusiness, createJoeBusiness } from './demoData.js';
import type { Business, DiscoveryResponse } from './types.js';

function scoreQuery(query: string, candidate: Business) {
  const q = query.toLowerCase();
  const name = candidate.name.toLowerCase();
  let score = candidate.discoveryScore;
  if (name.includes(q) || q.includes(name)) score += 10;
  if (candidate.category && q.includes(candidate.category.replace(/-/g, ' '))) score += 4;
  return Math.min(99, score);
}

export function discoverBusinesses(query: string): DiscoveryResponse {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      matches: [createJoeBusiness(), createFallbackBusiness('North Star Dental in Seattle', 0), createFallbackBusiness('Glowbar salon in Austin', 0)],
      suggestion: 'Try a business name, category, or local query like “dentist in Seattle” or “pizza near Austin”.'
    };
  }

  const candidates: Business[] = [];
  const joe = createJoeBusiness();
  if (trimmed.toLowerCase().includes('joe') || trimmed.toLowerCase().includes('pizza')) candidates.push(joe);

  const fallbackVariants = [0, 1, 2].map((variant) => createFallbackBusiness(trimmed, variant));
  candidates.push(...fallbackVariants);

  const deduped = Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values())
    .map((candidate) => ({ ...candidate, discoveryScore: scoreQuery(trimmed, candidate) }))
    .sort((a, b) => b.discoveryScore - a.discoveryScore)
    .slice(0, 3);

  return {
    matches: deduped,
    suggestion: deduped[0]?.id === joe.id ? 'Joe\'s Pizza remains available as the richest demo dataset, but arbitrary businesses now synthesize into the same flow.' : 'No live provider is configured, so BusinessForge synthesized the best candidate profiles from your query.'
  };
}
