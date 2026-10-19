import { describe, expect, it } from 'vitest';
import { vHttpUrl, vOptionalPattern, vStringArray } from './validate.js';

describe('template input validators', () => {
  it('accepts HTTP(S) URLs and rejects executable or malformed protocols', () => {
    expect(vHttpUrl()('https://example.test/report').ok).toBe(true);
    expect(vHttpUrl()('javascript:alert(1)').ok).toBe(false);
    expect(vHttpUrl()('not a url').ok).toBe(false);
  });

  it('validates optional ISO language and country codes', () => {
    expect(vOptionalPattern(/^[a-z]{2}$/, 2, 'invalid')('he')).toEqual({ ok: true, value: 'he' });
    expect(vOptionalPattern(/^[A-Z]{2}$/, 2, 'invalid')('IL').ok).toBe(true);
    expect(vOptionalPattern(/^[A-Z]{2}$/, 2, 'invalid')('il').ok).toBe(false);
  });

  it('rejects keyword arrays containing non-strings', () => {
    expect(vStringArray()([' alert ', 'rocket'])).toEqual({ ok: true, value: ['alert', 'rocket'] });
    expect(vStringArray()(['alert', 42]).ok).toBe(false);
  });
});
