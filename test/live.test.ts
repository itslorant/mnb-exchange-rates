import { describe, expect, it } from 'vitest';
import { createMnbClient, DEFAULT_ENDPOINT } from '../src/index.js';

// Hits the real MNB service. Run with `pnpm test:live`.
describe.skipIf(!process.env['MNB_LIVE'])('live MNB service', () => {
  const client = createMnbClient();

  it('returns current rates that include EUR', async () => {
    const day = await client.getCurrentExchangeRates();
    expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(day.rates.some((r) => r.currency === 'EUR')).toBe(true);
  });

  it('returns historical rates', async () => {
    const days = await client.getExchangeRates({
      startDate: '2024-01-02',
      endDate: '2024-01-05',
      currencies: ['EUR', 'JPY'],
    });
    expect(days.length).toBeGreaterThan(0);
    expect(days[0]!.rates.map((r) => r.currency).sort()).toEqual(['EUR', 'JPY']);
  });

  // Canary: this is expected to keep passing. If it fails, MNB has started
  // serving SOAP over HTTPS, so DEFAULT_ENDPOINT should switch to https://.
  it('still answers SOAP over HTTP only', async () => {
    const response = await fetch(DEFAULT_ENDPOINT.replace('http:', 'https:'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body/></s:Envelope>',
    });
    expect(response.status, 'HTTPS now works: make it the default endpoint').toBe(404);
  });

  it('exposes info, currencies, units and interval', async () => {
    expect((await client.getInfo()).currencies).toContain('EUR');
    expect(await client.getCurrencies()).toContain('HUF');
    expect(await client.getCurrencyUnits(['JPY'])).toEqual({ JPY: 100 });
    expect((await client.getDateInterval()).startDate).toBe('1949-01-03');
  });
});
