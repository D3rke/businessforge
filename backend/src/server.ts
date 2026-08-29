import express from 'express';
import cors from 'cors';
import { getBusiness, getDiscovery, getResearch, interact, selectOpportunity, startResearch, updateTask } from './store.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/discover', (req, res) => {
  const query = String(req.query.q ?? '');
  res.json(getDiscovery(query));
});

app.post('/api/research/start', (req, res) => {
  const { businessId } = req.body as { businessId?: string };
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  const result = startResearch(businessId);
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
