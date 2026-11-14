/** Base class for every error thrown by this package. */
export class MnbError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MnbError';
  }
}

/** The arguments passed to a client method were rejected before any request was sent. */
export class MnbValidationError extends MnbError {
  constructor(message: string) {
    super(message);
    this.name = 'MnbValidationError';
  }
}

/** The request failed at the network level (DNS, connection, timeout). */
export class MnbNetworkError extends MnbError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MnbNetworkError';
  }
}

/** The server answered with a non-2xx status that was not a SOAP fault. */
export class MnbHttpError extends MnbError {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`MNB responded with HTTP ${status} ${statusText}`.trim());
    this.name = 'MnbHttpError';
    this.status = status;
  }
}

/** The service returned a SOAP fault, e.g. for a malformed date. */
export class MnbFaultError extends MnbError {
  readonly faultCode: string;
  readonly faultString: string;

  constructor(faultCode: string, faultString: string) {
    super(`MNB SOAP fault (${faultCode}): ${faultString}`);
    this.name = 'MnbFaultError';
    this.faultCode = faultCode;
    this.faultString = faultString;
  }
}

/** The response did not have the shape this package expects. */
export class MnbParseError extends MnbError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MnbParseError';
  }
}
