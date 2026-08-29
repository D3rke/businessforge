import type { Business, DiscoveryInput, DiscoveryResponse, ResearchResponse, RuntimeInteractionResponse } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  discover: (input: DiscoveryInput) => request<DiscoveryResponse>('/api/discover', { method: 'POST', body: JSON.stringify(input) }),
  startResearch: (businessId: string) => request<ResearchResponse>('/api/research/start', { method: 'POST', body: JSON.stringify({ businessId }) }),
  getResearch: (runId: string) => request<ResearchResponse>(`/api/research/${runId}`),
  getBusiness: (businessId: string) => request<Business>(`/api/business/${businessId}`),
  selectOpportunity: (businessId: string, opportunityId: string) => request<Business>(`/api/business/${businessId}/select-opportunity`, { method: 'POST', body: JSON.stringify({ opportunityId }) }),
  updateTask: (businessId: string, taskId: string, action: 'advance' | 'block') => request<Business>(`/api/business/${businessId}/tasks/${taskId}`, { method: 'POST', body: JSON.stringify({ action }) }),
  interact: (businessId: string, agentId: string, message: string) => request<RuntimeInteractionResponse>(`/api/business/${businessId}/runtime/interact`, { method: 'POST', body: JSON.stringify({ agentId, message }) })
};
