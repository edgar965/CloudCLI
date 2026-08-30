import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OpenCodeProviderModels,
  OPENCODE_PREDEFINED_MODELS,
} from '@/modules/providers/list/opencode/opencode-models.provider.js';
import { resetOpenCodeConfigModelCache } from '@/modules/providers/list/opencode/opencode-config-models.js';

test('without a local config, OpenCode exposes only the curated predefined catalog', async () => {
  const adapter = new OpenCodeProviderModels();

  // The catalog also carries what the developer's own OpenCode config
  // declares, so this assertion has to say which of the two it is testing.
  // Without the switch the test passes on CI, where there is no config, and
  // fails on any machine that uses OpenCode - the machine, not the code,
  // decides the outcome.
  const previous = process.env.CLOUDCLI_OPENCODE_CONFIG_MODELS;
  process.env.CLOUDCLI_OPENCODE_CONFIG_MODELS = '0';
  resetOpenCodeConfigModelCache();

  try {
    assert.deepEqual(await adapter.getSupportedModels(), OPENCODE_PREDEFINED_MODELS);
  } finally {
    if (previous === undefined) {
      delete process.env.CLOUDCLI_OPENCODE_CONFIG_MODELS;
    } else {
      process.env.CLOUDCLI_OPENCODE_CONFIG_MODELS = previous;
    }
    resetOpenCodeConfigModelCache();
  }

  assert.equal(
    (await adapter.getCurrentActiveModel()).model,
    OPENCODE_PREDEFINED_MODELS.DEFAULT,
  );
  // OpenCode routes by `<providerID>/<modelID>`, so every option has to carry a
  // provider prefix that `opencode models --verbose` reports.
  const providerIds = new Set(
    OPENCODE_PREDEFINED_MODELS.OPTIONS.map((option) => option.value.split('/')[0]),
  );
  assert.deepEqual([...providerIds].sort(), ['anthropic', 'opencode', 'openai'].sort());
  assert.equal(
    OPENCODE_PREDEFINED_MODELS.OPTIONS.every((option) => /^[a-z0-9-]+\/.+/.test(option.value)),
    true,
  );
  assert.equal(
    new Set(OPENCODE_PREDEFINED_MODELS.OPTIONS.map((option) => option.value)).size,
    OPENCODE_PREDEFINED_MODELS.OPTIONS.length,
  );
  assert.equal(OPENCODE_PREDEFINED_MODELS.DEFAULT, 'opencode/gpt-5.6-terra');
  assert.ok(
    OPENCODE_PREDEFINED_MODELS.OPTIONS.some((option) => option.value === 'opencode/claude-opus-5'),
  );
  assert.ok(
    OPENCODE_PREDEFINED_MODELS.OPTIONS.some((option) => option.value === 'anthropic/claude-opus-5'),
  );
  assert.ok(
    OPENCODE_PREDEFINED_MODELS.OPTIONS.some((option) => option.value === 'openai/gpt-5.6'),
  );
});
