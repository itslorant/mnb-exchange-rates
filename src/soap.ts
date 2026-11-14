import {
  MnbFaultError,
  MnbHttpError,
  MnbNetworkError,
  MnbParseError,
} from './errors.js';
import { escapeXml, isNode, parseXml, type XmlNode } from './xml.js';

export const SERVICE_NAMESPACE = 'http://www.mnb.hu/webservices/';
const SOAP_ACTION_PREFIX = `${SERVICE_NAMESPACE}MNBArfolyamServiceSoap/`;

export interface Transport {
  endpoint: string;
  fetch: typeof fetch;
  timeoutMs: number;
}

function buildEnvelope(
  operation: string,
  params: Record<string, string>,
): string {
  const args = Object.entries(params)
    .map(([name, value]) => `<${name}>${escapeXml(value)}</${name}>`)
    .join('');
  return (
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    `<s:Body><${operation} xmlns="${SERVICE_NAMESPACE}">${args}</${operation}></s:Body>` +
    '</s:Envelope>'
  );
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isNode(value) && typeof value['#text'] === 'string') {
    return value['#text'];
  }
  return '';
}

/**
 * Calls one operation and returns the parsed inner document.
 *
 * MNB wraps its payload as an XML *string* inside `<{operation}Result>`, so
 * the response has to be parsed twice: once for the SOAP envelope, once for
 * the escaped XML it carries.
 */
export async function callOperation(
  transport: Transport,
  operation: string,
  params: Record<string, string> = {},
): Promise<XmlNode> {
  let response: Response;
  let text: string;
  try {
    response = await transport.fetch(transport.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${SOAP_ACTION_PREFIX}${operation}"`,
      },
      body: buildEnvelope(operation, params),
      signal: AbortSignal.timeout(transport.timeoutMs),
    });
    text = await response.text();
  } catch (cause) {
    throw new MnbNetworkError(`Request to MNB failed: ${operation}`, { cause });
  }

  const envelope = parseXml(text);
  const body = isNode(envelope['Envelope']) ? envelope['Envelope']['Body'] : undefined;

  // Faults come back with HTTP 500, so inspect the body before the status.
  if (isNode(body) && isNode(body['Fault'])) {
    throw new MnbFaultError(
      textOf(body['Fault']['faultcode']) || 'unknown',
      textOf(body['Fault']['faultstring']) ||
        textOf(isNode(body['Fault']['detail']) ? body['Fault']['detail']['string'] : '') ||
        'no reason given',
    );
  }

  if (!response.ok) {
    throw new MnbHttpError(response.status, response.statusText);
  }

  const wrapper = isNode(body) ? body[`${operation}Response`] : undefined;
  const result = isNode(wrapper) ? wrapper[`${operation}Result`] : undefined;
  if (typeof result !== 'string' || result === '') {
    throw new MnbParseError(`Unexpected response shape for ${operation}`);
  }

  return parseXml(result);
}
