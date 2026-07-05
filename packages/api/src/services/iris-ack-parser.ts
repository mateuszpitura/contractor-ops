// IRS IRIS acknowledgement parser.
//
// ONE parser feeds BOTH intake paths:
//   * the manual-upload flow — an admin uploads the IRS ack XML file, and
//   * the dark A2A poll result — a structured object returned by the (flag-gated)
//     IRIS A2A transport.
// Both normalize to the same shape: one of the six IRIS acknowledgement statuses
// (mapped to the Prisma `IrisAckStatus` enum), the IRIS Error Information Group
// preserved structurally for rejection/partial detail, the transmission
// `receiptId`, and the `originalReceiptId` a replacement transmission supersedes.
//
// SECURITY: an uploaded ack file is untrusted input. It is parsed with
// fast-xml-parser (which never resolves DTD/external entities and never touches
// the network — XXE/SSRF-safe by construction) and a DOCTYPE is rejected
// outright as defense-in-depth. The structured A2A shape is validated with Zod
// (`safeParse`) — the external payload is never `as`-cast.

import { IrisAckStatus } from '@contractor-ops/db/generated/prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

/** A single entry of the IRIS Error Information Group. */
export interface IrisAckErrorInformation {
  /** IRS error / business-rule id when present. */
  errorId?: string;
  /** Human-readable error message. */
  message?: string;
  /** XPath / content location the error points at. */
  xpath?: string;
  /** The submission or record id the error applies to. */
  recordId?: string;
}

/** Normalized IRIS acknowledgement, identical for the manual and A2A paths. */
export interface ParsedIrisAck {
  status: IrisAckStatus;
  /** The IRS receipt id for this transmission. */
  receiptId?: string;
  /** The receipt id being replaced, for a replacement transmission. */
  originalReceiptId?: string;
  /** The IRIS Error Information Group (empty for a clean Accepted ack). */
  errorInformation: IrisAckErrorInformation[];
}

/**
 * The dark A2A poll result shape. Structured (already parsed by the transport),
 * so it is validated rather than XML-parsed. `ip`/network fields are never here.
 */
const a2aPollResultSchema = z
  .object({
    status: z.string().min(1),
    receiptId: z.string().min(1).optional(),
    originalReceiptId: z.string().min(1).optional(),
    errors: z
      .array(
        z
          .object({
            errorId: z.string().optional(),
            message: z.string().optional(),
            xpath: z.string().optional(),
            recordId: z.string().optional(),
          })
          .strip(),
      )
      .optional(),
  })
  .strip();

export type IrisA2APollResult = z.infer<typeof a2aPollResultSchema>;

/** Raised when the ack carries a status IRIS does not define. */
export class IrisAckParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrisAckParseError';
  }
}

/**
 * Map an IRIS status string (from XML text or the A2A result) to the enum.
 * Case-insensitive and whitespace/underscore/hyphen-insensitive so
 * `"Accepted with Errors"`, `"ACCEPTED_WITH_ERRORS"`, and `"accepted-with-errors"`
 * all normalize to the same value.
 */
function normalizeStatus(raw: string): IrisAckStatus {
  const key = raw.toLowerCase().replace(/[\s_-]+/g, '');
  switch (key) {
    case 'accepted':
      return IrisAckStatus.ACCEPTED;
    case 'rejected':
      return IrisAckStatus.REJECTED;
    case 'processing':
      return IrisAckStatus.PROCESSING;
    case 'partiallyaccepted':
      return IrisAckStatus.PARTIALLY_ACCEPTED;
    case 'acceptedwitherrors':
      return IrisAckStatus.ACCEPTED_WITH_ERRORS;
    case 'notfound':
      return IrisAckStatus.NOT_FOUND;
    default:
      throw new IrisAckParseError(`Unrecognized IRIS acknowledgement status: "${raw}"`);
  }
}

/** Coerce a fast-xml-parser scalar/element to a trimmed string, or undefined. */
function asText(value: unknown): string | undefined {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // An element with attributes parses to an object with a text node.
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return asText((value as Record<string, unknown>)['#text']);
  }
  return;
}

/** First present value across a set of candidate keys on a parsed node. */
function pick(node: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (node[key] !== undefined) return node[key];
  }
  return;
}

/** Always return an array — fast-xml-parser collapses a single element to a scalar. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const STATUS_KEYS = [
  'AcknowledgementStatusTxt',
  'AcknowledgementStatusCd',
  'TransmissionStatusTxt',
  'StatusTxt',
  'Status',
];
const RECEIPT_KEYS = ['ReceiptId', 'ReceiptID', 'TransmissionReceiptId'];
const ORIGINAL_RECEIPT_KEYS = ['OriginalReceiptId', 'OriginalReceiptID'];
const ERROR_GROUP_KEYS = ['ErrorInformationGrp', 'ErrorInformationGroup', 'ErrorDetailGrp'];
const ERROR_ENTRY_KEYS = ['ErrorDetail', 'ErrorInformation', 'Error'];

function extractErrorGroup(node: Record<string, unknown>): IrisAckErrorInformation[] {
  const group = pick(node, ERROR_GROUP_KEYS);
  if (group === null || typeof group !== 'object') return [];
  const groupNode = group as Record<string, unknown>;
  const entries = toArray(pick(groupNode, ERROR_ENTRY_KEYS) as unknown);
  return entries
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(entry => ({
      errorId: asText(pick(entry, ['ErrorId', 'ErrorID', 'RuleNum', 'ErrorCategoryCd'])),
      message: asText(pick(entry, ['ErrorMessageTxt', 'ErrorMessage', 'AlertTxt', 'message'])),
      xpath: asText(pick(entry, ['XpathContentTxt', 'XpathTxt', 'Xpath', 'xpath'])),
      recordId: asText(pick(entry, ['SubmissionId', 'RecordId', 'DocumentId', 'recordId'])),
    }));
}

function parseAckXml(xml: string): ParsedIrisAck {
  if (/<!doctype/i.test(xml) || /<!entity/i.test(xml)) {
    throw new IrisAckParseError('IRIS ack XML must not declare a DOCTYPE or ENTITY (XXE guard).');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // fast-xml-parser never fetches or expands DTD/external entities; keep the
    // 5 predefined XML entities decoding on for normal &amp; handling.
    processEntities: true,
    parseTagValue: false,
  });

  let tree: Record<string, unknown>;
  try {
    tree = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new IrisAckParseError(
      `Failed to parse IRIS ack XML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // The acknowledgement fields live under the document root element; drill into
  // the single top-level element (skipping the XML declaration node).
  const rootKey = Object.keys(tree).find(k => k !== '?xml');
  const node =
    rootKey && typeof tree[rootKey] === 'object' && tree[rootKey] !== null
      ? (tree[rootKey] as Record<string, unknown>)
      : tree;

  const statusText = asText(pick(node, STATUS_KEYS));
  if (statusText === undefined) {
    throw new IrisAckParseError('IRIS ack XML carries no recognizable status element.');
  }

  return {
    status: normalizeStatus(statusText),
    receiptId: asText(pick(node, RECEIPT_KEYS)),
    originalReceiptId: asText(pick(node, ORIGINAL_RECEIPT_KEYS)),
    errorInformation: extractErrorGroup(node),
  };
}

function parseA2AResult(input: unknown): ParsedIrisAck {
  const parsed = a2aPollResultSchema.safeParse(input);
  if (!parsed.success) {
    throw new IrisAckParseError(`Invalid IRIS A2A poll result: ${parsed.error.message}`);
  }
  const { status, receiptId, originalReceiptId, errors } = parsed.data;
  return {
    status: normalizeStatus(status),
    receiptId,
    originalReceiptId,
    errorInformation: (errors ?? []).map(e => ({
      errorId: e.errorId,
      message: e.message,
      xpath: e.xpath,
      recordId: e.recordId,
    })),
  };
}

/**
 * Parse an IRIS acknowledgement from EITHER a manual-uploaded ack XML string OR
 * the dark A2A poll-result object. Maps all six IRIS statuses to the
 * `IrisAckStatus` enum, surfaces the Error Information Group, and carries the
 * receipt / original-receipt ids.
 *
 * @throws IrisAckParseError on unrecognized status, malformed XML, a DOCTYPE
 *   (XXE guard), or an invalid A2A shape — callers `safeParse`/try-catch and
 *   record a parse failure rather than crashing.
 */
export function parseIrisAck(input: string | IrisA2APollResult): ParsedIrisAck {
  return typeof input === 'string' ? parseAckXml(input) : parseA2AResult(input);
}
