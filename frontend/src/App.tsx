import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Card } from './components/Card';
import { api } from './lib/api';
import type { AgentDefinition, Business, DiscoveryResponse, ResearchResponse } from './lib/types';

const defaultQuery = 'North Star Dental in Seattle';
const lifecycleStates = ['draft', 'validating', 'deploying', 'live'] as const;

export default function App() {
  const [query, setQuery] = useState(defaultQuery);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [matches, setMatches] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [run, setRun] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState('Can you review the active task and tell me what is still simulated?');

  const selectedOpportunity = useMemo(
    () => business?.opportunities?.find((opp) => opp.id === business.selectedOpportunityId),
    [business]
  );

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: DiscoveryResponse = await api.discover({ query, websiteUrl });
      setMatches(res.matches);
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

  const chooseBusiness = (next: Business) => {
    setBusiness(next);
    setRun(null);
    setError(null);
  };

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

  const interact = async () => {
    if (!business?.runtime?.agents.length || !agentMessage.trim()) return;
    const res = await api.interact(business.id, business.runtime.agents[0].id, agentMessage);
    setBusiness(res.business);
    setAgentMessage('');
  };

  const metrics = [
    { label: 'Candidate matches', value: matches.length, hint: 'Multiple discovery options per query' },
    { label: 'Evidence items', value: business?.evidenceItems?.length ?? 0, hint: 'Structured findings, not fixed copy' },
    { label: 'Runtime status', value: business?.runtime?.status ?? 'Planning', hint: 'Operator interactions route through runtime' }
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_24%),linear-gradient(180deg,_#fffdf8_0%,_#f8fafc_46%,_#f6f7fb_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,255,255,0.62))]" />
          <div className="relative">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                  BusinessForge
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live workspace
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Turn business discovery into a launch-ready operating plan.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Search any local business query, optionally add the real website, then turn public evidence into a launch-ready operating plan. Joe&apos;s Pizza is demo fallback, not the main path.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem] xl:grid-cols-1">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm shadow-slate-200/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{metric.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{metric.hint}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.75fr)_auto_auto]">
              <label className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm shadow-slate-200/60 transition focus-within:border-orange-300 focus-within:shadow-orange-100">
                <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">Search</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" placeholder="Try dentist in Seattle or coffee shop near Austin" />
              </label>
              <label className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm shadow-slate-200/60 transition focus-within:border-sky-300 focus-within:shadow-sky-100">
                <span className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">Website</span>
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" placeholder="Optional, ex: northstardental.com" />
              </label>
              <button onClick={search} disabled={loading} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:bg-slate-800 disabled:opacity-50">
                {loading ? 'Updating…' : 'Refresh profile'}
              </button>
              <button onClick={startResearch} disabled={!business || loading} className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-400 disabled:opacity-50">
                {run && run.run.status !== 'complete' ? 'Researching…' : 'Run analysis'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              {suggestion ? <p className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{suggestion}</p> : null}
              {run?.run.provider ? <p className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">Provider: {run.run.provider}</p> : null}
              {business?.researchBasis ? <p className={`rounded-full px-3 py-1.5 ${business.researchBasis === 'website' ? 'bg-emerald-50 text-emerald-700' : business.researchBasis === 'demo' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700'}`}>Basis: {business.researchBasis}</p> : null}
              {error ? <p className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">{error}</p> : null}
            </div>
          </div>
        </section>

        {matches.length ? (
          <Card title="Candidate matches" subtitle="Select the best fit before running analysis">
            <div className="grid gap-4 lg:grid-cols-3">
              {matches.map((match) => {
                const selected = business?.id === match.id;
                return (
                  <button key={match.id} onClick={() => chooseBusiness(match)} className={`rounded-3xl border p-5 text-left transition ${selected ? 'border-orange-300 bg-orange-50/80' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{match.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{match.category} in {match.city}</p>
                        {match.websiteUrl ? <p className="mt-1 text-xs text-sky-700">{match.websiteUrl}</p> : null}
                      </div>
                      <StatusPill tone={selected ? 'orange' : 'slate'}>{match.discoveryScore} match</StatusPill>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{match.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        ) : null}

        {business ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card title={business.name} subtitle={`${business.category} in ${business.city}`} right={<StatusPill tone="green">{business.stage}</StatusPill>}>
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <div>
                    <p className="text-[15px] leading-7 text-slate-600">{business.description}</p>
                    {business.websiteUrl ? <a href={business.websiteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-800">Open provided website</a> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <MiniStat label="Sources" value={business.sources.length} />
                    <MiniStat label="Themes" value={business.report?.keyThemes.length ?? 0} />
                    <MiniStat label="Tasks" value={business.runtime?.tasks.length ?? 0} />
                  </div>
                </div>
              </Card>

              <Card title="Workspace progress" subtitle="From discovery to execution, in one flow">
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-sky-50 p-5">
                    <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-700">Analysis status</span><span className="text-slate-500">{run?.progress ?? 0}%</span></div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500" style={{ width: `${run?.progress ?? 0}%` }} /></div>
                    <p className="mt-4 text-lg font-semibold text-slate-900">{run?.currentStage ?? 'Ready to start analysis'}</p>
                    <p className="mt-1 text-sm text-slate-600">{run ? `Current run is ${run.run.status}.` : 'Start analysis to generate report, opportunities, and runtime plan.'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StageCard title="Discover" active completed={!!business} copy="Compare multiple candidates for the query." />
                    <StageCard title="Research" active={!!run && run.run.status !== 'complete'} completed={!!business.report} copy="Provider-backed evidence synthesis." />
                    <StageCard title="Prioritize" active={!!business.opportunities && !business.runtime} completed={!!selectedOpportunity} copy="Rank wedges from evidence." />
                    <StageCard title="Operate" active={!!business.runtime} completed={!!business.runtime} copy="Route live interactions through runtime." />
                  </div>
                </div>
              </Card>

              <Card title="Source signals" subtitle="The inputs shaping the recommendation">
                <div className="grid gap-4 md:grid-cols-2">
                  {business.sources.map((source) => (
                    <article key={source.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{source.kind}</p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-900">{source.title}</h3>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{source.evidence.length} signals</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{source.excerpt}</p>
                      <ul className="mt-4 space-y-2 text-sm text-slate-700">{source.evidence.map((item) => <li key={item} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" /><span>{item}</span></li>)}</ul>
                    </article>
                  ))}
                </div>
              </Card>

              {business.evidenceItems ? (
                <Card title="Evidence model" subtitle="Structured findings driving the rest of the workspace">
                  <div className="space-y-3">
                    {business.evidenceItems.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill tone="slate">{item.type}</StatusPill>
                          <StatusPill tone={item.sentiment === 'negative' ? 'amber' : item.sentiment === 'positive' ? 'green' : 'slate'}>{item.sentiment}</StatusPill>
                          <MetricChip label={item.strength} />
                          <MetricChip label={item.theme} />
                        </div>
                        <p className="mt-3 font-medium text-slate-900">{item.statement}</p>
                        <p className="mt-2 text-sm text-slate-600">Implication: {item.implication}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {business.report ? (
                <Card title="Market brief" subtitle="Derived from structured evidence, not fixed demo copy">
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white">
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-300">Executive summary</p>
                    <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-100">{business.report.summary}</p>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <InsightList title="Strengths" items={business.report.strengths} tone="green" />
                    <InsightList title="Gaps" items={business.report.gaps} tone="amber" />
                    <InsightList title="Signals" items={business.report.marketSignals} tone="sky" />
                  </div>
                </Card>
              ) : null}

              {business.opportunities ? (
                <Card title="Recommended wedges" subtitle="Ranked from evidence and category context">
                  <div className="space-y-4">
                    {business.opportunities.map((opp, index) => {
                      const selected = opp.id === business.selectedOpportunityId;
                      return (
                        <button key={opp.id} onClick={() => chooseOpportunity(opp.id)} className={`w-full rounded-3xl border p-5 text-left ${selected ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-white' : 'border-slate-200 bg-white'}`}>
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex items-center gap-3"><span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">0{index + 1}</span>{selected ? <StatusPill tone="orange">Selected</StatusPill> : null}</div>
                              <h3 className="mt-3 text-xl font-semibold text-slate-950">{opp.title}</h3>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{opp.rationale}</p>
                              <div className="mt-3 flex flex-wrap gap-2">{opp.capabilityNeeds.map((cap) => <MetricChip key={cap} label={cap} />)}</div>
                            </div>
                            <div className="flex flex-wrap gap-2"><MetricChip label={`Impact ${opp.impact}`} /><MetricChip label={`Confidence ${opp.confidence}`} /><MetricChip label={opp.effort} /></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ) : null}
            </div>

            <div className="space-y-6">
              {selectedOpportunity && business.buildPlan ? (
                <Card title="Launch plan" subtitle={`Sequenced around ${selectedOpportunity.title}`}>
                  <div className="space-y-3">{business.buildPlan.map((step, index) => <div key={step.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">{index + 1}</div><div><h3 className="font-semibold text-slate-900">{step.title}</h3><p className="mt-1 text-sm text-slate-500">Owner: {step.owner}</p></div></div><StatusPill tone={step.status === 'done' ? 'green' : 'slate'}>{step.status}</StatusPill></div><p className="mt-3 text-sm leading-6 text-slate-600">{step.outcome}</p><p className="mt-2 text-xs text-slate-400">Evidence links: {step.evidenceIds.join(', ')}</p></div>)}</div>
                </Card>
              ) : null}

              {business.runtime ? (
                <>
                  <Card title="Agent workspace" subtitle="Dynamically derived from category, evidence, and selected opportunity"><div className="space-y-3">{business.runtime.agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}</div></Card>
                  <Card title="Output preview" subtitle="A customer-facing artifact generated from the plan"><div className="overflow-hidden rounded-[1.75rem] border border-orange-100 bg-[linear-gradient(180deg,_#fff7ed_0%,_#ffffff_38%,_#fffaf5_100%)] p-6"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">Featured asset</p><h3 className="mt-6 max-w-xl text-3xl font-semibold tracking-tight text-slate-950">{business.runtime.assetPreview.headline}</h3><p className="mt-3 max-w-lg text-base leading-7 text-slate-600">{business.runtime.assetPreview.subheadline}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{business.runtime.assetPreview.bullets.map((bullet) => <div key={bullet} className="rounded-2xl border border-white bg-white/80 p-4 text-sm text-slate-700 shadow-sm">{bullet}</div>)}</div><button className="mt-6 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">{business.runtime.assetPreview.cta}</button></div></Card>
                  <Card title="Quality checks" subtitle="Pre-launch validation across the generated workflow"><div className="space-y-3">{business.runtime.tests.map((test) => <div key={test.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{test.name}</h3><StatusPill tone={test.status === 'pass' ? 'green' : 'amber'}>{test.status}</StatusPill></div><p className="mt-2 text-sm text-slate-600">{test.details}</p></div>)}</div></Card>
                  <Card title="Release lifecycle" subtitle="Visibility from draft to live"><div className="flex flex-wrap gap-2">{lifecycleStates.map((state) => <StatusPill key={state} tone={business.deployment?.state === state ? 'orange' : 'slate'}>{state}</StatusPill>)}</div><div className="mt-4 space-y-3">{business.deployment?.history.map((item) => <div key={`${item.at}-${item.state}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-900 capitalize">{item.state}</p><p className="text-xs uppercase tracking-[0.16em] text-slate-400">{new Date(item.at).toLocaleTimeString()}</p></div><p className="mt-1 text-sm text-slate-600">{item.note}</p></div>)}</div></Card>
                  <Card title="Operations board" subtitle={`Runtime status: ${business.runtime.status}`}><div className="space-y-3">{business.runtime.tasks.map((task) => <div key={task.id} className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{task.title}</h3><StatusPill tone="slate">{task.status}</StatusPill></div><p className="mt-2 text-sm text-slate-500">Owner agent: {task.agentId}</p><p className="mt-2 text-sm leading-6 text-slate-600">{task.notes}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => updateTask(task.id, 'advance')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Advance</button><button onClick={() => updateTask(task.id, 'block')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Block</button></div></div></div>)}</div><div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Recent activity</h3><StatusPill tone="slate">Live feed</StatusPill></div><div className="mt-4 space-y-3">{business.runtime.eventLog.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 text-sm last:border-b-0 last:pb-0"><div><p className="text-slate-600">{event.text}</p><p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{event.type} · {event.actor}</p></div><p className="whitespace-nowrap text-slate-400">{new Date(event.at).toLocaleTimeString()}</p></div>)}</div></div></Card>
                  <Card title="Live agent interaction" subtitle="Messages now route through the runtime service layer"><div className="space-y-3"><textarea value={agentMessage} onChange={(e) => setAgentMessage(e.target.value)} className="min-h-28 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none" placeholder="Ask the active runtime agent what to do next" /><button onClick={interact} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Send to {business.runtime.agents[0]?.name}</button>{business.runtime.missingCapabilities.length ? <p className="text-sm text-amber-700">Still simulated externally: {business.runtime.missingCapabilities.join(', ')}</p> : <p className="text-sm text-emerald-700">Selected capability needs are internally covered by the runtime graph.</p>}<div className="space-y-3">{business.runtime.interactions.slice(0, 4).map((entry) => <div key={entry.id} className="rounded-3xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{entry.agentId}</p><p className="mt-2 text-sm font-medium text-slate-900">{entry.userMessage}</p><p className="mt-2 text-sm leading-6 text-slate-600">{entry.response}</p></div>)}</div></div></Card>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-6"><Card title="No business selected" subtitle="Start with any local query to open the workspace"><p className="text-sm text-slate-600">Try searching for Joe&apos;s Pizza, dentist in Seattle, or salon near Austin.</p></Card></div>
        )}
      </div>
    </main>
  );
}

function AgentCard({ agent }: { agent: AgentDefinition }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{agent.id}</p><h3 className="mt-2 text-lg font-semibold text-slate-900">{agent.name}</h3><p className="mt-1 text-sm text-slate-500">{agent.role}</p></div><div className="flex flex-wrap gap-2"><StatusPill tone="slate">{agent.capability}</StatusPill><StatusPill tone="slate">{agent.tools.length} tools</StatusPill></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{agent.goal}</p><div className="mt-4 grid gap-3 md:grid-cols-2"><KeyValueList title="Inputs" items={agent.inputs} /><KeyValueList title="Outputs" items={agent.outputs} /></div><div className="mt-4 flex flex-wrap gap-2">{agent.dependsOn.length ? agent.dependsOn.map((dependency) => <MetricChip key={dependency} label={`Depends on ${dependency}`} />) : <MetricChip label="No upstream dependency" />}</div></div>;
}

function KeyValueList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p><div className="mt-3 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm shadow-slate-200/70">{item}</span>)}</div></div>;
}

function StageCard({ title, copy, active, completed = false }: { title: string; copy: string; active?: boolean; completed?: boolean }) {
  return <div className={`rounded-2xl border p-4 transition ${active ? 'border-orange-200 bg-orange-50/80' : completed ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-900">{title}</p><span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-orange-500' : completed ? 'bg-emerald-500' : 'bg-slate-300'}`} /></div><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold text-slate-950">{value}</p></div>;
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: 'green' | 'amber' | 'sky' }) {
  const tones = { green: 'border-emerald-200 bg-emerald-50/70 marker:text-emerald-500', amber: 'border-amber-200 bg-amber-50/70 marker:text-amber-500', sky: 'border-sky-200 bg-sky-50/70 marker:text-sky-500' } as const;
  return <div className={`rounded-3xl border p-5 ${tones[tone]}`}><h3 className="font-semibold text-slate-900">{title}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function MetricChip({ label }: { label: string }) {
  return <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{label}</span>;
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'slate' | 'green' | 'amber' | 'orange' }) {
  const tones = { slate: 'border-slate-200 bg-slate-100 text-slate-700', green: 'border-emerald-200 bg-emerald-50 text-emerald-700', amber: 'border-amber-200 bg-amber-50 text-amber-700', orange: 'border-orange-200 bg-orange-50 text-orange-700' } as const;
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${tones[tone]}`}>{children}</span>;
}
