import fs from 'node:fs';
import path from 'node:path';
import { executeBuildRun } from './buildRuntime.js';
import { createBuildPlan, createDeployment, createOpportunities, createReport, createRuntime } from './demoData.js';
import { discoverBusinesses } from './discovery.js';
import { runEvidenceResearch } from './researchPipeline.js';
import type { Business } from './types.js';

async function main() {
  const repoRoot = path.resolve(process.cwd(), '..');
  const results: string[] = [];

  const localDiscovery = await discoverBusinesses({ query: 'Starbucks Pike Place', locationText: 'Seattle, WA', mode: 'BUSINESS' });
  const localBusiness = localDiscovery.matches.find((match) => match.researchBasis !== 'synthetic' && match.researchBasis !== 'demo') ?? localDiscovery.matches[0];
  if (!localBusiness) throw new Error('Local business lookup failed.');
  const mismatchBusiness: Business = {
    ...localBusiness,
    sources: [...localBusiness.sources, {
      id: 'src-mismatch-austin',
      title: `${localBusiness.name} Austin profile`,
      url: 'https://example.com/austin-profile',
      domain: 'example.com',
      kind: 'directory',
      sourceType: 'general-mention',
      excerpt: `${localBusiness.name} in Austin, Texas with a different address and market context.`,
      evidence: ['Austin, Texas listing'],
      provenance: 'REAL_RETRIEVED',
      availability: 'available',
      qualityScore: 50,
      relevanceScore: 50,
      entityConfidence: 0,
      entityDisposition: 'general'
    }]
  };
  const localResearch = await runEvidenceResearch(mismatchBusiness);
  const mismatch = localResearch.sources.find((source) => source.id === 'src-mismatch-austin');
  if (!mismatch || mismatch.entityDisposition !== 'rejected') throw new Error('Location-respecting entity rejection failed.');
  results.push(`Local business lookup: ${localBusiness.name} (${localBusiness.city}) with mismatch rejection ${mismatch.entityDisposition}.`);

  const corpDiscovery = await discoverBusinesses({ query: "McDonald's", mode: 'CORPORATION' });
  const corpBusiness = corpDiscovery.matches[0];
  const corpResearch = await runEvidenceResearch(corpBusiness);
  const realCorpSources = corpResearch.sources.filter((source) => source.provenance === 'REAL_RETRIEVED');
  if (realCorpSources.length < 2) throw new Error('Corporation mode did not retrieve enough representative real sources.');
  results.push(`Corporation mode: ${corpBusiness.name} returned ${realCorpSources.length} real representative sources.`);

  const researchedBusiness: Business = {
    ...corpBusiness,
    identity: corpResearch.identity,
    sources: corpResearch.sources,
    evidenceItems: corpResearch.evidenceItems,
    stage: 'researched',
    researchBasis: 'hybrid',
    deployment: createDeployment(),
    researchMetadata: {
      plannerQuestions: corpResearch.plannerQuestions,
      limitations: corpResearch.limitations,
      providerAvailability: corpResearch.providerAvailability,
      sampleNote: corpResearch.sampleNote
    }
  };
  const report = createReport(researchedBusiness, corpResearch.evidenceItems);
  const opportunity = createOpportunities(researchedBusiness, corpResearch.evidenceItems)[0];
  researchedBusiness.report = report;
  researchedBusiness.opportunities = [opportunity];
  researchedBusiness.selectedOpportunityId = opportunity.id;
  researchedBusiness.runtime = createRuntime(researchedBusiness, opportunity, report);
  researchedBusiness.buildPlan = createBuildPlan(opportunity, researchedBusiness.runtime.agents);
  executeBuildRun(researchedBusiness, opportunity, repoRoot);
  const latestRun = researchedBusiness.runtime.buildRuns[0];
  if (!latestRun || latestRun.status !== 'passed') throw new Error('Build run failed.');
  for (const artifact of latestRun.artifacts) {
    if (!fs.existsSync(path.join(repoRoot, artifact.path))) throw new Error(`Missing build artifact ${artifact.path}`);
  }
  const requiredEvents = ['BUILD_STARTED', 'TASK_STARTED', 'FILE_CREATED', 'TEST_STARTED', 'TEST_PASSED', 'DEPLOYMENT_STARTED', 'DEPLOYMENT_COMPLETE', 'BUILD_COMPLETE'] as const;
  const seen = new Set(latestRun.events.map((event) => event.type));
  for (const event of requiredEvents) {
    if (!seen.has(event)) throw new Error(`Missing build event ${event}`);
  }
  results.push(`Build path: created ${latestRun.artifacts.length} artifacts with ${latestRun.events.length} recorded events.`);

  console.log(results.join('\n'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
