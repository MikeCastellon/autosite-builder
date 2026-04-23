import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverDomainConnect, buildApplyUrl } from './domainConnect.js';

describe('domainConnect', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildApplyUrl', () => {
    it('constructs a complete sync apply URL', () => {
      const url = buildApplyUrl({
        urlSyncUX: 'https://dcc.godaddy.com',
        providerId: 'autocaregeniushub.com',
        serviceId: 'customdomain',
        domain: 'mybusiness.com',
        redirectUri: 'https://app.example.com/domain-connected',
        state: 'signedstate',
      });

      expect(url).toContain('https://dcc.godaddy.com');
      expect(url).toContain('/v2/domainTemplates/providers/autocaregeniushub.com/services/customdomain/apply');
      expect(url).toContain('domain=mybusiness.com');
      expect(url).toContain('state=signedstate');
      expect(url).toContain(`redirect_uri=${encodeURIComponent('https://app.example.com/domain-connected')}`);
    });
  });

  describe('discoverDomainConnect', () => {
    it('returns null when no TXT record exists', async () => {
      const resolve = vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENODATA' }));
      const result = await discoverDomainConnect('mybusiness.com', { resolveTxt: resolve });
      expect(result).toBeNull();
    });

    it('returns provider info when TXT + settings succeed', async () => {
      const resolve = vi.fn().mockResolvedValue([['api.godaddy.com/v1/domains/settings']]);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          urlSyncUX: 'https://dcc.godaddy.com',
          providerId: 'godaddy',
          providerName: 'GoDaddy',
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await discoverDomainConnect('mybusiness.com', { resolveTxt: resolve });
      expect(result.providerName).toBe('GoDaddy');
      expect(result.urlSyncUX).toBe('https://dcc.godaddy.com');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.godaddy.com/v1/domains/settings/v2/mybusiness.com/settings');
    });

    it('returns null when settings fetch fails', async () => {
      const resolve = vi.fn().mockResolvedValue([['api.godaddy.com/v1/domains/settings']]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const result = await discoverDomainConnect('mybusiness.com', { resolveTxt: resolve });
      expect(result).toBeNull();
    });
  });
});
