import type { Business, BusinessIdentity, EvidenceItem, EvidenceSentiment, EvidenceStrength, FindingType, ResearchEvent, ResearchMode, Source, SourceExcerpt, SourceKind, SourceType } from './types.js';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONTENT = 3600;
const MAX_OFFICIAL_PAGES = 5;
const MAX_SEARCH_RESULTS_PER_QUERY = 4;

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
  return fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'BusinessForge/0.3 research', Accept: 'text/html,application/json,text/plain', ...(init?.headers ?? {}) } }).finally(() => clearTimeout(timeout));
}

function splitNameTokens(name: string) {
  return normalizeText(name).split(/\s+/).filter((token) => token && !['the', 'and', 'llc', 'inc', 'co', 'company', 'restaurant'].includes(token));
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
    if (/(menu|service|offer|product|treatment|membership|order|appointment|booking)/.test(lower)) evidenceRole = 'offer';
    if (/(testimonial|review|trusted|award|customer|five-star|5-star|rated)/.test(lower)) evidenceRole = 'proof';
    if (/(book|contact|call|reserve|schedule|quote|location|hours)/.test(lower)) evidenceRole = 'operations';
    if (/(hard|difficult|problem|limited|lack|complaint|issue|no )/.test(lower)) evidenceRole = 'friction';
    if (evidenceRole !== 'general') out.push({ text: excerpt(piece, 260), evidenceRole });
    if (out.length >= 6) break;
  }
  return out;
}

function inferKind(url: string, text: string): SourceKind {
  const lower = `${url} ${text}`.toLowerCase();
  if (/reddit|forum|community/.test(lower)) return 'forum';
  if (/wiki/.test(lower)) return 'knowledge';
  if (/menu/.test(lower)) return 'menu';
  if (/review|testimonial|yelp|tripadvisor/.test(lower)) return 'review';
  if (/instagram|facebook|linkedin|tiktok|x\.com/.test(lower)) return 'social';
  if (/news|press|investor|patch|gazette/.test(lower)) return 'news';
  if (/directory|mapquest|yellowpages/.test(lower)) return 'directory';
  if (/contact|about|service|book|quote|faq/.test(lower)) return 'operations';
  return 'website';
}

function inferSourceType(url: string, text = ''): SourceType {
  const lower = `${url} ${text}`.toLowerCase();
  if (/wikipedia\.org|wikidata\.org/.test(lower)) return 'knowledge-base';
  if (/investor/.test(lower)) return 'official-investor';
  if (/news|press/.test(lower)) return 'official-newsroom';
  if (/about|story|company/.test(lower)) return 'official-about';
  if (/contact|book|reserve|order/.test(lower)) return 'official-contact';
  if (/menu/.test(lower)) return 'official-menu';
  if (/directory|mapquest|yellowpages|bbb/.test(lower)) return 'directory-listing';
  if (/duckduckgo/.test(lower)) return 'search-result';
  return 'official-website';
}

function familyForSource(url: string) {
  const domain = domainOf(url);
  if (!domain) return 'unknown';
  if (domain.includes('duckduckgo')) return 'DuckDuckGo';
  return domain;
}

function scoreEntity(identity: BusinessIdentity, source: Pick<Source, 'domain' | 'content' | 'title' | 'url' | 'excerpt'>) {
  const haystack = normalizeText(`${source.title} ${source.excerpt} ${source.content ?? ''} ${source.url} ${source.domain}`);
  const nameTokens = splitNameTokens(identity.name);
  const location = cityTokens(identity);
  let score = 0;
  const reasons: string[] = [];
  const matched = nameTokens.filter((token) => haystack.includes(token));
  score += matched.length * 18;
  if (matched.length) reasons.push(`name tokens: ${matched.join(', ')}`);
  if (identity.websiteDomain && source.domain === identity.websiteDomain) {
    score += 36;
    reasons.push('official domain match');
  }
  if (identity.address && haystack.includes(normalizeText(identity.address).split(' ')[0] || '')) {
    score += 8;
    reasons.push('address hint');
  }
  if (identity.phone && haystack.includes(identity.phone.replace(/[^0-9]/g, '').slice(-7))) {
    score += 12;
    reasons.push('phone hint');
  }
  if (location.length) {
    const locationMatches = location.filter((token) => haystack.includes(token));
    score += locationMatches.length * 8;
    if (locationMatches.length) reasons.push(`location tokens: ${locationMatches.join(', ')}`);
    if (matched.length && locationMatches.length === 0 && identity.mode === 'BUSINESS' && source.domain !== identity.websiteDomain) score -= 20;
  }
  if (/competitor|vs\.|alternative|nearby businesses/.test(haystack)) score -= 10;
  const clamped = Math.max(0, Math.min(100, score));
  const disposition: Source['entityDisposition'] = /competitor|alternative/.test(haystack) ? 'competitor' : clamped >= 65 ? 'target' : clamped >= 40 ? 'general' : 'rejected';
  return { confidence: clamped, disposition, reasons };
}

function scoreSourceQuality(source: Source, identity: BusinessIdentity) {
  let score = source.qualityScore;
  if (source.domain === identity.websiteDomain) score += 8;
  if (source.sourceType === 'knowledge-base') score += 4;
  if (source.contentAvailability === 'snippet') score -= 10;
  if (source.contentAvailability === 'blocked') score -= 20;
  if (source.content && source.content.length < 250) score -= 12;
  if (source.entityDisposition === 'rejected') score -= 40;
  return Math.max(0, Math.min(100, score));
}

function toFindingType(role: SourceExcerpt['evidenceRole']): FindingType {
  if (role === 'offer') return 'offer';
  if (role === 'proof') return 'proof';
  if (role === 'friction') return 'friction';
  if (role === 'operations') return 'operations';
  return 'audience';
}

function sentimentFromRole(role: SourceExcerpt['evidenceRole'], text: string): EvidenceSentiment {
  if (role === 'friction') return 'negative';
  if (role === 'proof') return 'positive';
  if (/(not|no |lack|limited|difficult|hard|complaint)/i.test(text)) return 'negative';
  if (/(award|trusted|serving|offering|menu|services|book|contact)/i.test(text)) return 'positive';
  return 'mixed';
}

function strengthFromSupport(count: number): EvidenceStrength {
  return count >= 3 ? 'high' : count === 2 ? 'medium' : 'low';
}

function buildEvidenceStatement(business: Business, item: EvidenceItem) {
  switch (item.type) {
    case 'offer': return `${business.name} publicly describes concrete offers or service lines that can anchor a real customer experience.`;
    case 'proof': return `${business.name} shows public trust or brand-proof signals that can be cited directly.`;
    case 'operations': return `${business.name} exposes a real conversion or contact path in public materials.`;
    case 'friction': return `${business.name} has public friction or complaint signals that could weaken conversion confidence.`;
    default: return `${business.name} has identifiable public business context that supports matching and research scope.`;
  }
}

function buildImplication(item: EvidenceItem, mode: ResearchMode) {
  if (item.type === 'offer') return mode === 'CORPORATION' ? 'Use representative official language and sample sources honestly.' : 'Reuse actual public offer language instead of inventing positioning.';
  if (item.type === 'proof') return 'Customer-facing assets can cite these visible proof signals.';
  if (item.type === 'operations') return 'Improve message-to-action consistency around the existing next step.';
  if (item.type === 'friction') return 'Tighten the public path to action before scaling traffic.';
  return 'The identity model is strong enough to filter same-name noise more safely.';
}

function aggregateEvidence(business: Business, sources: Source[]): EvidenceItem[] {
  const kept = sources.filter((source) => source.entityDisposition !== 'rejected' && source.availability !== 'unavailable');
  const buckets = new Map<string, EvidenceItem>();
  for (const source of kept) {
    const snippets = source.excerpts?.length ? source.excerpts : source.evidence.slice(0, 3).map((text) => ({ text, evidenceRole: 'general' as const }));
    for (const piece of snippets) {
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
        supportingExcerpts: []
      };
      current.sourceIds.push(source.id);
      current.supportingExcerpts.push({ sourceId: source.id, text: piece.text });
      buckets.set(key, current);
    }
  }
  return Array.from(buckets.values()).map((item) => {
    item.sourceIds = Array.from(new Set(item.sourceIds));
    item.evidenceCount = item.supportingExcerpts.length;
    item.sourceDiversity = new Set(item.sourceIds.map((id) => kept.find((source) => source.id === id)?.domain ?? id)).size;
    item.strength = strengthFromSupport(item.evidenceCount);
    item.confidence = Math.min(95, 45 + item.evidenceCount * 12 + item.sourceDiversity * 8);
    item.statement = buildEvidenceStatement(business, item);
    item.implication = buildImplication(item, business.mode);
    return item;
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

function createEvent(events: ResearchEvent[], event: Omit<ResearchEvent, 'id' | 'at'>) {
  events.unshift({ id: `revt-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), ...event });
}

function interestingPaths(mode: ResearchMode) {
  return mode === 'CORPORATION' ? ['', '/about', '/company', '/news', '/investors'] : ['', '/about', '/services', '/menu', '/contact'];
}

async function fetchHtmlPage(url: string) {
  const res = await withTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error(`Unsupported content type ${contentType}`);
  const html = await res.text();
  const text = stripHtml(html).slice(0, MAX_CONTENT);
  if (!text) throw new Error('Empty page text');
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || domainOf(url);
  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  return {
    title,
    text,
    excerpt: excerpt(metaDescription || text),
    dates: Array.from(new Set(Array.from(text.matchAll(/\b(20\d{2}-\d{2}-\d{2}|20\d{2})\b/g)).map((m) => m[1]).slice(0, 4)))
  };
}

async function fetchOfficialPages(identity: BusinessIdentity, events: ResearchEvent[]) {
  const websiteUrl = normalizeWebsiteUrl(identity.websiteUrl);
  if (!websiteUrl) return { websiteUrl: null, sources: [] as Source[] };
  createEvent(events, { type: 'WEBSITE_RESOLVED', text: `Resolved official website ${websiteUrl}.`, sourceUrl: websiteUrl });
  const base = new URL(websiteUrl);
  const pages: Source[] = [];
  for (const pagePath of interestingPaths(identity.mode).slice(0, MAX_OFFICIAL_PAGES)) {
    const pageUrl = new URL(pagePath, base).toString();
    try {
      createEvent(events, { type: 'QUERY_EXECUTED', text: `Fetching official page ${pageUrl}.`, query: pageUrl });
      const page = await fetchHtmlPage(pageUrl);
      const source: Source = {
        id: `src-${slug(Buffer.from(pageUrl).toString('base64').slice(0, 16))}`,
        title: page.title,
        url: pageUrl,
        originalUrl: pageUrl,
        retrievalUrl: pageUrl,
        domain: domainOf(pageUrl),
        kind: inferKind(pageUrl, `${page.title} ${page.excerpt}`),
        sourceType: inferSourceType(pageUrl),
        sourceFamily: familyForSource(pageUrl),
        excerpt: page.excerpt,
        evidence: extractRelevantExcerpts(page.text).map((item) => item.text).slice(0, 3),
        content: page.text,
        excerpts: extractRelevantExcerpts(page.text),
        retrievedAt: new Date().toISOString(),
        provenance: 'REAL_RETRIEVED',
        availability: 'available',
        contentAvailability: 'full',
        qualityScore: 78,
        relevanceScore: 62,
        entityConfidence: 0,
        entityDisposition: 'general',
        dates: page.dates,
        businessMatchReason: ['official site fetch']
      };
      createEvent(events, { type: 'PAGE_FETCHED', text: `Fetched official page ${page.title}.`, sourceId: source.id, sourceUrl: pageUrl });
      pages.push(source);
    } catch (error) {
      createEvent(events, { type: 'PAGE_BLOCKED', text: `Could not fetch ${pageUrl}.`, detail: error instanceof Error ? error.message : 'fetch failed', sourceUrl: pageUrl });
    }
  }
  return { websiteUrl, sources: pages };
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

async function fetchWikipediaSummary(title: string): Promise<Source | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await withTimeout(url);
  if (!res.ok) return null;
  const data = await res.json() as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
  if (!data.extract || !data.content_urls?.desktop?.page) return null;
  return {
    id: `src-${slug(title)}-wiki`,
    title: data.title ?? title,
    url: data.content_urls.desktop.page,
    originalUrl: data.content_urls.desktop.page,
    retrievalUrl: url,
    domain: 'wikipedia.org',
    kind: 'knowledge',
    sourceType: 'knowledge-base',
    sourceFamily: 'Wikipedia',
    excerpt: excerpt(data.extract),
    evidence: [excerpt(data.extract, 180)],
    content: data.extract,
    excerpts: [{ text: excerpt(data.extract, 220), evidenceRole: 'identity' }],
    retrievedAt: new Date().toISOString(),
    provenance: 'REAL_RETRIEVED',
    availability: 'available',
    contentAvailability: 'full',
    qualityScore: 70,
    relevanceScore: 68,
    entityConfidence: 70,
    entityDisposition: 'general',
    dates: Array.from(new Set(Array.from(data.extract.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((m) => m[1]).slice(0, 4)))
  };
}

function buildSearchQueries(identity: BusinessIdentity) {
  const label = identity.mode === 'BUSINESS' ? `${identity.name} ${identity.city ?? ''} ${identity.address ?? ''}`.trim() : identity.name;
  return [
    { query: `${label} reviews`, category: 'review' as const },
    { query: `${label} reddit OR forum`, category: 'forum' as const },
    { query: `${label} news`, category: 'news' as const },
    { query: `${label} directory OR hours OR phone`, category: 'directory' as const },
    { query: `${label} complaints OR yelp`, category: 'review' as const }
  ];
}

async function searchDuckDuckGo(query: string) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await withTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const rows = Array.from(html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi));
  return rows.map((match) => {
    const href = decodeEntities(match[1] || match[4] || '');
    const titleHtml = match[2] || match[5] || '';
    const snippetHtml = match[3] || match[6] || '';
    return {
      title: stripHtml(titleHtml),
      url: href,
      snippet: stripHtml(snippetHtml)
    };
  }).filter((item) => item.url && item.title).slice(0, MAX_SEARCH_RESULTS_PER_QUERY);
}

async function buildSearchSources(identity: BusinessIdentity, events: ResearchEvent[]) {
  const output: Source[] = [];
  for (const query of buildSearchQueries(identity)) {
    createEvent(events, { type: 'QUERY_EXECUTED', text: `Searching public web for ${query.query}.`, query: query.query });
    try {
      const results = await searchDuckDuckGo(query.query);
      createEvent(events, { type: 'RESULT_DISCOVERED', text: `DuckDuckGo returned ${results.length} results for ${query.query}.`, query: query.query, count: results.length });
      for (const result of results) {
        const source: Source = {
          id: `src-${slug(Buffer.from(`${query.query}:${result.url}`).toString('base64').slice(0, 18))}`,
          title: result.title,
          url: result.url,
          originalUrl: result.url,
          retrievalUrl: `https://duckduckgo.com/html/?q=${encodeURIComponent(query.query)}`,
          domain: domainOf(result.url),
          kind: query.category,
          sourceType: inferSourceType(result.url, result.title),
          sourceFamily: familyForSource(result.url),
          excerpt: excerpt(result.snippet || `${result.title} was discovered in DuckDuckGo results for ${query.query}.`),
          evidence: [excerpt(result.snippet || result.title, 180)],
          excerpts: [{ text: excerpt(result.snippet || result.title, 220), evidenceRole: query.category === 'review' ? 'proof' : query.category === 'forum' ? 'friction' : 'general' }],
          retrievedAt: new Date().toISOString(),
          provenance: 'REAL_RETRIEVED',
          availability: 'snippet-only',
          contentAvailability: 'snippet',
          qualityScore: 54,
          relevanceScore: 58,
          entityConfidence: 0,
          entityDisposition: 'general',
          notes: [`Search evidence via DuckDuckGo HTML results for query: ${query.query}`],
          businessMatchReason: ['search snippet']
        };
        output.push(source);
        createEvent(events, { type: 'RESULT_DISCOVERED', text: `Discovered ${result.title}.`, query: query.query, sourceId: source.id, sourceUrl: result.url });
        try {
          const page = await fetchHtmlPage(result.url);
          source.content = page.text;
          source.excerpt = page.excerpt;
          source.evidence = extractRelevantExcerpts(page.text).map((item) => item.text).slice(0, 3);
          source.excerpts = extractRelevantExcerpts(page.text);
          source.availability = 'available';
          source.contentAvailability = 'full';
          source.qualityScore = 72;
          createEvent(events, { type: 'PAGE_FETCHED', text: `Fetched ${result.title}.`, sourceId: source.id, sourceUrl: result.url });
        } catch (error) {
          source.notes = [...(source.notes ?? []), `Direct page fetch unavailable: ${error instanceof Error ? error.message : 'fetch failed'}`];
          source.availability = 'snippet-only';
          source.contentAvailability = 'blocked';
          createEvent(events, { type: 'PAGE_BLOCKED', text: `Direct fetch blocked for ${result.title}.`, detail: error instanceof Error ? error.message : 'fetch failed', sourceId: source.id, sourceUrl: result.url });
        }
      }
    } catch (error) {
      createEvent(events, { type: 'PAGE_BLOCKED', text: `Search failed for ${query.query}.`, detail: error instanceof Error ? error.message : 'search failed', query: query.query });
    }
  }
  return output;
}

function buildPlannerQuestions(identity: BusinessIdentity) {
  if (identity.mode === 'CORPORATION') {
    return [`What official corporate sources define ${identity.name}?`, 'What public company-wide offer or brand statements are visible?', 'What review, forum, news, and directory traces are retrievable as pages or snippets?', 'What limits should be stated about blocked coverage?'];
  }
  return [`Does this source refer to the specific ${identity.name} in ${identity.city ?? 'the target location'}?`, 'What real offers, services, or menu items are public?', 'How clear is the next step to contact, book, or order?', 'What trust, review, forum, or complaint signals are visibly public?'];
}

export function buildIdentityFromBusiness(business: Business): BusinessIdentity {
  const websiteUrl = normalizeWebsiteUrl(business.websiteUrl);
  return {
    name: business.name,
    normalizedName: normalizeText(business.name),
    mode: business.mode,
    city: business.city,
    address: business.address,
    phone: business.phone,
    websiteUrl: websiteUrl ?? undefined,
    websiteDomain: domainOf(websiteUrl),
    category: business.category,
    coordinates: business.latitude && business.longitude ? { latitude: business.latitude, longitude: business.longitude } : undefined,
    listingIds: { businessId: business.id, ...(business.discoveryProvider ? { discoveryProvider: business.discoveryProvider } : {}) }
  };
}

export async function runEvidenceResearch(business: Business) {
  const identity = buildIdentityFromBusiness(business);
  const plannerQuestions = buildPlannerQuestions(identity);
  const providerAvailability: string[] = [];
  const limitations: string[] = [];
  const events: ResearchEvent[] = [];
  createEvent(events, { type: 'BUSINESS_IDENTIFIED', text: `Matched ${identity.name}${identity.city ? ` in ${identity.city}` : ''}.` });

  let sources: Source[] = [];
  for (const source of business.sources) {
    sources.push({
      ...source,
      originalUrl: source.originalUrl ?? source.url,
      retrievalUrl: source.retrievalUrl ?? source.url,
      sourceFamily: source.sourceFamily ?? familyForSource(source.url),
      contentAvailability: source.contentAvailability ?? 'full',
      businessMatchReason: source.businessMatchReason ?? ['existing discovery source']
    });
  }

  if (identity.mode === 'CORPORATION') {
    try {
      const search = await wikidataSearch(business.name);
      if (search) {
        const entity = await wikidataEntity(search.id);
        if (!identity.websiteUrl && entity?.officialWebsite) identity.websiteUrl = normalizeWebsiteUrl(entity.officialWebsite) ?? undefined;
        if (entity?.enwiki) {
          const wiki = await fetchWikipediaSummary(entity.enwiki);
          if (wiki) {
            sources.push(wiki);
            createEvent(events, { type: 'PAGE_FETCHED', text: `Fetched Wikipedia summary for ${business.name}.`, sourceId: wiki.id, sourceUrl: wiki.url });
          }
        }
      } else {
        providerAvailability.push('wikidata search unavailable');
      }
    } catch {
      providerAvailability.push('wikidata lookup failed');
    }
  }

  const official = await fetchOfficialPages(identity, events);
  if (official.websiteUrl) identity.websiteUrl = official.websiteUrl;
  else limitations.push('No official website was resolved for live page retrieval.');
  sources.push(...official.sources);

  const searchSources = await buildSearchSources(identity, events);
  sources.push(...searchSources);

  const deduped = Array.from(new Map(sources.map((source) => [`${source.url}:${normalizeText(source.title)}`, source])).values()).map((source) => {
    const entity = scoreEntity(identity, { domain: source.domain, title: source.title, content: source.content, url: source.url, excerpt: source.excerpt });
    const next: Source = { ...source, entityConfidence: entity.confidence, entityDisposition: entity.disposition, businessMatchReason: [...new Set([...(source.businessMatchReason ?? []), ...entity.reasons])] };
    next.relevanceScore = Math.max(0, Math.min(100, Math.round((entity.confidence * 0.6) + (next.qualityScore * 0.4))));
    next.qualityScore = scoreSourceQuality(next, identity);
    if (next.entityDisposition === 'rejected') {
      createEvent(events, { type: 'SOURCE_REJECTED', text: `Rejected ${next.title} as a weak or wrong-location match.`, sourceId: next.id, sourceUrl: next.url });
    } else if ((next.excerpts?.length ?? 0) > 0) {
      createEvent(events, { type: 'EVIDENCE_EXTRACTED', text: `Extracted ${(next.excerpts ?? []).length} evidence excerpts from ${next.title}.`, sourceId: next.id, count: next.excerpts?.length });
    }
    return next;
  }).sort((a, b) => (b.entityDisposition === 'target' ? 20 : 0) + b.relevanceScore - ((a.entityDisposition === 'target' ? 20 : 0) + a.relevanceScore));

  const evidenceItems = aggregateEvidence({ ...business, identity }, deduped);
  const rejected = deduped.filter((source) => source.entityDisposition === 'rejected').length;
  if (rejected) limitations.push(`Rejected ${rejected} weak or wrong-location matches.`);
  const blocked = deduped.filter((source) => source.contentAvailability === 'blocked').length;
  if (blocked) limitations.push(`${blocked} sources were only usable as search snippets because direct fetch was blocked or unavailable.`);
  if (identity.mode === 'CORPORATION') limitations.push(`Corporation mode uses representative retrievable sources, not exhaustive web coverage.`);

  createEvent(events, { type: 'RESEARCH_COMPLETE', text: `Research completed with ${deduped.length} sources and ${evidenceItems.length} evidence themes.` });
  return {
    provider: 'evidence-pipeline',
    sources: deduped,
    evidenceItems,
    identity,
    plannerQuestions,
    limitations,
    providerAvailability,
    events,
    sampleNote: identity.mode === 'CORPORATION' ? 'Representative company-level sources were sampled from official pages, DuckDuckGo discovery, and knowledge sources when retrievable.' : undefined
  };
}
