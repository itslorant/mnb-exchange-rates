import { MnbParseError } from './errors.js';
import type {
  DateInterval,
  ExchangeRate,
  ExchangeRatesDay,
  MnbInfo,
} from './types.js';
import { isNode, type XmlNode } from './xml.js';

function node(parent: XmlNode, key: string, context: string): XmlNode {
  const value = parent[key];
  if (!isNode(value)) {
    throw new MnbParseError(`${context}: missing <${key}>`);
  }
  return value;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, context: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new MnbParseError(`${context}: expected a non-empty string`);
  }
  return value;
}

/** MNB formats decimals with a comma: `365,67000`. */
export function parseDecimal(value: unknown, context: string): number {
  const number = Number(str(value, context).replace(',', '.'));
  if (!Number.isFinite(number)) {
    throw new MnbParseError(`${context}: "${String(value)}" is not a number`);
  }
  return number;
}

function parseRate(raw: unknown): ExchangeRate {
  if (!isNode(raw)) throw new MnbParseError('Rate: expected an element');
  const currency = str(raw['@_curr'], 'Rate@curr');
  const unit = parseDecimal(raw['@_unit'], `Rate ${currency} unit`);
  const rate = parseDecimal(raw['#text'], `Rate ${currency} value`);
  if (unit <= 0) throw new MnbParseError(`Rate ${currency}: unit must be > 0`);
  return { currency, unit, rate, perUnit: rate / unit };
}

function parseDay(raw: unknown): ExchangeRatesDay {
  if (!isNode(raw)) throw new MnbParseError('Day: expected an element');
  return {
    date: str(raw['@_date'], 'Day@date'),
    rates: list(raw['Rate']).map(parseRate),
  };
}

export function parseExchangeRates(doc: XmlNode): ExchangeRatesDay[] {
  const root = doc['MNBExchangeRates'];
  // No banking day in the range (e.g. a weekend) yields an empty root element.
  if (root === '') return [];
  return list(node(doc, 'MNBExchangeRates', 'GetExchangeRates')['Day']).map(
    parseDay,
  );
}

export function parseCurrentExchangeRates(doc: XmlNode): ExchangeRatesDay {
  const [day] = list(
    node(doc, 'MNBCurrentExchangeRates', 'GetCurrentExchangeRates')['Day'],
  );
  if (day === undefined) {
    throw new MnbParseError('GetCurrentExchangeRates: no <Day> in response');
  }
  return parseDay(day);
}

export function parseCurrencies(doc: XmlNode): string[] {
  const root = node(doc, 'MNBCurrencies', 'GetCurrencies');
  return list(node(root, 'Currencies', 'GetCurrencies')['Curr']).map((c) =>
    str(c, 'Curr'),
  );
}

export function parseCurrencyUnits(doc: XmlNode): Record<string, number> {
  const root = node(doc, 'MNBCurrencyUnits', 'GetCurrencyUnits');
  // Unknown currencies produce an empty <Units/>.
  const units = isNode(root['Units']) ? list(root['Units']['Unit']) : [];
  const result: Record<string, number> = {};
  for (const unit of units) {
    if (!isNode(unit)) throw new MnbParseError('Unit: expected an element');
    const currency = str(unit['@_curr'], 'Unit@curr');
    result[currency] = parseDecimal(unit['#text'], `Unit ${currency}`);
  }
  return result;
}

export function parseDateInterval(doc: XmlNode): DateInterval {
  const root = node(doc, 'MNBStoredInterval', 'GetDateInterval');
  const interval = node(root, 'DateInterval', 'GetDateInterval');
  return {
    startDate: str(interval['@_startdate'], 'DateInterval@startdate'),
    endDate: str(interval['@_enddate'], 'DateInterval@enddate'),
  };
}

export function parseInfo(doc: XmlNode): MnbInfo {
  const root = node(doc, 'MNBExchangeRatesQueryValues', 'GetInfo');
  return {
    firstDate: str(root['FirstDate'], 'FirstDate'),
    lastDate: str(root['LastDate'], 'LastDate'),
    currencies: list(node(root, 'Currencies', 'GetInfo')['Curr']).map((c) =>
      str(c, 'Curr'),
    ),
  };
}
