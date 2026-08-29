import { useEffect, useMemo, useState } from 'react';
import { Card } from './components/Card';
import { api } from './lib/api';
import type { Business, ResearchResponse } from './lib/types';

const defaultQuery = "Joe's Pizza";

export default function App() {
  const [query, setQuery] = useState(defaultQuery);
  const [business, setBusiness] = useState<Business | null>(null);
  const [run, setRun] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const selectedOpportunity = useMemo(
    () => business?.opportunities?.find((opp) => opp.id === business.selectedOpportunityId),
    [business]
  );

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.discover(query);
      setBusiness(res.matches[0] ?? null);
      setSuggestion(res.suggestion);
      setRun(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const startResearch = async () => {
    if (!business) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.startResearch(business.id);
      setRun(res);
      setBusiness(res.business);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
  }, []);

  useEffect(() => {
    if (!run || run.run.status === 'complete') return;
    const timer = setInterval(async () => {
      const next = await api.getResearch(run.run.id);
      setRun(next);
      setBusiness(next.business);
    }, 900);
    return () => clearInterval(timer);
  }, [run]);

  const chooseOpportunity = async (opportunityId: string) => {
    if (!business) return;
    const next = await api.selectOpportunity(business.id, opportunityId);
    setBusiness(next);
  };

  const updateTask = async (taskId: string, action: 'advance' | 'block') => {
    if (!business) return;
    const next = await api.updateTask(business.id, taskId, action);
    setBusiness(next);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-950 p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-orange-300">BusinessForge</p>
              <h1 className="mt-2 text-4xl font-bold text-white">Turn business research into a live agent execution plan</h1>
              <p className="mt-3 max-w-3xl text-slate-300">A real demo-mode vertical slice: discover a business, run staged research, inspect source-backed intelligence, choose an opportunity, generate a dynamic agent architecture, and operate the runtime from a live dashboard.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
              Demo data included, no API keys required.
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500"
              placeholder="Search for a local business"
            />
            <button onClick={search} disabled={loading} className="rounded-2xl bg-orange-500 px-5 py-3 font-medium text-slate-950 hover:bg-orange-400 disabled:opacity-50">
              {loading ? 'Working...' : 'Search'}
            </button>
            <button onClick={startResearch} disabled={!business || loading} className="rounded-2xl border border-orange-400/40 bg-orange-500/10 px-5 py-3 font-medium text-orange-200 hover:bg-orange-500/20 disabled:opacity-50">
              Run research
            </button>
          </div>
          {suggestion ? <p className="mt-3 text-sm text-slate-400">{suggestion}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </header>

        {business ? (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Card title={business.name} subtitle={`${business.category} • ${business.city}`} right={<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">demo target</span>}>
                <p className="text-slate-300">{business.description}</p>
              </Card>

              <Card title="Research run" subtitle="Staged progress with realistic demo orchestration">
                {run ? (
                  <div className="space-y-3">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-orange-500" style={{ width: `${run.progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span>{run.currentStage}</span>
                      <span>{run.progress}%</span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status: {run.run.status}</p>
                  </div>
                ) : (
                  <p className="text-slate-400">Search Joe&apos;s Pizza, then run research to unlock the full flow.</p>
                )}
              </Card>

              <Card title="Source explorer" subtitle="Inspectable evidence behind every conclusion">
                <div className="grid gap-3 md:grid-cols-2">
                  {business.sources.map((source) => (
                    <div key={source.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium text-white">{source.title}</h3>
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{source.kind}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{source.excerpt}</p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                        {source.evidence.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>

              {business.report ? (
                <Card title="Intelligence report" subtitle="Evidence-backed synthesis">
                  <p className="text-slate-200">{business.report.summary}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <List title="Strengths" items={business.report.strengths} />
                    <List title="Gaps" items={business.report.gaps} />
                    <List title="Signals" items={business.report.marketSignals} />
                  </div>
                  <div className="mt-4 space-y-2">
                    {business.report.evidence.map((item) => (
                      <div key={item.claim} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
                        <p className="text-slate-200">{item.claim}</p>
                        <p className="mt-1 text-slate-400">Sources: {item.sourceIds.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {business.opportunities ? (
                <Card title="Opportunity selection" subtitle="Choose the highest-leverage wedge">
                  <div className="space-y-3">
                    {business.opportunities.map((opp) => {
                      const selected = opp.id === business.selectedOpportunityId;
                      return (
                        <button key={opp.id} onClick={() => chooseOpportunity(opp.id)} className={`w-full rounded-2xl border p-4 text-left ${selected ? 'border-orange-400 bg-orange-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-medium text-white">{opp.title}</h3>
                            <div className="flex gap-2 text-xs text-slate-300">
                              <Chip label={`Impact ${opp.impact}`} />
                              <Chip label={`Confidence ${opp.confidence}`} />
                              <Chip label={opp.effort} />
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{opp.rationale}</p>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              {selectedOpportunity && business.buildPlan ? (
                <Card title="Build plan" subtitle={`Generated from ${selectedOpportunity.title}`}>
                  <div className="space-y-3">
                    {business.buildPlan.map((step) => (
                      <div key={step.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-medium text-white">{step.title}</h3>
                          <Chip label={step.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Owner: {step.owner}</p>
                        <p className="text-sm text-slate-300">{step.outcome}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {business.runtime ? (
                <>
                  <Card title="Dynamic agent architecture" subtitle="Structured runtime graph, generated from the selected opportunity">
                    <pre className="overflow-auto rounded-2xl bg-slate-950/80 p-4 text-xs text-emerald-300">{JSON.stringify(business.runtime.agents, null, 2)}</pre>
                  </Card>

                  <Card title="Generated asset preview" subtitle="One tangible artifact from the runtime">
                    <div className="rounded-3xl border border-orange-500/20 bg-white p-6 text-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">Joe&apos;s Pizza</p>
                      <h3 className="mt-3 text-3xl font-bold">{business.runtime.assetPreview.headline}</h3>
                      <p className="mt-3 text-slate-700">{business.runtime.assetPreview.subheadline}</p>
                      <ul className="mt-4 space-y-2 text-slate-800">
                        {business.runtime.assetPreview.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
                      </ul>
                      <button className="mt-5 rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white">{business.runtime.assetPreview.cta}</button>
                    </div>
                  </Card>

                  <Card title="Agent testing" subtitle="Smoke checks over the generated plan">
                    <div className="space-y-3">
                      {business.runtime.tests.map((test) => (
                        <div key={test.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-medium text-white">{test.name}</h3>
                            <Chip label={test.status} tone={test.status === 'pass' ? 'green' : 'amber'} />
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{test.details}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Deployment state machine" subtitle="Draft → validating → deploying → live">
                    <div className="flex flex-wrap gap-2">
                      {['draft', 'validating', 'deploying', 'live'].map((state) => (
                        <Chip key={state} label={state} tone={business.deployment?.state === state ? 'orange' : 'slate'} />
                      ))}
                    </div>
                    <div className="mt-4 space-y-3">
                      {business.deployment?.history.map((item) => (
                        <div key={`${item.at}-${item.state}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
                          <p className="text-white">{item.state}</p>
                          <p className="text-slate-400">{new Date(item.at).toLocaleTimeString()} • {item.note}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Live agent dashboard" subtitle={`Runtime status: ${business.runtime.status}`}>
                    <div className="space-y-3">
                      {business.runtime.tasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h3 className="font-medium text-white">{task.title}</h3>
                              <p className="mt-1 text-sm text-slate-400">Agent: {task.agentId}</p>
                              <p className="mt-2 text-sm text-slate-300">{task.notes}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Chip label={task.status} />
                              <button onClick={() => updateTask(task.id, 'advance')} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20">Advance</button>
                              <button onClick={() => updateTask(task.id, 'block')} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20">Block</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <h3 className="font-medium text-white">Recent runtime events</h3>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        {business.runtime.eventLog.map((event) => (
                          <div key={`${event.at}-${event.text}`} className="flex justify-between gap-3 border-b border-slate-800/70 pb-2 last:border-b-0">
                            <span>{event.text}</span>
                            <span className="text-slate-500">{new Date(event.at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <Card title="No business loaded" subtitle="Use the demo search target to unlock the full flow.">
            <p className="text-slate-400">Try searching for Joe&apos;s Pizza.</p>
          </Card>
        )}
      </div>
    </main>
  );
}

function Chip({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'green' | 'amber' | 'orange' }) {
  const toneClass = {
    slate: 'border-slate-700 bg-slate-800 text-slate-200',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-300'
  }[tone];

  return <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${toneClass}`}>{label}</span>;
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="font-medium text-white">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
