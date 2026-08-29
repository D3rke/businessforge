import type { Business, BusinessIdentity, EvidenceItem, EvidenceSentiment, EvidenceStrength, FindingType, ResearchMode, Source, SourceExcerpt, SourceKind, SourceType } from './types.js';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONTENT = 3500;
const MAX_PAGES = 5;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function domainOf(url?: string | null) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

function normalizeWebsiteUrl(input?: string | null) {
  if (!input?.trim()) return null;
  try {
    return new URL(input.startsWith('http') ? input : `https://${input}`).toString();
  } catch {
    return null;
  }
}

function decodeEntities(text: string) {
  return text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function stripHtml(html: string) {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function excerpt(text: string, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
}

function withTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'BusinessForge/0.2 research', Accept: 'text/html,application/json,text/plain', ...(init?.headers ?? {}) } }).finally(() => clearTimeout(timeout));
}

function extractTag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function dedupeNearDuplicateSources(sources: Source[]) {
  const seen = new Map<string, Source>();
  for (const source of sources) {
    const key = `${source.domain}:${normalizeText(source.title).slice(0, 120)}:${normalizeText(source.excerpt).slice(0, 120)}`;
    const existing = seen.get(key);
    if (!existing || source.qualityScore + source.relevanceScore > existing.qualityScore + existing.relevanceScore) {
      seen.set(key, source);
    }
  }
  return Array.from(seen.values());
}

function splitNameTokens(name: string) {
  return normalizeText(name).split(/\s+/).filter((token) => token && !['the', 'and', 'llc', 'inc', 'co', 'company'].includes(token));
}

function cityTokens(identity: BusinessIdentity) {
  return normalizeText([identity.city, identity.state, identity.country].filter(Boolean).join(' ')).split(/\s+/).filter(Boolean);
}

function extractRelevantExcerpts(text: string): SourceExcerpt[] {
  const pieces = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const out: SourceExcerpt[] = [];
  for (const piece of pieces) {
    const lower = piece.toLowerCase();
    let evidenceRole: SourceExcerpt['evidenceRole'] = 'general';
    if (/(about|founded|company|location|located|address|visit)/.test(lower)) evidenceRole = 'identity';
    if (/(menu|service|offer|product|treatment|membership|order)/.test(lower)) evidenceRole = 'offer';
    if (/(testimonial|review|trusted|award|customer|five-star|5-star)/.test(lower)) evidenceRole = 'proof';
    if (/(book|contact|call|reserve|schedule|quote)/.test(lower)) evidenceRole = 'operations';
    if (/(hard|difficult|problem|limited|lack|no )/.test(lower)) evidenceRole = 'friction';
    if (evidenceRole !== 'general') out.push({ text: excerpt(piece, 260), evidenceRole });
    if (out.length >= 6) break;
  }
  return out;
}

function inferKind(url: string, text: string): SourceKind {
  const lower = `${url} ${text}`.toLowerCase();
  if (/wiki/.test(lower)) return 'knowledge';
  if (/menu/.test(lower)) return 'menu';
  if (/review|testimonial/.test(lower)) return 'review';
  if (/instagram|facebook|linkedin|tiktok|x\.com/.test(lower)) return 'social';
  if (/news|press|investor/.test(lower)) return 'news';
  if (/contact|about|service|book|quote|faq/.test(lower)) return 'operations';
  return 'website';
}

function inferSourceType(url: string): SourceType {
  const lower = url.toLowerCase();
  if (/wikipedia\.org|wikidata\.org/.test(lower)) return 'knowledge-base';
  if (/investor/.test(lower)) return 'official-investor';
  if (/news|press/.test(lower)) return 'official-newsroom';
  if (/about|story|company/.test(lower)) return 'official-about';
  if (/contact|book|reserve|order/.test(lower)) return 'official-contact';
  if (/menu/.test(lower)) return 'official-menu';
  return 'official-website';
}

function scoreEntity(identity: BusinessIdentity, source: Pick<Source, 'domain' | 'content' | 'title' | 'url'>) {
  const haystack = normalizeText(`${source.title} ${source.content ?? ''} ${source.url} ${source.domain}`);
  const nameTokens = splitNameTokens(identity.name);
  const location = cityTokens(identity);
  let score = 0;
  const matched = nameTokens.filter((token) => haystack.includes(token));
  score += matched.length * 18;
  if (identity.websiteDomain && source.domain === identity.websiteDomain) score += 36;
  if (location.length) {
    const locationMatches = location.filter((token) => haystack.includes(token));
    score += locationMatches.length * 8;
    if (matched.length && locationMatches.length === 0 && identity.mode === 'BUSINESS' && source.domain !== identity.websiteDomain) score -= 20;
  }
  if (/competitor|vs\.|alternative/.test(haystack)) score -= 10;
  const clamped = Math.max(0, Math.min(100, score));
  const disposition: Source['entityDisposition'] = clamped >= 65 ? 'target' : clamped >= 40 ? 'general' : 'rejected';
  return { confidence: clamped, disposition };
}

async function fetchHtmlPage(url: string): Promise<Source | null> {
  try {
    const res = await withTimeout(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;
    const html = await res.text();
    const text = stripHtml(html).slice(0, MAX_CONTENT);
    if (!text) return null;
    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || domainOf(url);
    const description = extractTag(html, /<meta\s+(?:name=["']description["']\s+content|content=["']([^"']+)["']\s+name=["']description["'])=["']?([^"'>]+)?/i) || extractTag(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)"/i);
    const dates = Array.from(new Set(Array.from(text.matchAll(/\b(20\d{2}-\d{2}-\d{2}|20\d{2})\b/g)).map((m) => m[1]).slice(0, 4)));
    return {
      id: `src-${slug(Buffer.from(url).toString('base64').slice(0, 16))}`,
      title,
      url,
      domain: domainOf(url),
      kind: inferKind(url, `${title} ${description} ${text}`),
      sourceType: inferSourceType(url),
      excerpt: excerpt(description || text),
      evidence: extractRelevantExcerpts(text).map((item) => item.text).slice(0, 3),
      content: text,
      excerpts: extractRelevantExcerpts(text),
      retrievedAt: new Date().toISOString(),
      provenance: 'REAL_RETRIEVED',
      availability: 'available',
      qualityScore: Math.min(95, 45 + Math.min(40, Math.round(text.length / 80)) + (/contact|about|menu|service|investor|news/.test(url) ? 8 : 0)),
      relevanceScore: 50,
      entityConfidence: 0,
      entityDisposition: 'general',
      dates
    };
  } catch {
    return null;
  }
}

function interestingPaths(mode: ResearchMode) {
  return mode === 'CORPORATION'
    ? ['', '/about', '/company', '/news', '/investors']
    : ['', '/about', '/services', '/menu', '/contact'];
}

async function fetchOfficialPages(websiteUrl: string, mode: ResearchMode) {
  const base = new URL(websiteUrl);
  const urls = interestingPaths(mode).map((path) => new URL(path, base).toString()).slice(0, MAX_PAGES);
  const pages = await Promise.all(urls.map((url) => fetchHtmlPage(url)));
  return pages.filter((page): page is Source => Boolean(page));
}

async function wikidataSearch(query: string) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=1&origin=*`;
  const res = await withTimeout(url);
  if (!res.ok) return null;
  const data = await res.json() as { search?: Array<{ id: string; label: string }> };
  return data.search?.[0] ?? null;
}

async function wikidataEntity(id: string) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`;
  const res = await withTimeout(url);
  if (!res.ok) return null;
  const data = await res.json() as Record<string, any>;
  const entity = data.entities?.[id];
  if (!entity) return null;
  const officialWebsite = entity.claims?.P856?.[0]?.mainsnak?.datavalue?.value as string | undefined;
  const enwiki = entity.sitelinks?.enwiki?.title as string | undefined;
  return { officialWebsite, enwiki };
}

async function fetchWikipediaSummary(title: string) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await withTimeout(url);
  if (!res.ok) return null;
  const data = await res.json() as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
  if (!data.extract || !data.content_urls?.desktop?.page) return null;
  const text = data.extract;
  return {
    id: `src-${slug(title)}-wiki`,
    title: data.title ?? title,
    url: data.content_urls.desktop.page,
    domain: 'wikipedia.org',
    kind: 'knowledge' as SourceKind,
    sourceType: 'knowledge-base' as SourceType,
    excerpt: excerpt(text),
    evidence: [excerpt(text, 180)],
    content: text,
    excerpts: [{ text: excerpt(text, 220), evidenceRole: 'identity' as const }],
    retrievedAt: new Date().toISOString(),
    provenance: 'REAL_RETRIEVED' as const,
    availability: 'available' as const,
    qualityScore: 70,
    relevanceScore: 68,
    entityConfidence: 70,
    entityDisposition: 'general' as const,
    dates: Array.from(new Set(Array.from(text.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) => m[1]).slice(0, 4)))
  };
}

export function buildIdentityFromBusiness(business: Business): BusinessIdentity {
  const websiteUrl = normalizeWebsiteUrl(business.websiteUrl);
  return {
    name: business.name,
    normalizedName: normalizeText(business.name),
    mode: business.mode,
    city: business.city,
    address: business.address,
    websiteUrl: websiteUrl ?? undefined,
    websiteDomain: domainOf(websiteUrl),
    category: business.category,
    coordinates: business.latitude && business.longitude ? { latitude: business.latitude, longitude: business.longitude } : undefined,
    listingIds: { businessId: business.id, ...(business.discoveryProvider ? { discoveryProvider: business.discoveryProvider } : {}) }
  };
}

function scoreSourceQuality(source: Source, identity: BusinessIdentity) {
  let score = source.qualityScore;
  if (source.domain === identity.websiteDomain) score += 8;
  if (source.sourceType === 'knowledge-base') score += 4;
  if (source.content && source.content.length < 250) score -= 12;
  if (source.entityDisposition === 'rejected') score -= 40;
  return Math.max(0, Math.min(100, score));
}

function toFindingType(role: SourceExcerpt['evidenceRole']): FindingType {
  if (role === 'offer') return 'offer';
  if (role === 'proof') return 'proof';
  if (role === 'friction') return 'friction';
  if (role === 'operations') return 'operations';
  if (role === 'identity') return 'audience';
  return 'audience';
}

function sentimentFromRole(role: SourceExcerpt['evidenceRole'], text: string): EvidenceSentiment {
  if (role === 'friction') return 'negative';
  if (role === 'proof') return 'positive';
  if (/(not|no |lack|limited|difficult|hard)/i.test(text)) return 'negative';
  if (/(award|trusted|serving|offering|menu|services|book|contact)/i.test(text)) return 'positive';
  return 'mixed';
}

function strengthFromSupport(count: number): EvidenceStrength {
  return count >= 3 ? 'high' : count === 2 ? 'medium' : 'low';
}

function aggregateEvidence(business: Business, sources: Source[]): EvidenceItem[] {
  const kept = sources.filter((source) => source.entityDisposition !== 'rejected' && source.availability === 'available');
  const buckets = new Map<string, EvidenceItem>();

  for (const source of kept) {
    for (const piece of source.excerpts ?? []) {
      const type = toFindingType(piece.evidenceRole);
      const theme = piece.evidenceRole === 'identity' ? 'business identity' : piece.evidenceRole === 'operations' ? 'conversion path' : piece.evidenceRole === 'offer' ? 'offer visibility' : piece.evidenceRole === 'proof' ? 'public proof' : 'public friction';
      const key = `${type}:${theme}`;
      const current = buckets.get(key) ?? {
        id: `ev-${slug(`${business.id}-${key}`)}`,
        theme,
        statement: '',
        type,
        sentiment: sentimentFromRole(piece.evidenceRole, piece.text),
        strength: 'low',
        sourceIds: [],
        implication: '',
        confidence: 0,
        evidenceCount: 0,
        sourceDiversity: 0,
        provenance: 'REAL_RETRIEVED' as const,
        supportingExcerpts: [],
        firstObservedAt: source.dates?.[0],
        lastObservedAt: source.dates?.slice(-1)[0]
      };
      current.sourceIds.push(source.id);
      current.supportingExcerpts.push({ sourceId: source.id, text: piece.text });
      buckets.set(key, current);
    }
  }

  const findings = Array.from(buckets.values()).map((item) => {
    item.sourceIds = Array.from(new Set(item.sourceIds));
    item.evidenceCount = item.supportingExcerpts.length;
    item.sourceDiversity = new Set(item.sourceIds.map((id) => kept.find((source) => source.id === id)?.domain ?? id)).size;
    item.strength = strengthFromSupport(item.evidenceCount);
    item.confidence = Math.min(95, 45 + item.evidenceCount * 12 + item.sourceDiversity * 8);
    item.statement = buildEvidenceStatement(business, item);
    item.implication = buildImplication(item, business.mode);
    return item;
  }).sort((a, b) => b.confidence - a.confidence);

  if (!findings.length) {
    return [{
      id: `ev-${business.id}-identity`,
      theme: 'business identity',
      statement: `${business.name} was identified, but retrievable evidence was too thin to support stronger findings.`,
      type: 'audience' as const,
      sentiment: 'neutral' as const,
      strength: 'low' as const,
      sourceIds: kept.map((source) => source.id),
      implication: 'More official public pages are needed before making confident recommendations.',
      confidence: 35,
      evidenceCount: kept.length,
      sourceDiversity: new Set(kept.map((source) => source.domain)).size,
      provenance: kept.every((source) => source.provenance === 'REAL_RETRIEVED') ? 'REAL_RETRIEVED' : 'UNAVAILABLE',
      supportingExcerpts: kept.map((source) => ({ sourceId: source.id, text: source.excerpt }))
    }];
  }
  return findings.slice(0, 6);
}

function buildEvidenceStatement(business: Business, item: EvidenceItem) {
  const excerptText = item.supportingExcerpts[0]?.text ?? business.description;
  switch (item.type) {
    case 'offer': return `${business.name} publicly describes concrete offers or service lines, giving the product story real grounding.`;
    case 'proof': return `${business.name} shows public trust or brand-proof signals that can be cited directly.`;
    case 'operations': return `${business.name} exposes a real conversion or contact path in public materials.`;
    case 'friction': return `${business.name} has public friction signals or missing clarity that could weaken conversion confidence.`;
    case 'audience': return `${business.name} has identifiable public business context that supports matching and research scope.`;
    default: return excerptText;
  }
}

function buildImplication(item: EvidenceItem, mode: ResearchMode) {
  if (item.type === 'offer') return mode === 'CORPORATION' ? 'Use representative official language and sample sources honestly.' : 'Reuse actual public offer language instead of inventing positioning.';
  if (item.type === 'proof') return 'Customer-facing assets can cite these visible proof signals.';
  if (item.type === 'operations') return 'Improve message-to-action consistency around the existing next step.';
  if (item.type === 'friction') return 'Tighten the public path to action before scaling traffic.';
  return 'The identity model is strong enough to filter same-name noise more safely.';
}

function createProviderSourceFromExisting(source: Source, identity: BusinessIdentity): Source {
  const entity = scoreEntity(identity, { domain: source.domain || domainOf(source.url), title: source.title, content: `${source.excerpt} ${(source.evidence ?? []).join(' ')}`, url: source.url });
  const next: Source = {
    ...source,
    domain: source.domain || domainOf(source.url),
    sourceType: source.sourceType ?? (source.kind === 'search' ? 'search-result' : 'map-listing'),
    provenance: source.provenance ?? (source.url.includes('demo.local') ? 'DEMO_DATA' : 'REAL_RETRIEVED'),
    availability: source.availability ?? 'available',
    qualityScore: source.qualityScore ?? 55,
    relevanceScore: Math.max(source.relevanceScore ?? 60, entity.confidence),
    entityConfidence: entity.confidence,
    entityDisposition: entity.disposition,
    excerpts: source.excerpts ?? source.evidence.slice(0, 3).map((text) => ({ text, evidenceRole: 'identity' as const })),
    retrievedAt: source.retrievedAt ?? new Date().toISOString()
  };
  next.qualityScore = scoreSourceQuality(next, identity);
  return next;
}

function buildPlannerQuestions(identity: BusinessIdentity) {
  if (identity.mode === 'CORPORATION') {
    return [`What official corporate sources define ${identity.name}?`, 'What public company-wide offer or brand statements are visible?', 'What representative proof or scale signals are publicly retrievable?', 'What limits should be stated about source coverage?'];
  }
  return [`Does this source refer to the specific ${identity.name} in ${identity.city ?? 'the target location'}?`, 'What real offers, services, or menu items are public?', 'How clear is the next step to contact, book, or order?', 'What trust signals are visibly public?'];
}

export async function runEvidenceResearch(business: Business) {
  const identity = buildIdentityFromBusiness(business);
  const plannerQuestions = buildPlannerQuestions(identity);
  const providerAvailability: string[] = [];
  const limitations: string[] = [];

  let sources = business.sources.map((source) => createProviderSourceFromExisting(source, identity));
  let officialPages: Source[] = [];

  let websiteUrl = normalizeWebsiteUrl(business.websiteUrl);
  if (identity.mode === 'CORPORATION') {
    const search = await wikidataSearch(business.name).catch(() => null);
    if (search) {
      const entityData = await wikidataEntity(search.id).catch(() => null);
      if (!websiteUrl && entityData?.officialWebsite) websiteUrl = normalizeWebsiteUrl(entityData.officialWebsite);
      if (entityData?.enwiki) {
        const wiki = await fetchWikipediaSummary(entityData.enwiki).catch(() => null);
        if (wiki) sources.push(wiki);
      }
    } else {
      providerAvailability.push('wikidata search unavailable');
    }
  }

  if (websiteUrl) {
    officialPages = await fetchOfficialPages(websiteUrl, identity.mode);
    if (!officialPages.length) limitations.push(`Official website could not be fetched from ${websiteUrl}.`);
  } else {
    limitations.push('No official website was resolved for live page retrieval.');
  }

  sources = dedupeNearDuplicateSources([...sources, ...officialPages]).map((source) => {
    const entity = scoreEntity(identity, { domain: source.domain, title: source.title, content: source.content, url: source.url });
    const next: Source = { ...source, entityConfidence: entity.confidence, entityDisposition: entity.disposition };
    next.relevanceScore = Math.max(0, Math.min(100, Math.round((entity.confidence * 0.6) + (next.qualityScore * 0.4))));
    next.qualityScore = scoreSourceQuality(next, identity);
    return next;
  }).sort((a, b) => (b.entityDisposition === 'target' ? 20 : 0) + b.relevanceScore - ((a.entityDisposition === 'target' ? 20 : 0) + a.relevanceScore));

  if (identity.mode === 'BUSINESS') {
    const rejected = sources.filter((source) => source.entityDisposition === 'rejected').length;
    if (rejected) limitations.push(`Rejected ${rejected} low-confidence same-name or weak-match sources.`);
  } else {
    limitations.push(`Corporation mode uses a representative sample of ${sources.filter((source) => source.provenance === 'REAL_RETRIEVED').length} retrievable sources, not exhaustive web coverage.`);
  }

  const evidenceItems = aggregateEvidence({ ...business, identity }, sources);
  return {
    provider: 'evidence-pipeline',
    sources,
    evidenceItems,
    identity,
    plannerQuestions,
    limitations,
    providerAvailability,
    sampleNote: identity.mode === 'CORPORATION' ? 'Representative company-level sources were sampled from official and knowledge sources only.' : undefined
  };
}
