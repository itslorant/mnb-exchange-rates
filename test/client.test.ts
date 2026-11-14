import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createMnbClient,
  DEFAULT_ENDPOINT,
  MnbFaultError,
  MnbHttpError,
  MnbNetworkError,
  MnbParseError,
  MnbValidationError,
} from '../src/index.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.xml`, import.meta.url), 'utf8');

/** Wraps an inner XML document the way MNB does: escaped inside <{op}Result>. */
function soapResponse(operation: string, innerXml: string): string {
  const escaped = innerXml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    `<${operation}Response xmlns="http://www.mnb.hu/webservices/">` +
    `<${operation}Result>${escaped}</${operation}Result>` +
    `</${operation}Response></s:Body></s:Envelope>`
  );
}

function clientReturning(body: string, init: ResponseInit = {}) {
  const fetchMock = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(body, { status: 200, ...init }),
  );
  return { client: createMnbClient({ fetch: fetchMock }), fetchMock };
}

describe('request', () => {
  it('posts a SOAP envelope with the right action and arguments', async () => {
    const { client, fetchMock } = clientReturning(fixture('GetExchangeRates'));

    await client.getExchangeRates({
      startDate: '2026-11-09',
      endDate: '2026-11-13',
      currencies: ['eur', 'JPY'],
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(DEFAULT_ENDPOINT);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      SOAPAction: '"http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates"',
    });
    const body = String(init?.body);
    expect(body).toContain('<GetExchangeRates xmlns="http://www.mnb.hu/webservices/">');
    expect(body).toContain('<startDate>2026-11-09</startDate>');
    expect(body).toContain('<endDate>2026-11-13</endDate>');
    expect(body).toContain('<currencyNames>EUR,JPY</currencyNames>');
  });

  it('uses a custom endpoint', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request) => new Response(fixture('GetInfo')),
    );
    const client = createMnbClient({ endpoint: 'https://proxy.test/mnb', fetch: fetchMock });

    await client.getInfo();

    expect(fetchMock.mock.calls[0]![0]).toBe('https://proxy.test/mnb');
  });
});

describe('getExchangeRates', () => {
  it('parses multiple days with comma decimals, newest first', async () => {
    const { client } = clientReturning(fixture('GetExchangeRates'));

    const days = await client.getExchangeRates({
      startDate: '2026-11-09',
      endDate: '2026-11-13',
      currencies: ['EUR', 'JPY'],
    });

    expect(days.map((d) => d.date)).toEqual([
      '2026-11-13',
      '2026-11-12',
      '2026-11-11',
      '2026-11-10',
      '2026-11-09',
    ]);
    expect(days[0]!.rates).toEqual([
      { currency: 'EUR', unit: 1, rate: 365.67, perUnit: 365.67 },
      { currency: 'JPY', unit: 100, rate: 206.82, perUnit: 2.0682 },
    ]);
  });

  it('normalises a single day with a single rate to arrays', async () => {
    const { client } = clientReturning(
      soapResponse(
        'GetExchangeRates',
        '<MNBExchangeRates><Day date="2026-11-13"><Rate unit="1" curr="EUR">365,67000</Rate></Day></MNBExchangeRates>',
      ),
    );

    const days = await client.getExchangeRates({
      startDate: '2026-11-13',
      endDate: '2026-11-13',
      currencies: ['EUR'],
    });

    expect(days).toEqual([
      { date: '2026-11-13', rates: [{ currency: 'EUR', unit: 1, rate: 365.67, perUnit: 365.67 }] },
    ]);
  });

  it('returns no days when the range has no banking day', async () => {
    const { client } = clientReturning(soapResponse('GetExchangeRates', '<MNBExchangeRates />'));

    await expect(
      client.getExchangeRates({ startDate: '2026-11-14', endDate: '2026-11-15', currencies: ['EUR'] }),
    ).resolves.toEqual([]);
  });

  it('returns an empty rates list for an unknown currency', async () => {
    const { client } = clientReturning(
      soapResponse('GetExchangeRates', '<MNBExchangeRates><Day date="2026-11-13" /></MNBExchangeRates>'),
    );

    await expect(
      client.getExchangeRates({ startDate: '2026-11-13', endDate: '2026-11-13', currencies: ['XXX'] }),
    ).resolves.toEqual([{ date: '2026-11-13', rates: [] }]);
  });

  it('rejects bad arguments before sending anything', async () => {
    const { client, fetchMock } = clientReturning('');
    const ok = { startDate: '2026-11-09', endDate: '2026-11-13', currencies: ['EUR'] };

    await expect(client.getExchangeRates({ ...ok, startDate: '09/11/2026' })).rejects.toBeInstanceOf(MnbValidationError);
    await expect(client.getExchangeRates({ ...ok, endDate: '2026-02-30' })).rejects.toBeInstanceOf(MnbValidationError);
    await expect(client.getExchangeRates({ ...ok, startDate: '2026-11-14' })).rejects.toBeInstanceOf(MnbValidationError);
    await expect(client.getExchangeRates({ ...ok, currencies: [] })).rejects.toBeInstanceOf(MnbValidationError);
    await expect(client.getExchangeRates({ ...ok, currencies: ['EURO'] })).rejects.toBeInstanceOf(MnbValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getCurrentExchangeRates', () => {
  it('returns the latest day with unit-aware rates', async () => {
    const { client } = clientReturning(fixture('GetCurrentExchangeRates'));

    const day = await client.getCurrentExchangeRates();

    expect(day.date).toBe('2026-11-13');
    expect(day.rates.find((r) => r.currency === 'EUR')).toEqual({
      currency: 'EUR',
      unit: 1,
      rate: 365.67,
      perUnit: 365.67,
    });
    expect(day.rates.find((r) => r.currency === 'JPY')).toMatchObject({ unit: 100, rate: 206.82 });
  });
});

describe('getCurrencies / getInfo / getDateInterval / getCurrencyUnits', () => {
  it('lists currencies', async () => {
    const { client } = clientReturning(fixture('GetCurrencies'));
    const currencies = await client.getCurrencies();
    expect(currencies).toEqual(expect.arrayContaining(['HUF', 'EUR', 'USD']));
  });

  it('returns info', async () => {
    const { client } = clientReturning(fixture('GetInfo'));
    const info = await client.getInfo();
    expect(info.firstDate).toBe('1949-01-03');
    expect(info.lastDate).toBe('2026-11-13');
    expect(info.currencies).toContain('EUR');
  });

  it('returns the stored date interval', async () => {
    const { client } = clientReturning(fixture('GetDateInterval'));
    await expect(client.getDateInterval()).resolves.toEqual({
      startDate: '1949-01-03',
      endDate: '2026-11-13',
    });
  });

  it('returns units per currency', async () => {
    const { client } = clientReturning(fixture('GetCurrencyUnits'));
    await expect(client.getCurrencyUnits(['EUR', 'JPY'])).resolves.toEqual({ EUR: 1, JPY: 100 });
  });

  it('returns no units for unknown currencies', async () => {
    const { client } = clientReturning(
      soapResponse('GetCurrencyUnits', '<MNBCurrencyUnits><Units /></MNBCurrencyUnits>'),
    );
    await expect(client.getCurrencyUnits(['XXX'])).resolves.toEqual({});
  });
});

describe('errors', () => {
  it('maps a SOAP fault, even on HTTP 500', async () => {
    const { client } = clientReturning(fixture('fault'), { status: 500 });

    const error = await client
      .getExchangeRates({ startDate: '2026-11-13', endDate: '2026-11-13', currencies: ['EUR'] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MnbFaultError);
    expect(error).toMatchObject({
      faultCode: 'a:InternalServiceFault',
      faultString: 'Hibás dátumformát',
    });
  });

  it('maps a non-SOAP HTTP error', async () => {
    const { client } = clientReturning('Not Found', { status: 404, statusText: 'Not Found' });
    const error = await client.getInfo().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MnbHttpError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('maps a network failure', async () => {
    const client = createMnbClient({
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(client.getInfo()).rejects.toBeInstanceOf(MnbNetworkError);
  });

  it('rejects a response without the expected result element', async () => {
    const { client } = clientReturning('<html>maintenance</html>');
    await expect(client.getInfo()).rejects.toBeInstanceOf(MnbParseError);
  });

  it('rejects a rate that is not a number', async () => {
    const { client } = clientReturning(
      soapResponse(
        'GetCurrentExchangeRates',
        '<MNBCurrentExchangeRates><Day date="2026-11-13"><Rate unit="1" curr="EUR">n/a</Rate></Day></MNBCurrentExchangeRates>',
      ),
    );
    await expect(client.getCurrentExchangeRates()).rejects.toBeInstanceOf(MnbParseError);
  });
});
