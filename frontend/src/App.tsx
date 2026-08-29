import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from './components/Card';
import { api } from './lib/api';
import type { AgentDefinition, Business, DiscoveryInput, DiscoveryResponse, Opportunity, ResearchResponse, Source } from './lib/types';

const defaultQuery = "McDonald's";
const tabs = ['overview', 'sources', 'opportunities', 'agents', 'activity'] as const;
type WorkspaceTab = (typeof tabs)[number];

export default function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.14),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_24%),linear-gradient(180deg,_#fffdf8_0%,_#f8fafc_48%,_#f6f7fb_100%)] text-slate-900">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/workspace/:businessId" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState(defaultQuery);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [locationText, setLocationText] = useState('');
  const [coordinates, setCoordinates] = useState<DiscoveryInput['coordinates']>();
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');

  const submit = () => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (websiteUrl.trim()) params.set('website', websiteUrl.trim());
    if (locationText.trim()) params.set('location', locationText.trim());
    if (coordinates) {
      params.set('lat', String(coordinates.latitude));
      params.set('lng', String(coordinates.longitude));
    }
    navigate(`/results?${params.toString()}`);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoState('error');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationText('Near me');
        setGeoState('ready');
      },
      () => setGeoState('error'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-7 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
              BusinessForge <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live discovery
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Search real local businesses, then build a focused growth workspace.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Start with a business name, city, or near-me search. BusinessForge now uses live public place search first, with website research and fallback synthesis behind it.
            </p>
          </div>

          <div className="grid gap-3 rounded-[1.75rem] border border-slate-200/80 bg-slate-50/80 p-4">
            <SearchField label="Business" value={query} onChange={setQuery} placeholder="McDonald's, North Star Dental, coffee shop" />
            <SearchField label="Place" value={locationText} onChange={setLocationText} placeholder="Seattle, Austin, or leave blank and use Near me" />
            <SearchField label="Website" value={websiteUrl} onChange={setWebsiteUrl} placeholder="Optional public website" />
            <div className="flex flex-wrap gap-3 pt-1">
              <button onClick={submit} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Find businesses</button>
              <button onClick={useMyLocation} className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700">
                {geoState === 'locating' ? 'Locating…' : geoState === 'ready' ? 'Using your location' : 'Near me'}
              </button>
            </div>
            <p className="text-sm text-slate-500">
              {geoState === 'error' ? 'Location access was unavailable. You can still search by city or region.' : 'Try “McDonald\'s” plus Near me to pull nearby candidates from public map data.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Business | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [run, setRun] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const input = useMemo<DiscoveryInput>(() => ({
    query: searchParams.get('q') ?? '',
    websiteUrl: searchParams.get('website') ?? undefined,
    locationText: searchParams.get('location') === 'Near me' ? undefined : searchParams.get('location') ?? undefined,
    coordinates: searchParams.get('lat') && searchParams.get('lng')
      ? { latitude: Number(searchParams.get('lat')), longitude: Number(searchParams.get('lng')) }
      : undefined
  }), [searchParams]);

  useEffect(() => {
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
      .catch((err: Error) => !cancelled && setError(err.message))
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
        navigate(`/workspace/${next.business.id}?tab=overview`);
      }
    }, 900);
    return () => clearInterval(timer);
  }, [navigate, run]);

  const startResearch = async () => {
    if (!selected) return;
    setRun(await api.startResearch(selected.id));
  };

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Results</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Choose the business to analyze</h1>
        </div>
        <Link to="/" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">New search</Link>
      </div>

      {suggestion ? <p className="mt-4 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">{suggestion}</p> : null}
      {error ? <p className="mt-4 rounded-full bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Candidate matches" subtitle="Live provider-backed results first, graceful fallback second">
          <div className="space-y-3">
            {loading ? <LoadingPanel label="Searching public place providers" /> : null}
            {!loading && !matches.length ? <EmptyState copy="No candidates came back. Try a broader name, add a city, or use Near me." /> : null}
            {matches.map((match) => {
              const active = selected?.id === match.id;
              return (
                <button key={match.id} onClick={() => setSelected(match)} className={`w-full rounded-3xl border p-5 text-left transition ${active ? 'border-orange-300 bg-orange-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{match.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{match.category} in {match.city}</p>
                      {match.address ? <p className="mt-2 text-sm text-slate-500">{match.address}</p> : null}
                      {match.websiteUrl ? <p className="mt-2 text-sm text-sky-700">{match.websiteUrl}</p> : null}
                    </div>
                    <div className="text-right">
                      <StatusPill tone={active ? 'orange' : 'slate'}>{match.discoveryScore} match</StatusPill>
                      {match.discoveryProvider ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{match.discoveryProvider}</p> : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{match.description}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={selected?.name ?? 'Selection'} subtitle={selected ? 'Run analysis to open the workspace' : 'Pick a business first'}>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="green">{selected.stage}</StatusPill>
                  <StatusPill tone="slate">{selected.researchBasis ?? 'provider'}</StatusPill>
                  <StatusPill tone="slate">{selected.sources.length} source{selected.sources.length === 1 ? '' : 's'}</StatusPill>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{selected.description}</p>
              </div>
              {run ? (
                <div className="rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white p-5">
                  <div className="flex items-center justify-between text-sm text-slate-600"><span>{run.currentStage}</span><span>{run.progress}%</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${run.progress}%` }} /></div>
                  <p className="mt-3 text-sm text-slate-600">Provider: {run.run.provider}</p>
                </div>
              ) : null}
              <button onClick={startResearch} disabled={!selected || Boolean(run && run.run.status !== 'complete')} className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {run && run.run.status !== 'complete' ? 'Building workspace…' : 'Run analysis'}
              </button>
            </div>
          ) : <EmptyState copy="Select a match from the left to continue." />}
        </Card>
      </div>
    </Shell>
  );
}

function WorkspacePage() {
  const { businessId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentMessage, setAgentMessage] = useState('Review the active handoff and call out what still needs operator attention.');

  const activeTab = (searchParams.get('tab') as WorkspaceTab) || 'overview';
  const selectedOpportunity = business?.opportunities?.find((opp) => opp.id === business.selectedOpportunityId);
  const sourceGroups = useMemo(() => groupSources(business?.sources ?? []), [business?.sources]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getBusiness(businessId).then((next) => {
      if (cancelled) return;
      setBusiness(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, location.key]);

  const chooseOpportunity = async (opportunityId: string) => {
    if (!business) return;
    const next = await api.selectOpportunity(business.id, opportunityId);
    setBusiness(next);
    setSearchParams({ tab: 'agents' });
  };

  const updateTask = async (taskId: string, action: 'advance' | 'block') => {
    if (!business) return;
    setBusiness(await api.updateTask(business.id, taskId, action));
  };

  const interact = async () => {
    if (!business?.runtime?.agents.length || !agentMessage.trim()) return;
    const res = await api.interact(business.id, business.runtime.agents[0].id, agentMessage);
    setBusiness(res.business);
    setAgentMessage('');
  };

  return (
    <Shell>
      {loading || !business ? <LoadingPanel label="Loading workspace" /> : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link to="/results" className="text-sm font-medium text-sky-700">← Back to results</Link>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{business.name}</h1>
              <p className="mt-2 text-sm text-slate-500">{business.category} in {business.city}{business.address ? ` · ${business.address}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="green">{business.stage}</StatusPill>
              <StatusPill tone="slate">{business.researchBasis ?? 'provider'}</StatusPill>
              {business.discoveryProvider ? <StatusPill tone="slate">{business.discoveryProvider}</StatusPill> : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setSearchParams({ tab })} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${activeTab === tab ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-6">
            {activeTab === 'overview' ? <OverviewTab business={business} selectedOpportunity={selectedOpportunity} onSelectOpportunity={chooseOpportunity} /> : null}
            {activeTab === 'sources' ? <SourcesTab groups={sourceGroups} /> : null}
            {activeTab === 'opportunities' ? <OpportunitiesTab business={business} selectedOpportunityId={business.selectedOpportunityId} onSelectOpportunity={chooseOpportunity} /> : null}
            {activeTab === 'agents' ? <AgentsTab business={business} onUpdateTask={updateTask} agentMessage={agentMessage} onAgentMessage={setAgentMessage} onInteract={interact} /> : null}
            {activeTab === 'activity' ? <ActivityTab business={business} /> : null}
          </div>
        </>
      )}
    </Shell>
  );
}

function OverviewTab({ business, selectedOpportunity, onSelectOpportunity }: { business: Business; selectedOpportunity?: Opportunity; onSelectOpportunity: (opportunityId: string) => void; }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card title="Overview" subtitle="A lighter workspace with just the useful signals">
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniStat label="Sources" value={business.sources.length} />
          <MiniStat label="Opportunities" value={business.opportunities?.length ?? 0} />
          <MiniStat label="Active agents" value={business.runtime?.agents.length ?? 0} />
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-600">{business.report?.summary ?? business.description}</p>
        {selectedOpportunity ? (
          <div className="mt-5 rounded-3xl border border-orange-100 bg-orange-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Current focus</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">{selectedOpportunity.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{selectedOpportunity.rationale}</p>
          </div>
        ) : null}
      </Card>

      <Card title="Suggested paths" subtitle="Pick a path to move into the focused agent workspace">
        <OpportunitiesList opportunities={business.opportunities ?? []} selectedOpportunityId={business.selectedOpportunityId} onSelectOpportunity={onSelectOpportunity} compact />
      </Card>
    </div>
  );
}

function SourcesTab({ groups }: { groups: ReturnType<typeof groupSources>; }) {
  return (
    <div className="space-y-6">
      <Card title="Top sources" subtitle="Grouped by site, with the clearest public evidence surfaced first">
        <div className="space-y-3">
          {groups.top.map((group) => (
            <details key={group.key} className="group rounded-3xl border border-slate-200 bg-white p-5" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">{group.badge}</div>
                  <div>
                    <h3 className="font-semibold text-slate-950">{group.label}</h3>
                    <p className="text-sm text-slate-500">{group.summary}</p>
                  </div>
                </div>
                <StatusPill tone="slate">{group.items.length} page{group.items.length === 1 ? '' : 's'}</StatusPill>
              </summary>
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                {group.items.map((source) => <SourceRow key={source.id} source={source} />)}
              </div>
            </details>
          ))}
        </div>
      </Card>

      {groups.other.length ? (
        <Card title="Other sources" subtitle="Remaining source material grouped together to keep the view clean">
          <div className="space-y-3">{groups.other.map((source) => <SourceRow key={source.id} source={source} />)}</div>
        </Card>
      ) : null}
    </div>
  );
}

function OpportunitiesTab({ business, selectedOpportunityId, onSelectOpportunity }: { business: Business; selectedOpportunityId?: string; onSelectOpportunity: (opportunityId: string) => void; }) {
  return (
    <Card title="Opportunities" subtitle="Evidence-backed paths you can branch into">
      <OpportunitiesList opportunities={business.opportunities ?? []} selectedOpportunityId={selectedOpportunityId} onSelectOpportunity={onSelectOpportunity} />
    </Card>
  );
}

function AgentsTab({ business, onUpdateTask, agentMessage, onAgentMessage, onInteract }: { business: Business; onUpdateTask: (taskId: string, action: 'advance' | 'block') => void; agentMessage: string; onAgentMessage: (value: string) => void; onInteract: () => void; }) {
  if (!business.runtime) return <EmptyState copy="Select an opportunity to build the live agent workspace." />;
  const activeCount = business.runtime.tasks.filter((task) => task.status === 'running').length;
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Card title="Agent build" subtitle="Visible emergence, handoffs, and execution status">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-center justify-between text-sm text-slate-600"><span>Runtime status</span><span>{business.runtime.status}</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Agents" value={business.runtime.agents.length} />
                <MiniStat label="Running" value={activeCount} />
                <MiniStat label="Waiting" value={business.runtime.tasks.filter((task) => task.status === 'queued').length} />
              </div>
            </div>
            {business.runtime.agents.map((agent, index) => <AgentCard key={agent.id} agent={agent} index={index} />)}
          </div>
        </Card>

        <Card title="Live interaction" subtitle="Operator messages route into the current runtime graph">
          <textarea value={agentMessage} onChange={(e) => onAgentMessage(e.target.value)} className="min-h-28 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{business.runtime.missingCapabilities.length ? `Still simulated externally: ${business.runtime.missingCapabilities.join(', ')}` : 'No missing internal runtime capabilities for the selected path.'}</p>
            <button onClick={onInteract} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Send</button>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Agent tasks" subtitle="Handoffs, execution, and operator controls">
          <div className="space-y-3">
            {business.runtime.tasks.map((task, index) => (
              <div key={task.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3"><LiveDot active={task.status === 'running'} /><h3 className="font-semibold text-slate-950">{index + 1}. {task.title}</h3><StatusPill tone={task.status === 'done' ? 'green' : task.status === 'blocked' ? 'amber' : task.status === 'running' ? 'orange' : 'slate'}>{task.status}</StatusPill></div>
                    <p className="mt-2 text-sm text-slate-500">{task.agentId}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{task.notes}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onUpdateTask(task.id, 'advance')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Advance</button>
                    <button onClick={() => onUpdateTask(task.id, 'block')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Block</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Current output" subtitle="Focused artifact preview for the selected opportunity">
          <div className="rounded-[1.75rem] border border-orange-100 bg-[linear-gradient(180deg,_#fff7ed_0%,_#ffffff_40%,_#fffaf5_100%)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Preview</p>
            <h3 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{business.runtime.assetPreview.headline}</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{business.runtime.assetPreview.subheadline}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{business.runtime.assetPreview.bullets.map((bullet) => <div key={bullet} className="rounded-2xl border border-white bg-white/80 p-4 text-sm text-slate-700">{bullet}</div>)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActivityTab({ business }: { business: Business; }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card title="Recent activity" subtitle="System and agent events only, without extra noise">
        <div className="space-y-3">
          {business.runtime?.eventLog.map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm text-slate-700">{event.text}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{event.type} · {event.actor}</p>
              </div>
              <p className="whitespace-nowrap text-xs text-slate-400">{new Date(event.at).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Launch state" subtitle="Deployment and validation at a glance">
        <div className="flex flex-wrap gap-2">{['draft', 'validating', 'deploying', 'live'].map((state) => <StatusPill key={state} tone={business.deployment?.state === state ? 'orange' : 'slate'}>{state}</StatusPill>)}</div>
        <div className="mt-4 space-y-3">{business.deployment?.history.map((item) => <div key={`${item.at}-${item.state}`} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-900 capitalize">{item.state}</p><p className="text-xs text-slate-400">{new Date(item.at).toLocaleTimeString()}</p></div><p className="mt-1 text-sm text-slate-600">{item.note}</p></div>)}</div>
        <div className="mt-5 space-y-3">{business.runtime?.tests.map((test) => <div key={test.id} className="rounded-3xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{test.name}</h3><StatusPill tone={test.status === 'pass' ? 'green' : 'amber'}>{test.status}</StatusPill></div><p className="mt-2 text-sm text-slate-600">{test.details}</p></div>)}</div>
      </Card>
    </div>
  );
}

function Shell({ children }: { children: ReactNode; }) {
  return <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>;
}

function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
    </label>
  );
}

function OpportunitiesList({ opportunities, selectedOpportunityId, onSelectOpportunity, compact = false }: { opportunities: NonNullable<Business['opportunities']>; selectedOpportunityId?: string; onSelectOpportunity: (opportunityId: string) => void; compact?: boolean; }) {
  return (
    <div className="space-y-3">
      {opportunities.map((opp, index) => {
        const selected = opp.id === selectedOpportunityId;
        return (
          <button key={opp.id} onClick={() => onSelectOpportunity(opp.id)} className={`w-full rounded-3xl border p-5 text-left ${selected ? 'border-orange-300 bg-orange-50/70' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3"><span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">0{index + 1}</span>{selected ? <StatusPill tone="orange">Selected</StatusPill> : null}</div>
                <h3 className={`mt-3 font-semibold text-slate-950 ${compact ? 'text-lg' : 'text-xl'}`}>{opp.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{opp.rationale}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MetricChip label={`Impact ${opp.impact}`} />
                <MetricChip label={`Confidence ${opp.confidence}`} />
                <MetricChip label={opp.effort} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SourceRow({ source }: { source: Source; }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900">{source.title}</h4>
          <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs uppercase tracking-[0.16em] text-sky-700">Open source</a>
        </div>
        <StatusPill tone="slate">{source.kind}</StatusPill>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{source.excerpt}</p>
      <div className="mt-3 flex flex-wrap gap-2">{source.evidence.map((item) => <MetricChip key={item} label={item} />)}</div>
    </div>
  );
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

function AgentCard({ agent, index }: { agent: AgentDefinition; index: number; }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">{index + 1}</div><div><h3 className="font-semibold text-slate-950">{agent.name}</h3><p className="text-sm text-slate-500">{agent.role}</p></div></div><p className="mt-3 text-sm leading-6 text-slate-600">{agent.goal}</p></div><div className="flex items-center gap-2"><LiveDot active={index < 2} /><StatusPill tone={index < 2 ? 'orange' : 'slate'}>{index < 2 ? 'emerging' : 'queued'}</StatusPill></div></div><div className="mt-4 flex flex-wrap gap-2">{agent.outputs.map((output) => <MetricChip key={output} label={output} />)}</div></div>;
}

function LoadingPanel({ label }: { label: string; }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><LiveDot active /><p className="font-medium text-slate-700">{label}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-orange-500 to-sky-400" /></div></div>;
}

function EmptyState({ copy }: { copy: string; }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-sm text-slate-500">{copy}</div>;
}

function LiveDot({ active = false }: { active?: boolean; }) {
  return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${active ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />;
}

function MiniStat({ label, value }: { label: string; value: string | number; }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold text-slate-950">{value}</p></div>;
}

function MetricChip({ label }: { label: string; }) {
  return <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{label}</span>;
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'slate' | 'green' | 'amber' | 'orange'; }) {
  const tones = { slate: 'border-slate-200 bg-slate-100 text-slate-700', green: 'border-emerald-200 bg-emerald-50 text-emerald-700', amber: 'border-amber-200 bg-amber-50 text-amber-700', orange: 'border-orange-200 bg-orange-50 text-orange-700' } as const;
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${tones[tone]}`}>{children}</span>;
}
