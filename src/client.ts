import { MnbValidationError } from './errors.js';
import {
  parseCurrencies,
  parseCurrencyUnits,
  parseCurrentExchangeRates,
  parseDateInterval,
  parseExchangeRates,
  parseInfo,
} from './parse.js';
import { callOperation, type Transport } from './soap.js';
import type { IsoDate, MnbClient, MnbClientOptions } from './types.js';

/**
 * MNB serves SOAP over plain HTTP only: the same path over HTTPS answers 404.
 * Override via {@link MnbClientOptions.endpoint} if that ever changes, or to
 * route through a proxy.
 */
export const DEFAULT_ENDPOINT = 'http://www.mnb.hu/arfolyamok.asmx';

const DEFAULT_TIMEOUT_MS = 10_000;

function assertDate(value: string, name: string): void {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!valid) {
    throw new MnbValidationError(
      `${name} must be a real date formatted as YYYY-MM-DD, got "${value}"`,
    );
  }
}

function currencyList(currencies: string[]): string {
  if (currencies.length === 0) {
    throw new MnbValidationError('At least one currency code is required');
  }
  for (const code of currencies) {
    if (!/^[A-Za-z]{3}$/.test(code)) {
      throw new MnbValidationError(
        `"${code}" is not a three-letter currency code`,
      );
    }
  }
  return currencies.map((code) => code.toUpperCase()).join(',');
}

export function createMnbClient(options: MnbClientOptions = {}): MnbClient {
  const transport: Transport = {
    endpoint: options.endpoint ?? DEFAULT_ENDPOINT,
    fetch: options.fetch ?? globalThis.fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };

  return {
    async getInfo() {
      return parseInfo(await callOperation(transport, 'GetInfo'));
    },

    async getCurrencies() {
      return parseCurrencies(await callOperation(transport, 'GetCurrencies'));
    },

    async getCurrencyUnits(currencies) {
      const doc = await callOperation(transport, 'GetCurrencyUnits', {
        currencyNames: currencyList(currencies),
      });
      return parseCurrencyUnits(doc);
    },

    async getDateInterval() {
      return parseDateInterval(await callOperation(transport, 'GetDateInterval'));
    },

    async getCurrentExchangeRates() {
      return parseCurrentExchangeRates(
        await callOperation(transport, 'GetCurrentExchangeRates'),
      );
    },

    async getExchangeRates({ startDate, endDate, currencies }) {
      assertDate(startDate, 'startDate');
      assertDate(endDate, 'endDate');
      if ((startDate as IsoDate) > endDate) {
        throw new MnbValidationError('startDate must not be after endDate');
      }
      const doc = await callOperation(transport, 'GetExchangeRates', {
        startDate,
        endDate,
        currencyNames: currencyList(currencies),
      });
      return parseExchangeRates(doc);
    },
  };
}
