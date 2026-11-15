import test from 'ava';
import {
  DEFAULT_MODEL,
  getModelInfo,
  getSelectableModels,
  isAvailableModel,
  setLiveModels,
} from '../src/utils/models.js';

test.afterEach.always(() => {
  setLiveModels(null);
});

test.serial('DEFAULT_MODEL is a known production model', t => {
  t.true(isAvailableModel(DEFAULT_MODEL));
  const entry = getSelectableModels().find(model => model.id === DEFAULT_MODEL);
  t.truthy(entry);
  t.falsy(entry?.preview);
});

test.serial('the API list replaces the built-in list and drops non-chat models', t => {
  setLiveModels([
    { id: 'openai/gpt-oss-120b', contextWindow: 131_072 },
    { id: 'new-vendor/new-model', contextWindow: 65_536 },
    { id: 'whisper-large-v3' },
    { id: 'canopylabs/orpheus-v1-english' },
    { id: 'openai/gpt-oss-safeguard-20b' },
  ]);
  t.deepEqual(getSelectableModels().map(model => model.id), ['openai/gpt-oss-120b', 'new-vendor/new-model']);
  t.false(getSelectableModels()[1].known);
  t.false(isAvailableModel('llama-3.3-70b-versatile'));
  t.true(isAvailableModel('new-vendor/new-model'));
});

test.serial('known models come first in the built-in order', t => {
  setLiveModels([
    { id: 'allam-2-7b' },
    { id: 'qwen/qwen3.8-27b' },
    { id: 'openai/gpt-oss-20b' },
    { id: 'openai/gpt-oss-120b' },
  ]);
  t.deepEqual(getSelectableModels().map(model => model.id), [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'allam-2-7b',
  ]);
});

test.serial('models unknown to the built-in list show their ID and the API context window', t => {
  setLiveModels([{ id: 'new-vendor/new-model', contextWindow: 65_536 }]);
  t.is(getSelectableModels()[0].name, 'new-vendor/new-model');
  t.is(getModelInfo('new-vendor/new-model')?.contextWindow, 65_536);
});

test.serial('the built-in list is used until the API list arrives', t => {
  t.true(isAvailableModel('llama-3.3-70b-versatile'));
  t.false(isAvailableModel('moonshotai/kimi-k2-instruct'));
});
