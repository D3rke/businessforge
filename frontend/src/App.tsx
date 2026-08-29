import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from './components/Card';
import { api } from './lib/api';
import type { AgentTask, Business, BuildPlanStep, DiscoveryInput, DiscoveryResponse, EvidenceItem, Opportunity, ResearchMode, ResearchResponse, RuntimeEvent, Source } from './lib/types';

const defaultQuery = "McDonald's";
const workspaceTabs = ['research', 'findings', 'plan', 'build', 'live'] as const;
type WorkspaceTab = (typeof workspaceTabs)[number];
const recentBusinessKey = 'businessforge:recent-businesses';

type SearchDraft = {
  query: string;
  websiteUrl: string;
  locationText: string;
  mode: ResearchMode;
  coordinates?: DiscoveryInput['coordinates'];
};

export default function App() {
  return (
    <main className="min-h-screen bg-[#f5f6f2] text-slate-900">
      <div className="min-h-screen border-x border-slate-200/70 bg-[#fcfcfa] shadow-[0_0_0_1px_rgba(15,23,42,0.02)] sm:mx-4 sm:my-4 sm:rounded-[28px] lg:mx-6">
        <AppFrame>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/businesses" element={<BusinessesPage />} />
            <Route path="/work" element={<WorkPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/workspace/:businessId" element={<WorkspacePage />} />
            <Route path="/results" element={<Navigate to="/businesses" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppFrame>
      </div>
    </main>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div>
      <header className="border-b border-slate-200/80 bg-[#fcfcfa]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 text-sm font-semibold text-slate-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-300 bg-white text-[13px]">BF</span>
              <span>BusinessForge</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <TopNavLink to="/">Home</TopNavLink>
              <TopNavLink to="/businesses">Businesses</TopNavLink>
              <TopNavLink to="/work">Work</TopNavLink>
              <TopNavLink to="/settings">Settings</TopNavLink>
            </nav>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Business operations</p>
            <p className="text-sm text-slate-600">Research, planning, launch</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>
    </div>
  );
}

function TopNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `rounded-full px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      {children}
    </NavLink>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const recentBusinesses = useRecentBusinesses();
  const [draft, setDraft] = useState<SearchDraft>({ query: defaultQuery, websiteUrl: '', locationText: '', mode: 'BUSINESS' });
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');

  const submit = () => navigate(`/businesses?${toDiscoveryParams(draft).toString()}`);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoState('error');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          locationText: 'Near me',
          coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }
        }));
        setGeoState('ready');
      },
      () => setGeoState('error'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-8 border-b border-slate-200 pb-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Home</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Analyze a business and turn the findings into something useful.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Start with a business name, website, and location. BusinessForge will investigate the public footprint, highlight what matters, and prepare a build plan you can approve.</p>
        </div>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <div>
              <p className="mb-2 block text-sm font-medium text-slate-700">Research mode</p>
              <div className="flex gap-2">
                {(['BUSINESS', 'CORPORATION'] as ResearchMode[]).map((mode) => (
                  <button key={mode} onClick={() => setDraft((current) => ({ ...current, mode, locationText: mode === 'CORPORATION' ? '' : current.locationText, coordinates: mode === 'CORPORATION' ? undefined : current.coordinates }))} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${draft.mode === mode ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                    {mode === 'BUSINESS' ? 'Business' : 'Corporation'}
                  </button>
                ))}
              </div>
            </div>
            <SearchField label="Business name" value={draft.query} onChange={(value) => setDraft((current) => ({ ...current, query: value }))} placeholder="McDonald's, North Star Dental, coffee shop" />
            <SearchField label="Website" value={draft.websiteUrl} onChange={(value) => setDraft((current) => ({ ...current, websiteUrl: value }))} placeholder="Optional business website" />
            {draft.mode === 'BUSINESS' ? <SearchField label="Location" value={draft.locationText} onChange={(value) => setDraft((current) => ({ ...current, locationText: value, coordinates: value === 'Near me' ? current.coordinates : undefined }))} placeholder="City, neighborhood, or leave blank" /> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={submit} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Analyze business</button>
            {draft.mode === 'BUSINESS' ? <button onClick={useMyLocation} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              {geoState === 'locating' ? 'Finding location…' : geoState === 'ready' ? 'Using your location' : 'Use my location'}
            </button> : null}
          </div>
          <p className="mt-3 text-sm text-slate-500">{geoState === 'error' ? 'Location access was unavailable. You can still search by city or neighborhood.' : draft.mode === 'CORPORATION' ? 'Corporation mode samples representative company-level sources honestly.' : 'Keep the input simple. We will use it to find the right business first.'}</p>
        </section>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="Recent businesses" subtitle="Continue from the businesses you reviewed most recently">
          <BusinessList businesses={recentBusinesses} emptyCopy="No recent businesses yet. Analyze a business to start a workspace." />
        </Card>
        <Card title="How it works" subtitle="A simple path from research to launch">
          <ol className="space-y-4 text-sm text-slate-600">
            {[
              ['Find the business', 'Confirm the right location, website, and public footprint.'],
              ['Review the findings', 'See what looks strong, what may be getting in the way, and why.'],
              ['Choose a plan', 'Pick the improvement worth building first.'],
              ['Approve the build', 'Review what will be created before anything moves forward.'],
              ['Manage what is live', 'Track progress, launch status, and ongoing business systems.']
            ].map(([title, copy], index) => (
              <li key={title} className="flex gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                <span className="mt-0.5 text-sm font-semibold text-slate-400">0{index + 1}</span>
                <div>
                  <p className="font-medium text-slate-900">{title}</p>
                  <p className="mt-1 leading-6">{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </div>
  );
}

function BusinessesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recentBusinesses = useRecentBusinesses();
  const [matches, setMatches] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Business | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [run, setRun] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = useMemo<DiscoveryInput>(() => ({
    query: searchParams.get('q') ?? '',
    websiteUrl: searchParams.get('website') ?? undefined,
    locationText: searchParams.get('location') === 'Near me' ? undefined : searchParams.get('location') ?? undefined,
    mode: (searchParams.get('mode') as ResearchMode) || 'BUSINESS',
    coordinates: searchParams.get('lat') && searchParams.get('lng')
      ? { latitude: Number(searchParams.get('lat')), longitude: Number(searchParams.get('lng')) }
      : undefined
  }), [searchParams]);

  useEffect(() => {
    if (!input.query.trim()) {
      setMatches([]);
      setSelected(null);
      setSuggestion(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.discover(input)
      .then((res: DiscoveryResponse) => {
        if (cancelled) return;
        setMatches(res.matches);
        setSelected(res.matches[0] ?? null);
        setSuggestion(res.suggestion);
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(toPlainError(err.message, 'We could not look up that business right now.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [input]);

  useEffect(() => {
    if (!run || run.run.status === 'complete') return;
    const timer = setInterval(async () => {
      const next = await api.getResearch(run.run.id);
      setRun(next);
      if (next.run.status === 'complete') {
        rememberBusiness(next.business.id);
        navigate(`/workspace/${next.business.id}?tab=findings`);
      }
    }, 900);
    return () => clearInterval(timer);
  }, [navigate, run]);

  const startResearch = async () => {
    if (!selected) return;
    rememberBusiness(selected.id);
    setRun(await api.startResearch(selected.id));
  };

  const hasSearch = Boolean(input.query.trim());

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Businesses</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{hasSearch ? 'Choose the right business' : 'Your businesses'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{hasSearch ? 'Review the matches, confirm the right business, and start the investigation.' : 'Recent business workspaces appear here so you can jump back in quickly.'}</p>
        </div>
        <Link to="/" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Analyze another business</Link>
      </section>

      {!hasSearch ? (
        <Card title="Recent businesses" subtitle="Saved from your recent work">
          <BusinessList businesses={recentBusinesses} emptyCopy="No businesses yet. Start from Home to analyze a business." />
        </Card>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <Card title="Matches" subtitle="Pick the business you want us to investigate">
            {suggestion ? <InlineNote>{suggestion}</InlineNote> : null}
            {error ? <ErrorMessage message={error} /> : null}
            {loading ? <LoadingPanel label="Finding matching businesses" /> : null}
            {!loading ? <BusinessChooser matches={matches} selected={selected} onSelect={setSelected} /> : null}
          </Card>

          <Card title={selected?.name ?? 'Selected business'} subtitle={selected ? 'Review the business details before starting the investigation.' : 'Choose a business from the list first.'}>
            {selected ? (
              <div className="space-y-5">
                <BusinessSnapshot business={selected} />
                {run ? <ResearchRunPanel run={run} /> : null}
                <button onClick={startResearch} disabled={Boolean(run && run.run.status !== 'complete')} className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  {run && run.run.status !== 'complete' ? 'Investigating…' : 'Start investigation'}
                </button>
                <p className="text-sm text-slate-500">We will gather public business signals, organize the findings, and prepare a build plan you can review.</p>
              </div>
            ) : (
              <EmptyState copy="Select a business from the list to continue." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function WorkPage() {
  const recentBusinesses = useRecentBusinesses();
  const researched = recentBusinesses.filter((business) => business.stage === 'researched');
  return (
    <div className="space-y-8">
      <section className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-slate-500">Work</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Active business work</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Keep track of businesses with findings, build plans, and launch work already in motion.</p>
      </section>
      <Card title="Workspaces" subtitle="Businesses that already have a working plan or live build activity">
        <BusinessList businesses={researched} emptyCopy="No active workspaces yet. Once a business has been investigated, it will appear here." showStage />
      </Card>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-8">
      <section className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-slate-500">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Workspace settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Keep a simple place for account and workspace preferences as the product grows.</p>
      </section>
      <Card title="Preferences" subtitle="A clean placeholder rather than an empty dead-end">
        <div className="space-y-4 text-sm text-slate-600">
          <p>Settings are not configurable in this demo yet.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Business workspaces and investigations remain fully functional.</li>
            <li>Return to Home to start a new analysis, or open Work to continue an existing one.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

function WorkspacePage() {
  const { businessId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Please keep moving and flag anything that still needs a decision from me.');

  const activeTab = ((searchParams.get('tab') as WorkspaceTab) || 'research');
  const selectedOpportunity = business?.opportunities?.find((opp) => opp.id === business.selectedOpportunityId);
  const evidenceById = useMemo(() => new Map((business?.evidenceItems ?? []).map((item) => [item.id, item])), [business?.evidenceItems]);
  const sourcesById = useMemo(() => new Map((business?.sources ?? []).map((item) => [item.id, item])), [business?.sources]);
  const groupedSources = useMemo(() => groupSources(business?.sources ?? []), [business?.sources]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getBusiness(businessId)
      .then((next) => {
        if (cancelled) return;
        setBusiness(next);
        rememberBusiness(next.id);
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(toPlainError(err.message, 'We could not load this workspace right now.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const chooseOpportunity = async (opportunityId: string) => {
    if (!business) return;
    const next = await api.selectOpportunity(business.id, opportunityId);
    setBusiness(next);
    rememberBusiness(next.id);
    setSearchParams({ tab: 'build' });
  };

  const updateTask = async (taskId: string, action: 'advance' | 'block') => {
    if (!business) return;
    const next = await api.updateTask(business.id, taskId, action);
    setBusiness(next);
    rememberBusiness(next.id);
  };

  const sendMessage = async () => {
    if (!business?.runtime?.agents.length || !message.trim()) return;
    const res = await api.interact(business.id, business.runtime.agents[0].id, message);
    setBusiness(res.business);
    rememberBusiness(res.business.id);
    setMessage('');
  };

  if (loading) return <LoadingPanel label="Loading business workspace" />;
  if (error || !business) return <ErrorMessage message={error ?? 'Business workspace not found.'} />;

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/businesses" className="text-sm font-medium text-slate-600">← Back to businesses</Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{business.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>{business.city}</span>
              {business.address ? <span>• {business.address}</span> : null}
              {business.websiteUrl ? <a href={business.websiteUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:text-sky-800">{business.websiteUrl}</a> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="green">{business.stage === 'researched' ? 'Workspace ready' : 'Business found'}</StatusPill>
            <StatusPill tone="slate">{business.sources.length} sources</StatusPill>
            {selectedOpportunity ? <StatusPill tone="slate">Plan selected</StatusPill> : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {workspaceTabs.map((tab) => (
            <button key={tab} onClick={() => setSearchParams({ tab })} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${activeTab === tab ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'research' ? <ResearchTab business={business} groupedSources={groupedSources} /> : null}
      {activeTab === 'findings' ? <FindingsTab business={business} evidenceById={evidenceById} sourcesById={sourcesById} /> : null}
      {activeTab === 'plan' ? <PlanTab business={business} selectedOpportunity={selectedOpportunity} evidenceById={evidenceById} sourcesById={sourcesById} onSelectOpportunity={chooseOpportunity} /> : null}
      {activeTab === 'build' ? <BuildTab business={business} message={message} onMessageChange={setMessage} onSendMessage={sendMessage} onUpdateTask={updateTask} selectedOpportunity={selectedOpportunity} /> : null}
      {activeTab === 'live' ? <LiveTab business={business} /> : null}
    </div>
  );
}

function ResearchTab({ business, groupedSources }: { business: Business; groupedSources: ReturnType<typeof groupSources> }) {
  const readiness = business.stage === 'researched';
  return (
    <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <Card title="Research" subtitle={readiness ? 'The business review is complete.' : 'This workspace is ready to be investigated.'}>
        <div className="space-y-5">
          <JourneyList
            items={[
              ['Confirm the business', 'Match the right business, location, and public footprint.'],
              ['Review public sources', 'Read the website, listings, reviews, and other visible signals.'],
              ['Organize what matters', 'Separate meaningful patterns from loose noise.'],
              ['Prepare findings', 'Turn the evidence into a clear point of view for the owner.']
            ]}
          />
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-900">Status</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{readiness ? 'Research is complete and the findings are ready to review.' : 'Start the investigation from the Businesses screen to generate findings and a build plan.'}</p>
            {business.researchMetadata?.plannerQuestions?.length ? <ul className="mt-3 space-y-2 text-sm text-slate-500">{business.researchMetadata.plannerQuestions.slice(0, 4).map((question) => <li key={question}>• {question}</li>)}</ul> : null}
          </div>
        </div>
      </Card>
      <Card title="Sources reviewed" subtitle="Evidence is grouped by source to keep trust visible without clutter.">
        <div className="space-y-4">
          {groupedSources.top.map((group) => (
            <section key={group.key} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-slate-900">{group.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{group.summary}</p>
                </div>
                <span className="text-sm text-slate-400">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-3 space-y-3">
                {group.items.map((source) => <SourceListItem key={source.id} source={source} />)}
              </div>
            </section>
          ))}
          {groupedSources.other.length ? (
            <details className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">View additional sources</summary>
              <div className="mt-3 space-y-3">{groupedSources.other.map((source) => <SourceListItem key={source.id} source={source} />)}</div>
            </details>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function FindingsTab({ business, evidenceById, sourcesById }: { business: Business; evidenceById: Map<string, EvidenceItem>; sourcesById: Map<string, Source> }) {
  const report = business.report;
  if (!report) return <EmptyState copy="Findings will appear here after the investigation runs." />;

  return (
    <div className="space-y-8">
      <Card title="What we found" subtitle="A concise business summary grounded in the public evidence.">
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-base leading-7 text-slate-700">{report.summary}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MiniStat label="Sources reviewed" value={business.sources.length} />
            <MiniStat label="Themes found" value={report.keyThemes.length} />
            <MiniStat label="Opportunities" value={business.opportunities?.length ?? 0} />
          </div>
        </div>
      </Card>

      <div className="grid gap-8 xl:grid-cols-3">
        <SummaryList title="What looks strong" items={report.strengths} emptyCopy="No strengths captured yet." />
        <SummaryList title="What needs attention" items={report.gaps} emptyCopy="No gaps captured yet." />
        <SummaryList title="Why it matters" items={report.marketSignals} emptyCopy="No business implications captured yet." />
      </div>

      <Card title="Evidence-backed findings" subtitle="Each finding includes the supporting business signals and sources.">
        <div className="space-y-6">
          {(business.evidenceItems ?? []).map((item) => (
            <section key={item.id} className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={findingTone(item.sentiment)}>{humanizeFindingType(item.type)}</StatusPill>
                <span className="text-sm text-slate-400">{humanizeStrength(item.strength)} confidence</span>
                <span className="text-sm text-slate-400">score {item.confidence}</span>
                <span className="text-sm text-slate-400">{item.evidenceCount} excerpts</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">{item.statement}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Why it matters: {item.implication}</p>
              {item.supportingExcerpts.length ? <div className="mt-3 space-y-2 text-sm text-slate-500">{item.supportingExcerpts.slice(0, 2).map((excerpt, index) => <p key={`${excerpt.sourceId}-${index}`}>“{excerpt.text}”</p>)}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.sourceIds.map((sourceId) => sourcesById.get(sourceId)).filter(Boolean).map((source) => (
                  <a key={source?.id} href={source?.url} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
                    {source?.title}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
        <details className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">How the findings were assembled</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {report.evidence.map((claim, index) => (
              <div key={`${claim.claim}-${index}`} className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
                <p className="font-medium text-slate-900">{claim.claim}</p>
                <p className="mt-1">Supported by {claim.sourceIds.length} source{claim.sourceIds.length === 1 ? '' : 's'} and {claim.evidenceIds.map((id) => evidenceById.get(id)?.theme).filter(Boolean).join(', ')}.</p>
              </div>
            ))}
          </div>
        </details>
      </Card>
    </div>
  );
}

function PlanTab({ business, selectedOpportunity, evidenceById, sourcesById, onSelectOpportunity }: { business: Business; selectedOpportunity?: Opportunity; evidenceById: Map<string, EvidenceItem>; sourcesById: Map<string, Source>; onSelectOpportunity: (opportunityId: string) => void }) {
  const opportunities = business.opportunities ?? [];
  return (
    <div className="space-y-8">
      <Card title="Opportunities" subtitle="Prioritized ways to improve the business based on the findings.">
        <div className="space-y-6">
          {opportunities.length ? opportunities.map((opportunity, index) => {
            const evidenceItems = opportunity.evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean) as EvidenceItem[];
            const selected = selectedOpportunity?.id === opportunity.id;
            return (
              <section key={opportunity.id} className={`rounded-[24px] border px-5 py-5 ${selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
                      {selected ? <StatusPill tone="green">Selected</StatusPill> : null}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">{opportunity.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Problem: {opportunity.rationale}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">What BusinessForge can build: {describeOpportunityBuild(opportunity, business.category)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MetricChip label={`Impact ${opportunity.impact}`} />
                    <MetricChip label={`Confidence ${opportunity.confidence}`} />
                    <MetricChip label={`Setup ${humanizeEffort(opportunity.effort)}`} />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Evidence</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      {evidenceItems.slice(0, 3).map((item) => <li key={item.id}>{item.statement}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sources</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {uniqueSourcesFromEvidence(evidenceItems, sourcesById).map((source) => (
                        <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{source.title}</a>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={() => onSelectOpportunity(opportunity.id)} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Build this</button>
                  {selected ? <span className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600">Current plan</span> : null}
                </div>
              </section>
            );
          }) : <EmptyState copy="Opportunities will appear here after the investigation is complete." />}
        </div>
      </Card>

      <Card title="Here’s what we’ll build" subtitle="A clear plan for the selected opportunity.">
        {selectedOpportunity && business.buildPlan ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <MiniStat label="Selected plan" value={selectedOpportunity.title} />
              <MiniStat label="Estimated setup" value={humanizeEffort(selectedOpportunity.effort)} />
              <MiniStat label="Uses evidence" value={`${selectedOpportunity.evidenceIds.length} signals`} />
            </div>
            <div className="space-y-4">
              {business.buildPlan.map((step, index) => <BuildPlanRow key={step.id} step={step} index={index} />)}
            </div>
            <details className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">Details</summary>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p>Information used: business profile, public sources, supporting evidence, and the selected improvement path.</p>
                <p>Internal coordination and system setup remain behind the scenes unless you want to inspect them.</p>
              </div>
            </details>
          </div>
        ) : (
          <EmptyState copy="Choose an opportunity first to generate the build plan." />
        )}
      </Card>
    </div>
  );
}

function BuildTab({ business, selectedOpportunity, message, onMessageChange, onSendMessage, onUpdateTask }: { business: Business; selectedOpportunity?: Opportunity; message: string; onMessageChange: (value: string) => void; onSendMessage: () => void; onUpdateTask: (taskId: string, action: 'advance' | 'block') => void }) {
  if (!business.runtime || !selectedOpportunity) return <EmptyState copy="Choose a plan first. Build progress will appear here once a plan is selected." />;

  const visibleTasks = business.runtime.tasks;
  const completedCount = visibleTasks.filter((task) => task.status === 'done').length;

  return (
    <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-8">
        <Card title="Build progress" subtitle="Plain-language progress for the business systems being created.">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">{selectedOpportunity.title}</p>
              <p className="mt-1 text-sm text-slate-500">{completedCount} of {visibleTasks.length} steps completed</p>
            </div>
            <StatusPill tone="orange">{humanizeRuntimeStatus(business.runtime.status)}</StatusPill>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${visibleTasks.length ? (completedCount / visibleTasks.length) * 100 : 0}%` }} /></div>
          <div className="mt-6 space-y-4">
            {visibleTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} onUpdateTask={onUpdateTask} />)}
          </div>
        </Card>

        <Card title="Tell us what to adjust" subtitle="Give a business-facing instruction without dealing with the internal system map.">
          <textarea value={message} onChange={(e) => onMessageChange(e.target.value)} className="min-h-28 w-full rounded-[22px] border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none" placeholder="Example: Emphasize office lunch orders and keep the approval path simple." />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">We keep the internal coordination hidden unless you open Details below.</p>
            <button onClick={onSendMessage} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Send instruction</button>
          </div>
        </Card>
      </div>

      <div className="space-y-8">
        <Card title="What is being created" subtitle="A customer-facing asset taking shape from the selected plan.">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Preview</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{business.runtime.assetPreview.headline}</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{business.runtime.assetPreview.subheadline}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{business.runtime.assetPreview.bullets.map((bullet) => <div key={bullet} className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">{bullet}</div>)}</div>
          </div>
        </Card>

        <details className="rounded-[24px] border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer list-none text-base font-semibold text-slate-950">How it works</summary>
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-sm font-medium text-slate-900">Internal build details</p>
              <div className="mt-3 space-y-3">
                {business.runtime.agents.map((agent) => (
                  <div key={agent.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{agent.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{agent.goal}</p>
                  </div>
                ))}
              </div>
            </div>
            {business.runtime.missingCapabilities.length ? (
              <div>
                <p className="text-sm font-medium text-slate-900">Items still simulated</p>
                <p className="mt-1 text-sm text-slate-600">{business.runtime.missingCapabilities.map(startCase).join(', ')}</p>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

function LiveTab({ business }: { business: Business }) {
  const deployment = business.deployment;
  return (
    <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
      <Card title="Your business systems" subtitle="Understand what is live, what is still moving, and what happened recently.">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {['draft', 'validating', 'deploying', 'live'].map((state) => (
              <StatusPill key={state} tone={deployment?.state === state ? 'orange' : 'slate'}>{humanizeDeploymentState(state)}</StatusPill>
            ))}
          </div>
          <div className="space-y-3">
            {deployment?.history.map((item) => (
              <div key={`${item.at}-${item.state}`} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{humanizeDeploymentState(item.state)}</p>
                  <p className="text-xs text-slate-400">{formatTime(item.at)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <Card title="Ongoing activity" subtitle="A readable activity trail rather than a raw system log.">
          <div className="space-y-3">
            {(business.runtime?.eventLog ?? []).map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        </Card>

        <Card title="Checks" subtitle="What has been validated so far.">
          <div className="space-y-3">
            {(business.runtime?.tests ?? []).map((test) => (
              <div key={test.id} className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium text-slate-900">{test.name}</h3>
                  <StatusPill tone={test.status === 'pass' ? 'green' : 'amber'}>{test.status === 'pass' ? 'Passed' : 'Needs review'}</StatusPill>
                </div>
                <p className="mt-2 text-sm text-slate-600">{test.details}</p>
              </div>
            ))}
            {business.runtime?.buildRuns?.[0] ? <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-medium text-slate-900">Latest build bundle</p><p className="mt-1">{business.runtime.buildRuns[0].artifacts.length} files created in {business.runtime.buildRuns[0].workspaceDir}</p>{business.runtime.buildRuns[0].repairNotes.length ? <p className="mt-2">Repair notes: {business.runtime.buildRuns[0].repairNotes.join(' ')}</p> : null}</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BusinessChooser({ matches, selected, onSelect }: { matches: Business[]; selected: Business | null; onSelect: (business: Business) => void }) {
  if (!matches.length) return <EmptyState copy="No businesses matched that search. Try a broader name, add a location, or include the website." />;
  return (
    <div className="divide-y divide-slate-100">
      {matches.map((match) => {
        const active = selected?.id === match.id;
        return (
          <button key={match.id} onClick={() => onSelect(match)} className={`flex w-full items-start justify-between gap-4 px-1 py-4 text-left ${active ? 'text-slate-950' : 'text-slate-700 hover:text-slate-950'}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{match.name}</h3>
                {active ? <StatusPill tone="green">Selected</StatusPill> : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{match.mode === 'CORPORATION' ? 'Corporation research' : `${match.category} in ${match.city}`}</p>
              {match.address ? <p className="mt-1 text-sm text-slate-500">{match.address}</p> : null}
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{match.description}</p>
            </div>
            <div className="pt-1 text-right text-sm text-slate-400">{match.discoveryScore} match</div>
          </button>
        );
      })}
    </div>
  );
}

function BusinessSnapshot({ business }: { business: Business }) {
  return (
    <div className="space-y-4 rounded-[22px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="slate">{business.mode === 'CORPORATION' ? 'Corporation' : business.category}</StatusPill>
        <StatusPill tone="slate">{business.city}</StatusPill>
        <StatusPill tone="slate">{business.sources.length} sources</StatusPill>
      </div>
      <p className="text-sm leading-6 text-slate-600">{business.description}</p>
      {business.researchMetadata?.sampleNote ? <p className="text-sm text-slate-500">{business.researchMetadata.sampleNote}</p> : null}
      {business.websiteUrl ? <a href={business.websiteUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-700">View website</a> : null}
    </div>
  );
}

function ResearchRunPanel({ run }: { run: ResearchResponse }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
        <span>{humanizeResearchStage(run.currentStage)}</span>
        <span>{run.progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${run.progress}%` }} /></div>
      <p className="mt-3 text-sm text-slate-600">We&apos;re resolving identity, filtering sources, and keeping the findings traceable to retrieved evidence.</p>
    </div>
  );
}

function BusinessList({ businesses, emptyCopy, showStage = false }: { businesses: Business[]; emptyCopy: string; showStage?: boolean }) {
  if (!businesses.length) return <EmptyState copy={emptyCopy} />;
  return (
    <div className="divide-y divide-slate-100">
      {businesses.map((business) => (
        <Link key={business.id} to={`/workspace/${business.id}?tab=${business.stage === 'researched' ? 'findings' : 'research'}`} className="flex items-start justify-between gap-4 px-1 py-4 hover:bg-slate-50">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-slate-900">{business.name}</h3>
              {showStage ? <StatusPill tone={business.stage === 'researched' ? 'green' : 'slate'}>{business.stage === 'researched' ? 'Ready' : 'Found'}</StatusPill> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">{business.mode === 'CORPORATION' ? 'Corporation research' : `${business.category} in ${business.city}`}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{business.report?.summary ?? business.description}</p>
          </div>
          <span className="pt-1 text-sm text-slate-400">Open</span>
        </Link>
      ))}
    </div>
  );
}

function BuildPlanRow({ step, index }: { step: BuildPlanStep; index: number }) {
  return (
    <div className="flex gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{step.title}</p>
          <StatusPill tone={step.status === 'done' ? 'green' : step.status === 'doing' ? 'orange' : 'slate'}>{humanizePlanStatus(step.status)}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-slate-600">{step.outcome}</p>
        <p className="mt-1 text-sm text-slate-500">Led by {step.owner}</p>
      </div>
    </div>
  );
}

function TaskRow({ task, index, onUpdateTask }: { task: AgentTask; index: number; onUpdateTask: (taskId: string, action: 'advance' | 'block') => void }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
            <h3 className="font-medium text-slate-900">{humanizeTaskTitle(task.title)}</h3>
            <StatusPill tone={task.status === 'done' ? 'green' : task.status === 'blocked' ? 'amber' : task.status === 'running' ? 'orange' : 'slate'}>{humanizeTaskStatus(task.status)}</StatusPill>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{humanizeTaskNotes(task.notes)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onUpdateTask(task.id, 'advance')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Advance</button>
          <button onClick={() => onUpdateTask(task.id, 'block')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Needs review</button>
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: RuntimeEvent }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-700">{humanizeEventText(event)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{humanizeEventType(event.type)}</p>
        </div>
        <p className="whitespace-nowrap text-xs text-slate-400">{formatTime(event.at)}</p>
      </div>
    </div>
  );
}

function SummaryList({ title, items, emptyCopy }: { title: string; items: string[]; emptyCopy: string }) {
  return (
    <Card title={title}>
      {items.length ? (
        <ul className="space-y-3 text-sm text-slate-600">{items.map((item) => <li key={item} className="leading-6">{item}</li>)}</ul>
      ) : <EmptyState copy={emptyCopy} />}
    </Card>
  );
}

function SourceListItem({ source }: { source: Source }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-slate-900">{source.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">{source.excerpt}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill tone="slate">{formatSourceKind(source.kind)}</StatusPill>
          <span className="text-xs text-slate-400">{source.provenance.toLowerCase().replace(/_/g, ' ')}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>match {source.entityConfidence}</span>
        <span>quality {source.qualityScore}</span>
        <span>relevance {source.relevanceScore}</span>
      </div>
      {source.evidence.length ? <ul className="mt-3 space-y-2 text-sm text-slate-500">{source.evidence.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700">View source</a>
    </div>
  );
}

function JourneyList({ items }: { items: [string, string][] }) {
  return (
    <ol className="space-y-4">
      {items.map(([title, copy], index) => (
        <li key={title} className="flex gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
          <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
          <div>
            <p className="font-medium text-slate-900">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function InlineNote({ children }: { children: ReactNode }) {
  return <div className="mb-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{children}</div>;
}

function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300" />
    </label>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="rounded-[24px] border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><LiveDot active /><p className="font-medium text-slate-700">{label}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-slate-900" /></div></div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}

function EmptyState({ copy }: { copy: string }) {
  return <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">{copy}</div>;
}

function LiveDot({ active = false }: { active?: boolean }) {
  return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${active ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-[18px] border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-lg font-semibold text-slate-950">{value}</p></div>;
}

function MetricChip({ label }: { label: string }) {
  return <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{label}</span>;
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'slate' | 'green' | 'amber' | 'orange' }) {
  const tones = { slate: 'border-slate-200 bg-slate-100 text-slate-700', green: 'border-emerald-200 bg-emerald-50 text-emerald-700', amber: 'border-amber-200 bg-amber-50 text-amber-700', orange: 'border-orange-200 bg-orange-50 text-orange-700' } as const;
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function useRecentBusinesses() {
  const [ids, setIds] = useState<string[]>(() => readRecentBusinessIds());
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    const sync = () => setIds(readRecentBusinessIds());
    window.addEventListener('storage', sync);
    window.addEventListener('businessforge:recent-businesses', sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('businessforge:recent-businesses', sync as EventListener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!ids.length) {
      setBusinesses([]);
      return;
    }
    Promise.all(ids.map((id) => api.getBusiness(id).catch(() => null))).then((items) => {
      if (cancelled) return;
      setBusinesses(items.filter(Boolean) as Business[]);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return businesses;
}

function readRecentBusinessIds() {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(recentBusinessKey);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function rememberBusiness(businessId: string) {
  if (typeof window === 'undefined') return;
  const next = [businessId, ...readRecentBusinessIds().filter((id) => id !== businessId)].slice(0, 8);
  window.localStorage.setItem(recentBusinessKey, JSON.stringify(next));
  window.dispatchEvent(new Event('businessforge:recent-businesses'));
}

function toDiscoveryParams(draft: SearchDraft) {
  const params = new URLSearchParams();
  params.set('q', draft.query);
  params.set('mode', draft.mode);
  if (draft.websiteUrl.trim()) params.set('website', draft.websiteUrl.trim());
  if (draft.locationText.trim()) params.set('location', draft.locationText.trim());
  if (draft.coordinates) {
    params.set('lat', String(draft.coordinates.latitude));
    params.set('lng', String(draft.coordinates.longitude));
  }
  return params;
}

function groupSources(sources: Source[]) {
  const groups = Array.from(sources.reduce((map, source) => {
    const hostname = safeHostname(source.url) || source.kind || 'Source';
    const key = hostname.replace(/^www\./, '');
    const existing = map.get(key) ?? { key, label: key, badge: key.slice(0, 2).toUpperCase(), items: [] as Source[] };
    existing.items.push(source);
    map.set(key, existing);
    return map;
  }, new Map<string, { key: string; label: string; badge: string; items: Source[] }>()).values())
    .map((group) => ({
      ...group,
      label: group.label,
      summary: summarizeGroup(group.items)
    }))
    .sort((a, b) => b.items.length - a.items.length);
  return {
    top: groups.slice(0, 5),
    other: groups.slice(5).flatMap((group) => group.items)
  };
}

function summarizeGroup(items: Source[]) {
  const snippets = items.flatMap((item) => item.evidence).slice(0, 2);
  return snippets.join(' • ') || items[0]?.excerpt || 'Public source material collected';
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function uniqueSourcesFromEvidence(items: EvidenceItem[], sourcesById: Map<string, Source>) {
  const seen = new Set<string>();
  const sources: Source[] = [];
  items.forEach((item) => item.sourceIds.forEach((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (source && !seen.has(source.id)) {
      seen.add(source.id);
      sources.push(source);
    }
  }));
  return sources;
}

function formatSourceKind(kind: string) {
  const label = {
    website: 'Website',
    review: 'Reviews',
    directory: 'Directory',
    social: 'Social',
    news: 'News',
    search: 'Search',
    menu: 'Menu',
    operations: 'Operations'
  }[kind as 'website' | 'review' | 'directory' | 'social' | 'news' | 'search' | 'menu' | 'operations'];
  return label ?? startCase(kind);
}

function findingTone(sentiment: string): 'slate' | 'green' | 'amber' | 'orange' {
  if (sentiment === 'positive') return 'green';
  if (sentiment === 'negative') return 'amber';
  if (sentiment === 'mixed') return 'orange';
  return 'slate';
}

function humanizeResearchStage(stage: string) {
  const map: Record<string, string> = {
    'Resolving business profile': 'Confirming the business and its public footprint',
    'Normalizing source findings': 'Reviewing public sources',
    'Synthesizing evidence model': 'Organizing the findings',
    'Prioritizing opportunities': 'Deciding what matters most',
    'Preparing agent runtime': 'Preparing the build plan',
    Complete: 'Investigation complete'
  };
  return map[stage] ?? 'Reviewing the business';
}

function humanizeFindingType(type: string) {
  const map: Record<string, string> = {
    demand: 'Demand signal',
    friction: 'Friction',
    offer: 'Offer',
    operations: 'Operations',
    proof: 'Proof',
    audience: 'Audience'
  };
  return map[type] ?? startCase(type);
}

function humanizeStrength(strength: string) {
  const map: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Light' };
  return map[strength] ?? startCase(strength);
}

function humanizeEffort(effort: string) {
  const map: Record<string, string> = { low: 'Light', medium: 'Moderate', high: 'Substantial' };
  return map[effort] ?? startCase(effort);
}

function describeOpportunityBuild(opportunity: Opportunity, category: string) {
  if (opportunity.category === 'conversion') {
    return category === 'restaurant'
      ? 'A clearer offer, stronger order path, and a simpler way for buyers to act.'
      : 'A guided customer path with clearer messaging, stronger proof, and a simpler next step.';
  }
  if (opportunity.category === 'acquisition') return 'A repeatable promotion system tied to the signals already getting attention.';
  return 'A cleaner handoff and follow-up system so the business can respond more consistently.';
}

function humanizePlanStatus(status: string) {
  const map: Record<string, string> = { todo: 'Not started', ready: 'Ready', doing: 'In progress', done: 'Complete' };
  return map[status] ?? startCase(status);
}

function humanizeTaskTitle(title: string) {
  return title.replace(/^Execute /, '').replace(/ workflow$/i, '').replace(/^Frame /, '').trim().replace(/-/g, ' ');
}

function humanizeTaskStatus(status: string) {
  const map: Record<string, string> = { queued: 'Waiting', running: 'In progress', blocked: 'Needs review', done: 'Complete' };
  return map[status] ?? startCase(status);
}

function humanizeTaskNotes(notes: string) {
  return notes
    .replace('Marked complete from the live dashboard.', 'Marked complete from this workspace.')
    .replace('Pulled into active execution.', 'Work has started on this step.')
    .replace('Blocked manually from the live dashboard for operator review.', 'This step was paused for review.')
    .replace('Evidence-linked thesis published.', 'The initial direction has been set.')
    .replace('Waiting on upstream handoff.', 'Waiting for the earlier step to finish.')
    .replace(/Working on /, 'Currently building ')
    .replace(/Pulled into execution after .* reviewed operator input\./, 'Moved into active work after your instruction was reviewed.');
}

function humanizeRuntimeStatus(status: string) {
  const map: Record<string, string> = { executing: 'Building', stable: 'Running', ready: 'Ready', idle: 'Not started' };
  return map[status] ?? startCase(status);
}

function humanizeDeploymentState(state: string) {
  const map: Record<string, string> = { draft: 'Draft', validating: 'Checking', deploying: 'Going live', live: 'Live' };
  return map[state] ?? startCase(state);
}

function humanizeEventType(type: string) {
  const map: Record<string, string> = {
    'task-update': 'Progress update',
    handoff: 'Handoff',
    interaction: 'Instruction received',
    'capability-request': 'External coverage note',
    system: 'System update'
  };
  return map[type] ?? startCase(type);
}

function humanizeEventText(event: RuntimeEvent) {
  return event.text
    .replace('Research evidence normalized into structured findings.', 'Research findings were organized and prepared for review.')
    .replace(/Selected opportunity mapped into .* agent roles for /, 'The selected plan was translated into a working build sequence for ')
    .replace('Primary execution task is in progress.', 'The first major build step is underway.')
    .replace(/ updated to done\./, ' was marked complete.')
    .replace(/ updated to running\./, ' is now in progress.')
    .replace(/ updated to blocked\./, ' was paused for review.')
    .replace('Operator message routed to', 'Your instruction was sent to')
    .replace('requested missing capability coverage for', 'flagged external coverage still needed for')
    .replace('pulled', 'moved')
    .replace('into active execution.', 'into active work.');
}

function toPlainError(message: string, fallback: string) {
  return message.startsWith('Request failed:') ? fallback : message;
}

function formatTime(at: string) {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function startCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
