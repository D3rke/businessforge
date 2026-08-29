import { createFallbackBusiness, createJoeBusiness } from './demoData.js';
import type { Business, DiscoveryInput, DiscoveryResponse, GeoPoint, ResearchMode, Source } from './types.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DISCOVERY_TIMEOUT_MS = 3500;

function normalizeWebsiteUrl(input?: string) {
  if (!input?.trim()) return null;
  try {
    return new URL(input.startsWith('http') ? input : `https://${input}`).toString();
  } catch {
    return null;
  }
}

function domainOf(url?: string | null) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

function cleanQuery(query: string) {
  return query.replace(/https?:\/\/[^\s]+/gi, '').replace(/(?:www\.)[^\s]+\.[^\s]+/gi, '').trim();
}

function extractUrlFromText(query: string) {
  const match = query.match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+\.[^\s]+/i);
  return normalizeWebsiteUrl(match?.[0]);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || 'business';
}

function titleCase(value: string) {
  if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(value)) return value.trim();
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()).replace(/'S\b/g, "'s");
}

function inferCategory(query: string) {
  const q = query.toLowerCase();
  if (/(pizza|restaurant|cafe|coffee|bakery|bar|grill|bistro|deli|burger|mcdonald)/.test(q)) return 'restaurant';
  if (/(salon|spa|barber|beauty|nails|lash)/.test(q)) return 'beauty';
  if (/(gym|fitness|pilates|yoga|crossfit)/.test(q)) return 'fitness';
  if (/(dentist|dental|clinic|med|chiro|therapy)/.test(q)) return 'healthcare';
  if (/(plumber|roof|electric|cleaning|hvac|landscap)/.test(q)) return 'home-services';
  if (/(boutique|shop|store|florist|retail)/.test(q)) return 'retail';
  return 'local-service';
}

function createProviderSources(name: string, providerUrl: string, address: string, provider: string): Source[] {
  return [{
    id: `src-${slugify(name)}-discovery`,
    title: `${name} place discovery`,
    url: providerUrl,
    domain: domainOf(providerUrl),
    kind: 'search',
    sourceType: 'map-listing',
    excerpt: `${provider} returned a public place match for ${name}${address ? ` at ${address}` : ''}.`,
    evidence: ['Business match resolved from public place data', 'Location and category can seed live research'],
    provenance: 'REAL_RETRIEVED',
    availability: 'available',
    qualityScore: 62,
    relevanceScore: 72,
    entityConfidence: 72,
    entityDisposition: 'target',
    retrievedAt: new Date().toISOString(),
    excerpts: [{ text: `${provider} returned a public place match for ${name}${address ? ` at ${address}` : ''}.`, evidenceRole: 'identity' }]
  }];
}

function createRealBusinessCandidate(input: {
  query: string;
  rawName: string;
  city: string;
  address?: string;
  websiteUrl?: string;
  coordinates?: GeoPoint;
  provider: string;
  providerUrl: string;
  category?: string;
  score?: number;
  description?: string;
  mode: ResearchMode;
}): Business {
  const category = input.category || inferCategory(input.query || input.rawName);
  const city = input.city || 'Local market';
  const name = titleCase(input.rawName.trim());
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl ?? undefined) ?? undefined;
  return {
    id: `biz-${slugify(`${name}-${city}-${input.address ?? ''}-${input.mode}`)}`,
    query: input.query,
    name,
    mode: input.mode,
    category,
    city,
    address: input.address,
    websiteUrl,
    latitude: input.coordinates?.latitude,
    longitude: input.coordinates?.longitude,
    discoveryProvider: input.provider,
    researchBasis: websiteUrl ? 'website' : 'provider',
    stage: 'candidate',
    discoveryScore: input.score ?? 86,
    description: input.description ?? `${name} appears in public place data and can be researched from real ${input.mode === 'CORPORATION' ? 'company-level' : 'location-aware'} context in ${city}.`,
    sources: createProviderSources(name, input.providerUrl, input.address ?? city, input.provider),
    identity: {
      name,
      normalizedName: name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      mode: input.mode,
      city,
      address: input.address,
      websiteUrl,
      websiteDomain: domainOf(websiteUrl),
      category,
      coordinates: input.coordinates,
      listingIds: { discoveryProvider: input.provider }
    },
    researchMetadata: { plannerQuestions: [], limitations: [], providerAvailability: [] }
  };
}

function parseLocationHint(input: DiscoveryInput, websiteUrl: string | null) {
  const trimmed = cleanQuery(input.query).trim() || (websiteUrl ? new URL(websiteUrl).hostname.replace(/^www\./, '') : '');
  const inline = trimmed.match(/\b(?:in|near|around)\s+(.+)$/i);
  const locationText = input.locationText?.trim() || inline?.[1]?.trim() || '';
  const searchTerm = inline ? trimmed.slice(0, inline.index).trim() : trimmed;
  return { searchTerm, locationText, displayQuery: trimmed };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'BusinessForge/0.2 discovery', Accept: 'application/json', ...(init?.headers ?? {}) } });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type NominatimResult = { display_name: string; lat: string; lon: string; type?: string; class?: string; extratags?: Record<string, string>; address?: Record<string, string>; name?: string };

async function geocodeLocation(locationText: string): Promise<GeoPoint | null> {
  if (!locationText.trim()) return null;
  const url = `${NOMINATIM_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(locationText)}`;
  const results = await fetchJson<NominatimResult[]>(url);
  const first = results?.[0];
  if (!first) return null;
  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}

function categoryFromTags(result: NominatimResult) {
  const raw = `${result.class ?? ''} ${result.type ?? ''} ${result.extratags?.cuisine ?? ''}`.toLowerCase();
  if (/(restaurant|fast_food|cafe|food|burger|pizza|ice_cream)/.test(raw)) return 'restaurant';
  if (/(beauty|hairdresser|spa|salon)/.test(raw)) return 'beauty';
  if (/(fitness|gym|sports_centre)/.test(raw)) return 'fitness';
  if (/(dentist|clinic|hospital|doctors|health)/.test(raw)) return 'healthcare';
  if (/(shop|retail|florist)/.test(raw)) return 'retail';
  return undefined;
}

async function searchByText(query: string, locationText: string, websiteUrl: string | null | undefined, coordinates: GeoPoint | undefined, mode: ResearchMode): Promise<Business[]> {
  const search = [query, mode === 'BUSINESS' ? locationText : ''].filter(Boolean).join(' ').trim();
  if (!search) return [];
  const params = new URLSearchParams({ format: 'jsonv2', limit: mode === 'CORPORATION' ? '3' : '8', addressdetails: '1', extratags: '1', q: search });
  if (coordinates && mode === 'BUSINESS') {
    const lonDelta = 0.18;
    const latDelta = 0.12;
    params.set('viewbox', `${coordinates.longitude - lonDelta},${coordinates.latitude + latDelta},${coordinates.longitude + lonDelta},${coordinates.latitude - latDelta}`);
    params.set('bounded', '1');
  }
  const url = `${NOMINATIM_URL}/search?${params.toString()}`;
  const results = await fetchJson<NominatimResult[]>(url);
  if (!results?.length) return [];
  return results.filter((result) => result.name || result.display_name).map((result, index) => {
    const name = result.name || result.display_name.split(',')[0] || query;
    const city = result.address?.city || result.address?.town || result.address?.village || result.address?.county || locationText || 'Public match';
    return createRealBusinessCandidate({
      query: [query, locationText].filter(Boolean).join(' ').trim() || query,
      rawName: name,
      city,
      address: result.display_name,
      websiteUrl: websiteUrl ?? result.extratags?.website,
      coordinates: { latitude: Number(result.lat), longitude: Number(result.lon) },
      provider: 'osm-nominatim',
      providerUrl: `${NOMINATIM_URL}/ui/search.html?q=${encodeURIComponent(search)}`,
      category: categoryFromTags(result),
      score: Math.max(70, 92 - index * 5),
      mode
    });
  });
}

type OverpassElement = { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type OverpassResponse = { elements: OverpassElement[] };

async function searchNearby(query: string, coordinates: GeoPoint, locationText: string, websiteUrl?: string | null): Promise<Business[]> {
  const needle = query.toLowerCase().replace(/'/g, '');
  const overpassQuery = `[out:json][timeout:20];(node(around:12000,${coordinates.latitude},${coordinates.longitude})[name];way(around:12000,${coordinates.latitude},${coordinates.longitude})[name];relation(around:12000,${coordinates.latitude},${coordinates.longitude})[name];);out center tags 80;`;
  const payload = await fetchJson<OverpassResponse>(OVERPASS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: overpassQuery });
  return (payload?.elements ?? []).filter((element) => element.tags?.name).map((element) => {
    const tags = element.tags ?? {};
    const haystack = `${tags.name ?? ''} ${tags.brand ?? ''} ${tags.amenity ?? ''} ${tags.shop ?? ''} ${tags.cuisine ?? ''}`.toLowerCase().replace(/'/g, '');
    const score = haystack.includes(needle) ? 92 : query.toLowerCase().split(/\s+/).filter(Boolean).reduce((sum, token) => sum + (haystack.includes(token.replace(/'/g, '')) ? 15 : 0), 40);
    return { element, score };
  }).filter((entry) => entry.score >= 55).sort((a, b) => b.score - a.score).slice(0, 8).map((entry, index) => {
    const tags = entry.element.tags ?? {};
    const point = entry.element.center ?? (entry.element.lat && entry.element.lon ? { lat: entry.element.lat, lon: entry.element.lon } : undefined);
    const city = locationText || tags['addr:city'] || tags['addr:town'] || 'Nearby area';
    const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ');
    return createRealBusinessCandidate({
      query,
      rawName: tags.name ?? query,
      city,
      address: address || city,
      websiteUrl: websiteUrl ?? tags.website ?? tags['contact:website'],
      coordinates: point ? { latitude: point.lat, longitude: point.lon } : coordinates,
      provider: 'osm-overpass',
      providerUrl: 'https://overpass-api.de/',
      category: inferCategory(`${tags.amenity ?? ''} ${tags.shop ?? ''} ${tags.cuisine ?? ''} ${query}`),
      score: Math.min(97, entry.score - index * 2),
      description: `${tags.name} was found near the selected map location and can be researched from live public place data.`,
      mode: 'BUSINESS'
    });
  });
}

function scoreCandidate(query: string, candidate: Business) {
  const q = query.toLowerCase();
  const name = candidate.name.toLowerCase();
  let score = candidate.discoveryScore;
  if (name.includes(q) || q.includes(name)) score += 10;
  if (candidate.websiteUrl && q.includes(domainOf(candidate.websiteUrl))) score += 8;
  if (candidate.mode === 'BUSINESS' && candidate.city && q.includes(candidate.city.toLowerCase())) score += 6;
  return Math.min(99, score);
}

export async function discoverBusinesses(input: string | DiscoveryInput): Promise<DiscoveryResponse> {
  const normalizedInput: DiscoveryInput = typeof input === 'string' ? { query: input, mode: 'BUSINESS' } : input;
  const mode = normalizedInput.mode ?? 'BUSINESS';
  const websiteUrl = normalizeWebsiteUrl(normalizedInput.websiteUrl) ?? extractUrlFromText(normalizedInput.query);
  const { searchTerm, locationText, displayQuery } = parseLocationHint(normalizedInput, websiteUrl);

  if (!displayQuery) {
    return { matches: [createFallbackBusiness('North Star Dental in Seattle', 0), createFallbackBusiness('Glowbar salon in Austin', 0), createFallbackBusiness("McDonald's near downtown San Diego", 0)], suggestion: 'Search a business name, add a city for business mode, or switch to corporation mode for a company-wide review.' };
  }

  if (searchTerm.toLowerCase().includes('joe') && searchTerm.toLowerCase().includes('pizza')) {
    return { matches: [createJoeBusiness()], suggestion: 'Seeded demo business is available for local testing.' };
  }

  let matches: Business[] = [];
  const resolvedCoordinates = normalizedInput.coordinates ?? (locationText && mode === 'BUSINESS' ? await geocodeLocation(locationText) : null) ?? undefined;

  if (mode === 'BUSINESS' && searchTerm && resolvedCoordinates) matches = await searchNearby(searchTerm, resolvedCoordinates, locationText, websiteUrl);
  if (mode === 'BUSINESS' && !matches.length && searchTerm) matches = await searchByText(searchTerm, locationText, websiteUrl, resolvedCoordinates, mode);

  if (mode === 'CORPORATION') {
    matches = [createRealBusinessCandidate({ query: searchTerm, rawName: searchTerm, city: 'Company-wide', websiteUrl: websiteUrl ?? undefined, provider: 'query-only', providerUrl: 'https://www.wikidata.org/', score: 74, description: `${searchTerm} will be researched at the corporation level using representative official and knowledge sources.`, mode: 'CORPORATION' })];
  }

  if (!matches.length) matches = [0, 1, 2].map((variant) => createFallbackBusiness(displayQuery, variant, websiteUrl ?? undefined));

  const deduped = Array.from(new Map(matches.map((candidate) => [candidate.id, candidate])).values()).map((candidate) => ({ ...candidate, discoveryScore: scoreCandidate(displayQuery, candidate) })).sort((a, b) => b.discoveryScore - a.discoveryScore).slice(0, 6);
  const usedFallback = deduped.every((candidate) => candidate.researchBasis === 'synthetic' || candidate.researchBasis === 'demo');

  return {
    matches: deduped,
    suggestion: usedFallback
      ? 'Public providers did not return a strong match, so fallback candidates are shown. Adding a location or website should improve grounding.'
      : mode === 'CORPORATION'
        ? 'Corporation mode will use representative company-level sources, not exhaustive scraping.'
        : normalizedInput.coordinates
          ? 'Showing public place matches near your location. Pick the exact business before running research.'
          : 'Discovery used live public place data. Add the website if you want deeper official-page evidence.'
  };
}
