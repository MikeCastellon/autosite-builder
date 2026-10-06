import { describe, it, expect } from 'vitest';
import { apiKeyFrom, connectionCause, redactKey } from '../../scripts/skills-key.mjs';
import { main } from '../../scripts/skills-release.mjs';

const KEY = 'sk-ant-api03-AbC_123-xyz789TEST';
const ESC = '\u001b';

describe('apiKeyFrom', () => {
  it('cleans what a terminal or a web copy adds around a pasted key', () => {
    // Bracketed paste: every kit upload on 2026-10-06 failed with it.
    expect(apiKeyFrom({ ANTHROPIC_API_KEY: `${ESC}[200~${KEY}${ESC}[201~` })).toEqual({ key: KEY, problem: '' });
    expect(apiKeyFrom({ ANTHROPIC_API_KEY: `  ${KEY}\n` }).key).toBe(KEY);
    expect(apiKeyFrom({ ANTHROPIC_API_KEY: `\ufeff${KEY}\u200b` }).key).toBe(KEY);
    expect(apiKeyFrom({ ANTHROPIC_API_KEY: `ANTHROPIC_API_KEY=${KEY}` }).key).toBe(KEY);
    expect(apiKeyFrom({ ANTHROPIC_API_KEY: `export ANTHROPIC_API_KEY="${KEY}"` }).key).toBe(KEY);
  });

  it('refuses a key that still is not plain text, without quoting it', () => {
    for (const bad of [`${KEY} ${KEY}`, `${KEY}\n${KEY}`, `${KEY}\u00e9`]) {
      const r = apiKeyFrom({ ANTHROPIC_API_KEY: bad });
      expect(r.key).toBe('');
      expect(r.problem).toMatch(/hidden characters/);
      expect(r.problem).not.toContain('sk-ant');
    }
    expect(apiKeyFrom({}).problem).toMatch(/not set/);
    expect(apiKeyFrom({ ANTHROPIC_API_KEY: `${ESC}[200~${ESC}[201~` }).problem).toMatch(/not set/);
  });
});

describe('redactKey / connectionCause', () => {
  it('takes the raw and the cleaned key out of a message', () => {
    const env = { ANTHROPIC_API_KEY: `${ESC}[200~${KEY}${ESC}[201~` };
    const msg = `Headers.append: "${env.ANTHROPIC_API_KEY}" is an invalid header value; also ${KEY}; and sk-ant-api03-someOtherKey99`;
    const out = redactKey(msg, env);
    expect(out).not.toContain('sk-ant');
    expect(out).toContain('[key]');
  });

  it('reads codes only from the cause chain', () => {
    const err = { cause: { message: `x ${KEY}`, cause: { code: 'ENOTFOUND', cause: { code: 'ENOTFOUND' } } } };
    expect(connectionCause(err)).toBe('ENOTFOUND');
    expect(connectionCause({})).toBe('');
  });
});

describe('skills:release with a pasted key', () => {
  function fakeSdk({ failList } = {}) {
    const calls = { keys: [], created: [] };
    const createClient = async ({ apiKey }) => {
      calls.keys.push(apiKey);
      return {
        client: {
          skills: {
            list: () => ({
              async *[Symbol.asyncIterator]() {
                if (failList) throw failList;
              },
            }),
            create: async ({ files }) => {
              calls.created.push(files.length);
              return { id: `skill_${calls.created.length}`, latest_version_id: `skver_${calls.created.length}` };
            },
          },
        },
        toFile: async (buf, name) => ({ name }),
      };
    };
    return { calls, createClient };
  }

  it('uploads with the cleaned key', async () => {
    const { calls, createClient } = fakeSdk();
    const lines = [];
    const code = await main(['launch-words'], { env: { ANTHROPIC_API_KEY: `${ESC}[200~${KEY}${ESC}[201~` }, createClient, log: (l) => lines.push(l) });
    expect(code).toBe(0);
    expect(calls.keys).toEqual([KEY]);
    expect(calls.created).toHaveLength(1);
    expect(lines.join('\n')).toContain('CUSTOM_SITE_KIT_WORDS_SKILL_ID');
    expect(lines.join('\n')).not.toContain(KEY);
  });

  it('refuses an unusable key once, before any request', async () => {
    const { calls, createClient } = fakeSdk();
    const lines = [];
    const code = await main(['launch-words', 'launch-print-studio'], { env: { ANTHROPIC_API_KEY: `${KEY} ${KEY}` }, createClient, log: (l) => lines.push(l) });
    expect(code).toBe(1);
    expect(calls.keys).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/hidden characters.*Nothing uploaded/);
  });

  it('stops after a request that never reached the API, and never prints the key', async () => {
    const offline = Object.assign(new Error(`Connection error. ${KEY}`), { cause: { code: 'ENOTFOUND' } });
    const { calls, createClient } = fakeSdk({ failList: offline });
    const lines = [];
    const code = await main(['launch-words', 'launch-print-studio', 'launch-handover'], { env: { ANTHROPIC_API_KEY: KEY }, createClient, log: (l) => lines.push(l) });
    const out = lines.join('\n');
    expect(code).toBe(1);
    expect(calls.created).toEqual([]);
    expect(out).not.toContain(KEY);
    expect(out).toContain('never reached the API (ENOTFOUND)');
    expect(out).toContain('the other 2 were not tried');
    expect(out).not.toContain('Skill launch-print-studio');
    expect(out).toContain('0 of 3 released');
  });
});
