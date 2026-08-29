import express from 'express';
import cors from 'cors';
import { getBusiness, getDiscovery, getResearch, selectOpportunity, startResearch, updateTask } from './store.js';

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
  res.json(startResearch(businessId));
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
  res.json(selectOpportunity(req.params.businessId, opportunityId));
});

app.post('/api/business/:businessId/tasks/:taskId', (req, res) => {
  const { action } = req.body as { action?: 'advance' | 'block' };
  if (!action) return res.status(400).json({ error: 'action required' });
  const business = updateTask(req.params.businessId, req.params.taskId, action);
  if (!business) return res.status(404).json({ error: 'task not found' });
  res.json(business);
});

const port = Number(process.env.PORT ?? 8788);
app.listen(port, () => {
  console.log(`BusinessForge API listening on http://localhost:${port}`);
});
