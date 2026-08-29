import { createFallbackBusiness, createJoeBusiness } from './demoData.js';
import type { Business, DiscoveryInput, DiscoveryResponse, GeoPoint, ResearchMode, SearchResultMeta, Source } from './types.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DISCOVERY_TIMEOUT_MS = 4500;

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56) || 'business';
}

function titleCase(value: string) {
  if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(value)) return value.trim();
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()).replace(/'S\b/g, "'s");
}

function inferCategory(query: string) {
  const q = query.toLowerCase();
  if (/(pizza|restaurant|cafe|coffee|bakery|bar|grill|bistro|deli|burger|mcdonald|taco|sushi)/.test(q)) return 'restaurant';
  if (/(salon|spa|barber|beauty|nails|lash)/.test(q)) return 'beauty';
  if (/(gym|fitness|pilates|yoga|crossfit)/.test(q)) return 'fitness';
  if (/(dentist|dental|clinic|med|chiro|therapy)/.test(q)) return 'healthcare';
  if (/(plumber|roof|electric|cleaning|hvac|landscap)/.test(q)) return 'home-services';
  if (/(boutique|shop|store|florist|retail)/.test(q)) return 'retail';
  return 'local-service';
}

function haversineMeters(a: GeoPoint, b: GeoPoint) {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function createProviderSources(name: string, providerUrl: string, address: string, provider: string): Source[] {
  return [{
    id: `src-${slugify(name)}-discovery`,
    title: `${name} place discovery`,
    url: providerUrl,
    originalUrl: providerUrl,
    retrievalUrl: providerUrl,
    domain: domainOf(providerUrl),
    kind: 'search',
    sourceType: 'map-listing',
    sourceFamily: provider,
    excerpt: `${provider} returned a public place match for ${name}${address ? ` at ${address}` : ''}.`,
    evidence: ['Business match resolved from public place data'],
    provenance: 'REAL_RETRIEVED',
    availability: 'available',
    contentAvailability: 'full',
    qualityScore: 62,
    relevanceScore: 72,
    entityConfidence: 72,
    entityDisposition: 'target',
    retrievedAt: new Date().toISOString(),
    excerpts: [{ text: `${provider} returned a public place match for ${name}${address ? ` at ${address}` : ''}.`, evidenceRole: 'identity' }],
    businessMatchReason: ['provider listing data']
  }];
}

function createBusinessCandidate(input: {
  query: string;
  rawName: string;
  city: string;
  address?: string;
  websiteUrl?: string;
  phone?: string;
  hours?: string[];
  coordinates?: GeoPoint;
  distanceMeters?: number;
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
  const searchMeta: SearchResultMeta = {
    provider: input.provider,
    distanceMeters: input.distanceMeters,
    phone: input.phone,
    hours: input.hours,
    websiteUrl,
    categories: [category],
    locationLabel: input.address || city
  };
  return {
    id: `biz-${slugify(`${name}-${city}-${input.address ?? ''}-${input.mode}`)}`,
    query: input.query,
    name,
    mode: input.mode,
    category,
    city,
    address: input.address,
    websiteUrl,
    phone: input.phone,
    hours: input.hours,
    latitude: input.coordinates?.latitude,
    longitude: input.coordinates?.longitude,
    discoveryProvider: input.provider,
    researchBasis: websiteUrl ? 'website' : 'provider',
    stage: 'candidate',
    discoveryScore: input.score ?? 86,
    searchMeta,
    description: input.description ?? `${name} appears in public place data and can be researched from real ${input.mode === 'CORPORATION' ? 'company-level' : 'location-aware'} context in ${city}.`,
    sources: createProviderSources(name, input.providerUrl, input.address ?? city, input.provider),
    identity: {
      name,
      normalizedName: name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      mode: input.mode,
      city,
      address: input.address,
      phone: input.phone,
      websiteUrl,
      websiteDomain: domainOf(websiteUrl),
      category,
      coordinates: input.coordinates,
      listingIds: { discoveryProvider: input.provider }
    },
    researchEvents: [],
    researchMetadata: { plannerQuestions: [], limitations: [], providerAvailability: [] }
  };
}

function extractUrlFromText(query: string) {
  const match = query.match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+\.[^\s]+/i);
  return normalizeWebsiteUrl(match?.[0]);
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
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'BusinessForge/0.3 discovery', Accept: 'application/json', ...(init?.headers ?? {}) } });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type NominatimResult = { place_id?: number; display_name: string; lat: string; lon: string; type?: string; class?: string; extratags?: Record<string, string>; address?: Record<string, string>; name?: string };
type OverpassElement = { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type OverpassResponse = { elements: OverpassElement[] };

async function geocodeLocation(locationText: string): Promise<GeoPoint | null> {
  if (!locationText.trim()) return null;
  const url = `${NOMINATIM_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(locationText)}`;
  const results = await fetchJson<NominatimResult[]>(url);
  const first = results?.[0];
  if (!first) return null;
  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}

function categoryFromText(value: string) {
  return inferCategory(value);
}

function compactAddress(tags: Record<string, string> = {}) {
  return [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:state']].filter(Boolean).join(' ');
}

function parseHours(tags: Record<string, string> = {}) {
  const opening = tags.opening_hours || tags['service_times'];
  return opening ? [opening] : undefined;
}

interface SearchProvider {
  name: string;
  search(input: { query: string; locationText: string; websiteUrl?: string | null; coordinates?: GeoPoint; mode: ResearchMode }): Promise<Business[]>;
}

class OverpassNearbyProvider implements SearchProvider {
  name = 'osm-overpass';
  async search(input: { query: string; locationText: string; websiteUrl?: string | null; coordinates?: GeoPoint; mode: ResearchMode }) {
    if (input.mode !== 'BUSINESS' || !input.coordinates || !input.query) return [];
    const qTokens = input.query.toLowerCase().split(/\s+/).filter(Boolean);
    const overpassQuery = `[out:json][timeout:20];(node(around:12000,${input.coordinates.latitude},${input.coordinates.longitude})[name];way(around:12000,${input.coordinates.latitude},${input.coordinates.longitude})[name];relation(around:12000,${input.coordinates.latitude},${input.coordinates.longitude})[name];);out center tags 100;`;
    const payload = await fetchJson<OverpassResponse>(OVERPASS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: overpassQuery });
    return (payload?.elements ?? []).map((element) => {
      const tags = element.tags ?? {};
      const haystack = `${tags.name ?? ''} ${tags.brand ?? ''} ${tags.amenity ?? ''} ${tags.shop ?? ''} ${tags.cuisine ?? ''}`.toLowerCase();
      const score = qTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 18 : 0), 35);
      return { element, score };
    }).filter((entry) => entry.score >= 53).sort((a, b) => b.score - a.score).slice(0, 8).map((entry, index) => {
      const tags = entry.element.tags ?? {};
      const point = entry.element.center ?? (entry.element.lat && entry.element.lon ? { lat: entry.element.lat, lon: entry.element.lon } : undefined);
      const coordinates = point ? { latitude: point.lat, longitude: point.lon } : input.coordinates;
      const address = compactAddress(tags) || input.locationText || 'Nearby area';
      return createBusinessCandidate({
        query: input.query,
        rawName: tags.name ?? input.query,
        city: tags['addr:city'] || tags['addr:town'] || input.locationText || 'Nearby area',
        address,
        websiteUrl: input.websiteUrl ?? tags.website ?? tags['contact:website'],
        phone: tags.phone ?? tags['contact:phone'],
        hours: parseHours(tags),
        coordinates,
        distanceMeters: coordinates && input.coordinates ? haversineMeters(input.coordinates, coordinates) : undefined,
        provider: this.name,
        providerUrl: 'https://overpass-api.de/',
        category: categoryFromText(`${tags.amenity ?? ''} ${tags.shop ?? ''} ${tags.cuisine ?? ''} ${input.query}`),
        score: Math.min(97, entry.score - index * 2),
        description: `${tags.name ?? input.query} was found near the selected location in public map data.`,
        mode: 'BUSINESS'
      });
    });
  }
}

class NominatimTextProvider implements SearchProvider {
  name = 'osm-nominatim';
  async search(input: { query: string; locationText: string; websiteUrl?: string | null; coordinates?: GeoPoint; mode: ResearchMode }) {
    if (!input.query) return [];
    const search = [input.query, input.mode === 'BUSINESS' ? input.locationText : ''].filter(Boolean).join(' ').trim();
    const params = new URLSearchParams({ format: 'jsonv2', limit: input.mode === 'CORPORATION' ? '3' : '8', addressdetails: '1', extratags: '1', q: search });
    if (input.coordinates && input.mode === 'BUSINESS') {
      params.set('viewbox', `${input.coordinates.longitude - 0.18},${input.coordinates.latitude + 0.12},${input.coordinates.longitude + 0.18},${input.coordinates.latitude - 0.12}`);
      params.set('bounded', '1');
    }
    const url = `${NOMINATIM_URL}/search?${params.toString()}`;
    const results = await fetchJson<NominatimResult[]>(url);
    return (results ?? []).map((result, index) => {
      const city = result.address?.city || result.address?.town || result.address?.village || result.address?.county || input.locationText || 'Public match';
      const coordinates = { latitude: Number(result.lat), longitude: Number(result.lon) };
      return createBusinessCandidate({
        query: [input.query, input.locationText].filter(Boolean).join(' ').trim() || input.query,
        rawName: result.name || result.display_name.split(',')[0] || input.query,
        city,
        address: result.display_name,
        websiteUrl: input.websiteUrl ?? result.extratags?.website,
        phone: result.extratags?.phone,
        coordinates,
        distanceMeters: input.coordinates ? haversineMeters(input.coordinates, coordinates) : undefined,
        provider: this.name,
        providerUrl: `${NOMINATIM_URL}/ui/search.html?q=${encodeURIComponent(search)}`,
        category: categoryFromText(`${result.class ?? ''} ${result.type ?? ''} ${result.extratags?.cuisine ?? ''} ${input.query}`),
        score: Math.max(68, 90 - index * 5),
        mode: input.mode
      });
    });
  }
}

const providers: SearchProvider[] = [new OverpassNearbyProvider(), new NominatimTextProvider()];

function scoreCandidate(query: string, candidate: Business) {
  const q = query.toLowerCase();
  const name = candidate.name.toLowerCase();
  let score = candidate.discoveryScore;
  if (name.includes(q) || q.includes(name)) score += 10;
  if (candidate.websiteUrl && q.includes(domainOf(candidate.websiteUrl))) score += 8;
  if (candidate.mode === 'BUSINESS' && candidate.city && q.includes(candidate.city.toLowerCase())) score += 6;
  if (candidate.address && q.includes(candidate.address.toLowerCase())) score += 6;
  return Math.min(99, score);
}

export async function discoverBusinesses(input: string | DiscoveryInput): Promise<DiscoveryResponse> {
  const normalizedInput: DiscoveryInput = typeof input === 'string' ? { query: input, mode: 'BUSINESS' } : input;
  const mode = normalizedInput.mode ?? 'BUSINESS';
  const websiteUrl = normalizeWebsiteUrl(normalizedInput.websiteUrl) ?? extractUrlFromText(normalizedInput.query);
  const { searchTerm, locationText, displayQuery } = parseLocationHint(normalizedInput, websiteUrl);

  if (!displayQuery) {
    return { matches: [createFallbackBusiness('North Star Dental in Seattle', 0), createFallbackBusiness('Glowbar salon in Austin', 0), createFallbackBusiness("McDonald's near downtown San Diego", 0)], suggestion: 'Search a business name, a city or address, use near me, or switch to corporation mode for a company-wide review.' };
  }

  if (searchTerm.toLowerCase().includes('joe') && searchTerm.toLowerCase().includes('pizza')) {
    return { matches: [createJoeBusiness()], suggestion: 'Seeded demo business is available for local testing.' };
  }

  if (mode === 'CORPORATION') {
    const corp = createBusinessCandidate({
      query: searchTerm,
      rawName: searchTerm,
      city: 'Company-wide',
      websiteUrl: websiteUrl ?? undefined,
      provider: 'corporation-query',
      providerUrl: 'https://www.wikidata.org/',
      score: 76,
      description: `${searchTerm} will be researched at the corporation level using representative official, news, directory, and search evidence when retrievable.`,
      mode: 'CORPORATION'
    });
    return { matches: [corp], suggestion: 'Corporation mode keeps location optional and will sample representative company-level sources.' };
  }

  let matches: Business[] = [];
  const resolvedCoordinates = normalizedInput.coordinates ?? (locationText ? await geocodeLocation(locationText) : null) ?? undefined;
  for (const provider of providers) {
    const results = await provider.search({ query: searchTerm, locationText, websiteUrl, coordinates: resolvedCoordinates, mode });
    matches.push(...results);
    if (matches.length >= 5) break;
  }

  if (!matches.length) matches = [0, 1, 2].map((variant) => createFallbackBusiness(displayQuery, variant, websiteUrl ?? undefined));

  const deduped = Array.from(new Map(matches.map((candidate) => [`${candidate.name}:${candidate.address ?? candidate.city}`, candidate])).values())
    .map((candidate) => ({ ...candidate, discoveryScore: scoreCandidate(displayQuery, candidate) }))
    .sort((a, b) => b.discoveryScore - a.discoveryScore)
    .slice(0, 6);
  const usedFallback = deduped.every((candidate) => candidate.researchBasis === 'synthetic' || candidate.researchBasis === 'demo');

  return {
    matches: deduped,
    suggestion: usedFallback
      ? 'Public providers did not return a strong match, so fallback candidates are shown. Adding a city, address, or website should improve grounding.'
      : normalizedInput.coordinates
        ? 'Showing public place matches near your location. Pick the exact business before running research.'
        : 'Discovery used live public place data and keeps only fields actually returned by the provider.'
  };
}
