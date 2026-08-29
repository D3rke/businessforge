import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { getBusiness, getDiscovery, getResearch, interact, readBuildFile, selectOpportunity, startBuild, startResearch, updateTask } from './store.js';
import type { ResearchMode } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/generated', express.static(path.resolve(process.cwd(), '..', 'generated')));

function parseMode(input: unknown): ResearchMode | undefined {
  return input === 'BUSINESS' || input === 'CORPORATION' ? input : undefined;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/discover', async (req, res) => {
  const query = String(req.query.q ?? '');
  const websiteUrl = typeof req.query.websiteUrl === 'string' ? req.query.websiteUrl : undefined;
  const locationText = typeof req.query.locationText === 'string' ? req.query.locationText : undefined;
  const mode = parseMode(req.query.mode);
  const latitudeValue = typeof req.query.latitude === 'string' ? Number(req.query.latitude) : Number.NaN;
  const longitudeValue = typeof req.query.longitude === 'string' ? Number(req.query.longitude) : Number.NaN;
  const coordinates = Number.isFinite(latitudeValue) && Number.isFinite(longitudeValue) ? { latitude: latitudeValue, longitude: longitudeValue } : undefined;
  res.json(await getDiscovery({ query, websiteUrl, locationText, coordinates, mode }));
});

app.post('/api/discover', async (req, res) => {
  const { query, websiteUrl, locationText, coordinates, mode } = req.body as { query?: string; websiteUrl?: string; locationText?: string; coordinates?: { latitude?: number; longitude?: number }; mode?: ResearchMode };
  res.json(await getDiscovery({
    query: String(query ?? ''),
    websiteUrl,
    locationText,
    mode: parseMode(mode) ?? 'BUSINESS',
    coordinates: coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude) ? { latitude: Number(coordinates.latitude), longitude: Number(coordinates.longitude) } : undefined
  }));
});

app.post('/api/research/start', async (req, res) => {
  const { businessId } = req.body as { businessId?: string };
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  const result = await startResearch(businessId);
  if (!result) return res.status(404).json({ error: 'business not found' });
  res.json(result);
});

app.get('/api/research/:runId', (req, res) => {
  const result = getResearch(req.params.runId);
  if (!result) return res.status(404).json({ error: 'run not found' });
  res.json(result);
});

app.get('/api/business/:businessId', (req, res) => {
  const business = getBusiness(req.params.businessId);
  if (!business) return res.status(404).json({ error: 'business not found' });
  res.json(business);
});

app.post('/api/business/:businessId/select-opportunity', (req, res) => {
  const { opportunityId } = req.body as { opportunityId?: string };
  if (!opportunityId) return res.status(400).json({ error: 'opportunityId required' });
  try {
    res.json(selectOpportunity(req.params.businessId, opportunityId));
  } catch {
    res.status(404).json({ error: 'business not found' });
  }
});

app.post('/api/business/:businessId/start-build', (req, res) => {
  try {
    const business = startBuild(req.params.businessId);
    if (!business) return res.status(404).json({ error: 'business not found' });
    res.json(business);
  } catch {
    res.status(404).json({ error: 'business not found' });
  }
});

app.get('/api/business/:businessId/build-file', (req, res) => {
  const relativePath = String(req.query.path ?? '');
  if (!relativePath) return res.status(400).json({ error: 'path required' });
  try {
    const file = readBuildFile(req.params.businessId, relativePath);
    if (!file) return res.status(404).json({ error: 'file not found' });
    res.json(file);
  } catch {
    res.status(400).json({ error: 'invalid file path' });
  }
});

app.post('/api/business/:businessId/tasks/:taskId', (req, res) => {
  const { action } = req.body as { action?: 'advance' | 'block' };
  if (!action) return res.status(400).json({ error: 'action required' });
  try {
    const business = updateTask(req.params.businessId, req.params.taskId, action);
    if (!business) return res.status(404).json({ error: 'task not found' });
    res.json(business);
  } catch {
    res.status(404).json({ error: 'business not found' });
  }
});

app.post('/api/business/:businessId/runtime/interact', (req, res) => {
  const { agentId, message } = req.body as { agentId?: string; message?: string };
  if (!agentId || !message) return res.status(400).json({ error: 'agentId and message required' });
  try {
    res.json(interact(req.params.businessId, agentId, message));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'runtime interaction failed' });
  }
});

const port = Number(process.env.PORT ?? 8788);
app.listen(port, () => {
  console.log(`BusinessForge API listening on http://localhost:${port}`);
});
