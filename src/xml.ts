import { XMLParser } from 'fast-xml-parser';

// Elements that may legally occur once or many times; normalised to arrays so
// a single-day / single-currency response has the same shape as a longer one.
const ARRAY_ELEMENTS = new Set(['Day', 'Rate', 'Curr', 'Unit']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_ELEMENTS.has(name),
});

export type XmlNode = Record<string, unknown>;

export function parseXml(xml: string): XmlNode {
  const parsed: unknown = parser.parse(xml);
  return isNode(parsed) ? parsed : {};
}

export function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
