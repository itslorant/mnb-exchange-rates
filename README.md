# mnb-exchange-rates

A small, fully typed client for the exchange rate web service of the
[Hungarian National Bank](https://www.mnb.hu) (Magyar Nemzeti Bank, MNB).

It covers every operation the service offers, has a single runtime dependency
(an XML parser), and works in Node.js 20+ with both ESM and CommonJS.

```ts
import { createMnbClient } from '@itslorant/mnb-exchange-rates';

const mnb = createMnbClient();

const days = await mnb.getExchangeRates({
  startDate: '2026-11-09',
  endDate: '2026-11-13',
  currencies: ['EUR', 'JPY'],
});

days[0];
// {
//   date: '2026-11-13',
//   rates: [
//     { currency: 'EUR', unit: 1,   rate: 365.67, perUnit: 365.67 },
//     { currency: 'JPY', unit: 100, rate: 206.82, perUnit: 2.0682 },
//   ]
// }
```

## Why this exists

MNB publishes the official HUF exchange rates through a SOAP service. The
usual Node SOAP libraries are large, pull in a deep dependency tree, and give
you untyped results. This package talks to the service directly: it builds the
small SOAP request itself, parses the response, and returns plain typed
objects. There is no generated code and no runtime schema download.

## Install

```sh
npm install @itslorant/mnb-exchange-rates
# or: pnpm add @itslorant/mnb-exchange-rates
```

Requires Node.js 20 or newer (it uses the built-in `fetch`).

## Usage

Create a client once and reuse it:

```ts
const mnb = createMnbClient({
  // all optional
  endpoint: 'http://www.mnb.hu/arfolyamok.asmx',
  timeoutMs: 10_000,
  fetch: myCustomFetch, // proxies, logging, tests
});
```

### Methods

| Method | Returns |
| --- | --- |
| `getCurrentExchangeRates()` | `{ date, rates }` for the most recent banking day, all currencies |
| `getExchangeRates({ startDate, endDate, currencies })` | one `{ date, rates }` per banking day in the range, newest first |
| `getCurrencyUnits(currencies)` | `{ EUR: 1, JPY: 100 }`: the unit each currency is quoted in |
| `getCurrencies()` | every currency code the service has ever published, including historic ones (DEM, ATS, …) |
| `getDateInterval()` | `{ startDate, endDate }`: the range for which rates are stored |
| `getInfo()` | `{ firstDate, lastDate, currencies }` |

Dates are `YYYY-MM-DD` strings and are validated before anything is sent.
Currency codes are three letters and are case-insensitive.

### A rate is `rate` per `unit`

MNB quotes some currencies per 100 units. Every rate therefore carries:

- `rate`: the value exactly as MNB publishes it (HUF for `unit` units)
- `unit`: `1` or `100`
- `perUnit`: `rate / unit`, the HUF price of one single unit

Use `perUnit` unless you specifically want the published figure. Using `rate`
for JPY, IDR or KRW without dividing by `unit` is off by a factor of 100.

### Weekends, holidays and unknown currencies

There are no rates on non-banking days, and the service does not treat that as
an error:

- A range without any banking day resolves to `[]`.
- An unknown currency code resolves to a day with an empty `rates` array.

If you need "the rate in force on a given date", request a window that reaches
back far enough (a week or so) and take the newest entry on or before that
date.

### Numbers

Rates are plain JavaScript numbers parsed from MNB's decimal-comma strings
(`365,67000`). That is fine for display and estimates. If you do accounting
arithmetic on them, convert to a decimal type first.

## Errors

Everything thrown extends `MnbError`, so one `catch` can handle the package as
a whole, and `instanceof` tells you what went wrong:

| Error | When |
| --- | --- |
| `MnbValidationError` | bad arguments (malformed date, empty or invalid currency list); nothing was sent |
| `MnbNetworkError` | DNS failure, connection error or timeout; the original error is in `cause` |
| `MnbHttpError` | non-2xx response that was not a SOAP fault (`status` is available) |
| `MnbFaultError` | the service returned a SOAP fault (`faultCode`, `faultString`) |
| `MnbParseError` | the response did not have the expected shape |

```ts
import { MnbFaultError, MnbNetworkError } from '@itslorant/mnb-exchange-rates';

try {
  await mnb.getCurrentExchangeRates();
} catch (error) {
  if (error instanceof MnbNetworkError) {
    // retry later
  } else {
    throw error;
  }
}
```

## HTTP only

The MNB service answers SOAP requests over plain **HTTP** only. The same URL
over HTTPS returns `404`. That is why the default endpoint is
`http://www.mnb.hu/arfolyamok.asmx`, the address the service's own WSDL
advertises.

Practically, that means the data is not protected against tampering in
transit. If that matters for your use case, cross-check critical values, or
route requests through a trusted proxy by passing your own `endpoint`.

## How it works

Each method sends one SOAP 1.1 request with `fetch`:

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <GetExchangeRates xmlns="http://www.mnb.hu/webservices/">
      <startDate>2026-11-09</startDate>
      <endDate>2026-11-13</endDate>
      <currencyNames>EUR,JPY</currencyNames>
    </GetExchangeRates>
  </s:Body>
</s:Envelope>
```

with the header `SOAPAction: "http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates"`.

MNB's responses are unusual: the actual data is an XML document **escaped as a
string** inside `<GetExchangeRatesResult>`. The client parses the SOAP envelope,
extracts that string, and parses it a second time. Numbers use a decimal comma,
and elements that can repeat (`Day`, `Rate`, …) are normalised to arrays so a
one-day answer has the same shape as a one-year answer. Faults are detected
before the HTTP status is checked, because the service sends them with
status 500.

Parsers are small, hand-written and strict: if a field is missing or a number
does not parse, you get an `MnbParseError` naming the element instead of an
`undefined` somewhere downstream.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test         # unit tests against recorded real responses (offline)
pnpm test:live    # same API, against the real MNB service
pnpm build
```

The recorded responses in `test/fixtures/` were captured from the live service.
The unit tests mock `fetch` and run offline.

## Disclaimer

This is an independent, unofficial client and is not affiliated with or
endorsed by the Magyar Nemzeti Bank. Check MNB's own terms for how you may use
the published data.

## License

[MIT](./LICENSE)
