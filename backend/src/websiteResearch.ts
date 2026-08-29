import type { Business, EvidenceItem, Source, SourceKind } from './types.js';

const REQUEST_TIMEOUT_MS = 7_500;
const MAX_LINKS = 4;
const MAX_TEXT_LENGTH = 1200;

const interestingPathPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /about|story|team/i, label: 'about' },
  { pattern: /service|treat|offer|menu|product/i, label: 'offer' },
  { pattern: /contact|book|appoint|reserve|quote/i, label: 'contact' },
  { pattern: /review|testimonial|case-study|gallery/i, label: 'proof' }
];

function normalizeWebsiteUrl(input?: string | null) {
  if (!input?.trim()) return null;
  const raw = input.trim();
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).toString();
  } catch {
    return null;
  }
}

function withTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, {
    ...init,
    signal: controller.signal,
    headers: {
      'User-Agent': 'BusinessForge/0.1 lightweight research bot',
      Accept: 'text/html,application/xhtml+xml',
      ...(init?.headers ?? {})
    }
  }).finally(() => clearTimeout(timeout));
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function extractTag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function toExcerpt(text: string) {
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).trimEnd()}...`;
}

function inferSourceKind(url: string, text: string): SourceKind {
  const lower = `${url} ${text}`.toLowerCase();
  if (/menu/.test(lower)) return 'menu';
  if (/review|testimonial/.test(lower)) return 'review';
  if (/instagram|facebook|linkedin|tiktok/.test(lower)) return 'social';
  if (/contact|about|service|book|quote|faq/.test(lower)) return 'operations';
  return 'website';
}

function summarizeSignals(text: string, html: string, pageUrl: string) {
  const lower = `${text} ${html}`.toLowerCase();
  const signals: string[] = [];

  if (/(book|schedule|reserve|order online|request a quote|get started|call now|free consult)/i.test(lower)) {
    signals.push('A direct conversion call-to-action is visible on the page');
  }
  if (/(testimonial|review|trusted by|five-star|5-star|customer love|client success)/i.test(lower)) {
    signals.push('Customer proof or trust language appears in the public page content');
  }
  if (/(call|email|visit|hours|location|address)/i.test(lower)) {
    signals.push('Contact or visit details are publicly accessible');
  }
  if (/(service|menu|treatment|product|catering|membership|consultation)/i.test(lower)) {
    signals.push('The site describes concrete offers or service lines');
  }
  if (!/(book|schedule|reserve|order online|request a quote|get started|contact us|call now)/i.test(lower)) {
    signals.push('The next step is not especially explicit in the visible page copy');
  }
  if (signals.length === 0) {
    signals.push(`Public page content was fetched successfully from ${new URL(pageUrl).hostname}`);
  }

  return signals.slice(0, 3);
}

function extractInternalLinks(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const matches = Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi));
  const links = matches
    .map((match) => match[1])
    .map((href) => {
      try {
        return new URL(href, base).toString();
      } catch {
        return null;
      }
    })
    .filter((url): url is string => Boolean(url))
    .filter((url) => new URL(url).origin === base.origin)
    .filter((url) => !/\.(jpg|jpeg|png|gif|webp|pdf|svg|zip)$/i.test(url));

  const scored = Array.from(new Set(links)).map((url) => {
    const matched = interestingPathPatterns.find((entry) => entry.pattern.test(url));
    return { url, score: matched ? 10 : 1 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.url)
    .filter((url, index, list) => list.indexOf(url) === index)
    .slice(0, MAX_LINKS);
}

type FetchedPage = {
  url: string;
  title: string;
  description: string;
  text: string;
  html: string;
  source: Source;
};

async function fetchPage(url: string): Promise<FetchedPage | null> {
  try {
    const res = await withTimeout(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;
    const html = await res.text();
    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || new URL(url).hostname;
    const description = extractTag(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
      || extractTag(html, /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    const text = stripHtml(html).slice(0, MAX_TEXT_LENGTH);
    if (!text) return null;

    return {
      url,
      title,
      description,
      text,
      html,
      source: {
        id: `src-${Buffer.from(url).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`,
        title,
        url,
        kind: inferSourceKind(url, `${title} ${description}`),
        excerpt: toExcerpt(description || text),
        evidence: summarizeSignals(text, html, url)
      }
    };
  } catch {
    return null;
  }
}

function createEvidenceFromPages(business: Business, pages: FetchedPage[]): EvidenceItem[] {
  const combined = pages.map((page) => `${page.title} ${page.description} ${page.text}`).join(' ').toLowerCase();
  const sourceIds = pages.map((page) => page.source.id);
  const hasCta = /(book|schedule|reserve|order online|request a quote|get started|call now|contact us)/i.test(combined);
  const hasProof = /(testimonial|review|trusted by|five-star|5-star|customer|client)/i.test(combined);
  const hasOfferDepth = /(service|menu|product|treatment|catering|membership|consultation)/i.test(combined) || pages.length > 1;
  const hasLocationSignals = /(address|location|hours|visit us)/i.test(combined);

  return [
    {
      id: `ev-${business.id}-real-offer`,
      theme: 'public offer clarity',
      statement: hasOfferDepth
        ? `${business.name} has real public offer detail that can support evidence-backed positioning.`
        : `${business.name} has a limited public offer narrative, which weakens positioning confidence.`,
      type: 'offer',
      sentiment: hasOfferDepth ? 'positive' : 'mixed',
      strength: pages.length >= 2 ? 'high' : 'medium',
      sourceIds,
      implication: hasOfferDepth
        ? 'The workspace can ground strategy in actual public-facing business language.'
        : 'Offer packaging should be clarified before scaling acquisition.'
    },
    {
      id: `ev-${business.id}-real-conversion`,
      theme: 'conversion path',
      statement: hasCta
        ? `${business.name} exposes a visible next step on the public site, so conversion work can optimize an existing path.`
        : `${business.name} lacks a clearly visible next step across the fetched public pages.`,
      type: 'friction',
      sentiment: hasCta ? 'mixed' : 'negative',
      strength: 'high',
      sourceIds,
      implication: hasCta
        ? 'Improve message-to-action consistency instead of inventing a funnel from scratch.'
        : 'A clearer booking, order, or contact path is the highest-leverage wedge.'
    },
    {
      id: `ev-${business.id}-real-proof`,
      theme: hasLocationSignals ? 'trust and accessibility' : 'social proof',
      statement: hasProof
        ? `${business.name} shows public trust or customer proof signals that can be amplified.`
        : hasLocationSignals
          ? `${business.name} provides basic real-world access information, but stronger proof could improve buyer confidence.`
          : `${business.name} does not show much public proof in the fetched pages.`,
      type: hasProof ? 'proof' : 'audience',
      sentiment: hasProof ? 'positive' : 'mixed',
      strength: hasProof ? 'medium' : 'low',
      sourceIds,
      implication: hasProof
        ? 'Campaigns and landing assets should reuse this proof to reduce hesitation.'
        : 'Add testimonials, outcomes, or clearer trust markers to support conversion.'
    }
  ];
}

export async function researchWebsite(business: Business) {
  const websiteUrl = normalizeWebsiteUrl(business.websiteUrl ?? business.sources.find((source) => source.kind === 'website' && !source.url.includes('demo.local'))?.url);
  if (!websiteUrl) return null;

  const homepage = await fetchPage(websiteUrl);
  if (!homepage) return null;

  const extraLinks = extractInternalLinks(homepage.html, websiteUrl);
  const extraPages = (await Promise.all(extraLinks.map((url) => fetchPage(url)))).filter((page): page is FetchedPage => Boolean(page));
  const pages = [homepage, ...extraPages].filter((page, index, list) => list.findIndex((entry) => entry.url === page.url) === index).slice(0, 4);

  return {
    provider: 'local-web-research',
    sources: pages.map((page) => page.source),
    evidenceItems: createEvidenceFromPages(business, pages)
  };
}
