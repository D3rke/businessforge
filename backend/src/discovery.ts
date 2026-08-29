import { createFallbackBusiness, createJoeBusiness } from './demoData.js';
import type { Business, DiscoveryInput, DiscoveryResponse } from './types.js';

function normalizeWebsiteUrl(input?: string) {
  if (!input?.trim()) return null;
  try {
    return new URL(input.startsWith('http') ? input : `https://${input}`).toString();
  } catch {
    return null;
  }
}

function extractUrlFromText(query: string) {
  const match = query.match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+\.[^\s]+/i);
  return normalizeWebsiteUrl(match?.[0]);
}

function cleanQuery(query: string) {
  return query.replace(/https?:\/\/[^\s]+/gi, '').replace(/(?:www\.)[^\s]+\.[^\s]+/gi, '').trim();
}

function scoreQuery(query: string, candidate: Business) {
  const q = query.toLowerCase();
  const name = candidate.name.toLowerCase();
  let score = candidate.discoveryScore;
  if (name.includes(q) || q.includes(name)) score += 10;
  if (candidate.category && q.includes(candidate.category.replace(/-/g, ' '))) score += 4;
  return Math.min(99, score);
}

export function discoverBusinesses(input: string | DiscoveryInput): DiscoveryResponse {
  const rawQuery = typeof input === 'string' ? input : input.query;
  const websiteUrl = normalizeWebsiteUrl(typeof input === 'string' ? undefined : input.websiteUrl) ?? extractUrlFromText(rawQuery);
  const trimmed = cleanQuery(rawQuery).trim() || (websiteUrl ? new URL(websiteUrl).hostname.replace(/^www\./, '') : '');
  if (!trimmed) {
    return {
      matches: [createJoeBusiness(), createFallbackBusiness('North Star Dental in Seattle', 0), createFallbackBusiness('Glowbar salon in Austin', 0)],
      suggestion: 'Try a real business name, a category query, or add a website like “North Star Dental in Seattle” plus “northstardental.com”. Joe\'s Pizza is available as demo data only.'
    };
  }

  const candidates: Business[] = [];
  const joe = createJoeBusiness();
  if (trimmed.toLowerCase().includes('joe') || trimmed.toLowerCase().includes('pizza')) candidates.push(joe);

  const fallbackVariants = [0, 1, 2].map((variant) => createFallbackBusiness(trimmed, variant, websiteUrl ?? undefined));
  candidates.push(...fallbackVariants);

  const deduped = Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values())
    .map((candidate) => ({ ...candidate, discoveryScore: scoreQuery(trimmed, candidate) }))
    .sort((a, b) => b.discoveryScore - a.discoveryScore)
    .slice(0, 3);

  return {
    matches: deduped,
    suggestion: websiteUrl
      ? 'BusinessForge will try real public-page research from the provided website, then fall back only if the site is inaccessible or too thin.'
      : deduped[0]?.id === joe.id
        ? 'Joe\'s Pizza is still the richest demo profile, but it is not the main path. Add a real business name or website to drive non-demo research.'
        : 'No external provider is configured, so discovery is still synthesized. Add a website URL to ground research in accessible public pages.'
  };
}
