/** A calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

export interface ExchangeRate {
  /** ISO 4217 currency code, e.g. `EUR`. */
  currency: string;
  /** How many units of the currency the published rate refers to (e.g. 100 for JPY). */
  unit: number;
  /** HUF value of `unit` units of the currency, exactly as MNB publishes it. */
  rate: number;
  /** HUF value of a single unit of the currency (`rate / unit`). */
  perUnit: number;
}

export interface ExchangeRatesDay {
  date: IsoDate;
  rates: ExchangeRate[];
}

export interface DateInterval {
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface MnbInfo {
  firstDate: IsoDate;
  lastDate: IsoDate;
  currencies: string[];
}

export interface GetExchangeRatesParams {
  startDate: IsoDate;
  endDate: IsoDate;
  currencies: string[];
}

export interface MnbClientOptions {
  /**
   * SOAP endpoint. Defaults to {@link DEFAULT_ENDPOINT}.
   * Note that MNB only answers SOAP requests over plain HTTP.
   */
  endpoint?: string;
  /** Custom `fetch` implementation (proxies, instrumentation, tests). Defaults to the global one. */
  fetch?: typeof fetch;
  /** Abort a request after this many milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
}

export interface MnbClient {
  /** Date range covered by the service and the currencies it knows about. */
  getInfo(): Promise<MnbInfo>;
  /** Every currency code the service has ever published (including historic ones). */
  getCurrencies(): Promise<string[]>;
  /** Unit each of the given currencies is quoted in (1, or 100 for e.g. JPY). */
  getCurrencyUnits(currencies: string[]): Promise<Record<string, number>>;
  /** First and last date for which rates are stored. */
  getDateInterval(): Promise<DateInterval>;
  /** Rates of the most recent banking day. */
  getCurrentExchangeRates(): Promise<ExchangeRatesDay>;
  /**
   * Rates for every banking day in the range (both ends inclusive), newest first.
   * Weekends and holidays have no entry.
   */
  getExchangeRates(params: GetExchangeRatesParams): Promise<ExchangeRatesDay[]>;
}
