import test from 'ava';
import { Agent } from '../src/core/agent.js';
import { DEFAULT_MODEL, setLiveModels } from '../src/utils/models.js';

// Stubs the client and config so the test neither calls the API nor writes ~/.groq.
async function agentWith(model: string, list: () => Promise<{ data: unknown[] }>) {
  const agent = await Agent.create(model, 1.0, null, false);
  const saved: string[] = [];
  (agent as any).model = model;
  (agent as any).client = { models: { list } };
  (agent as any).configManager = {
    setDefaultModel: (value: string) => saved.push(value),
    getReasoningEffort: () => null,
  };
  return { agent, saved };
}

test.afterEach.always(() => {
  setLiveModels(null);
});

test.serial('refreshModels switches a removed model to the default', async t => {
  const { agent, saved } = await agentWith('moonshotai/kimi-k2-instruct', async () => ({
    data: [{ id: DEFAULT_MODEL, active: true, context_window: 131_072 }],
  }));
  t.is(await agent.refreshModels(), 'moonshotai/kimi-k2-instruct');
  t.is(agent.getCurrentModel(), DEFAULT_MODEL);
  t.deepEqual(saved, [DEFAULT_MODEL]);
});

test.serial('refreshModels keeps a model the API lists and ignores inactive ones', async t => {
  const { agent } = await agentWith('new-vendor/new-model', async () => ({
    data: [
      { id: 'new-vendor/new-model', active: true },
      { id: DEFAULT_MODEL, active: false },
    ],
  }));
  t.is(await agent.refreshModels(), null);
  t.is(agent.getCurrentModel(), 'new-vendor/new-model');
});

test.serial('refreshModels keeps the model when the API call fails', async t => {
  const { agent } = await agentWith('moonshotai/kimi-k2-instruct', async () => {
    throw new Error('network down');
  });
  t.is(await agent.refreshModels(), null);
  t.is(agent.getCurrentModel(), 'moonshotai/kimi-k2-instruct');
});
