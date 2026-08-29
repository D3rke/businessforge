import type { Business, RuntimeEvent, RuntimeInteraction, RuntimeInteractionResponse } from './types.js';

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function pushEvent(business: Business, event: Omit<RuntimeEvent, 'id' | 'at'>) {
  business.runtime?.eventLog.unshift({
    id: id('evt'),
    at: new Date().toISOString(),
    ...event
  });
}

export function interactWithRuntime(business: Business, agentId: string, message: string): RuntimeInteractionResponse {
  if (!business.runtime) {
    throw new Error('runtime not ready');
  }

  const agent = business.runtime.agents.find((entry) => entry.id === agentId) ?? business.runtime.agents[0];
  const lower = message.toLowerCase();
  const mentionedTask = business.runtime.tasks.find((task) => lower.includes(task.agentId) || lower.includes(task.title.toLowerCase().slice(0, 12)));

  if (mentionedTask && mentionedTask.status === 'queued') {
    mentionedTask.status = 'running';
    mentionedTask.notes = `Pulled into execution after ${agent.name} reviewed operator input.`;
    pushEvent(business, {
      type: 'handoff',
      actor: agent.id,
      text: `${agent.name} pulled ${mentionedTask.title} into active execution.`,
      taskId: mentionedTask.id
    });
  }

  const capabilityRequest = business.runtime.missingCapabilities.find((capability) => lower.includes(capability.split('-')[0]) || lower.includes('integrat') || lower.includes('automation'));
  if (capabilityRequest) {
    pushEvent(business, {
      type: 'capability-request',
      actor: agent.id,
      text: `${agent.name} requested missing capability coverage for ${capabilityRequest}.`,
      capability: capabilityRequest
    });
  }

  const response = capabilityRequest
    ? `${agent.name} can continue the internal planning flow, but ${capabilityRequest} is still simulated. I logged a capability request and kept the task graph moving with placeholders.`
    : mentionedTask
      ? `${agent.name} reviewed the request, updated ${mentionedTask.title.toLowerCase()}, and handed the next step to downstream agents where available.`
      : `${agent.name} translated your instruction into runtime context. Internal handoffs and event emission are live, while external side effects remain simulated.`;

  const interaction: RuntimeInteraction = {
    id: id('msg'),
    at: new Date().toISOString(),
    agentId: agent.id,
    userMessage: message,
    response
  };

  business.runtime.interactions.unshift(interaction);
  pushEvent(business, { type: 'interaction', actor: agent.id, text: `Operator message routed to ${agent.name}.` });
  business.runtime.status = business.runtime.tasks.every((task) => task.status === 'done') ? 'stable' : 'executing';

  return { business, interaction };
}
