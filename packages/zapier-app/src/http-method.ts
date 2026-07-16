// Narrow the generated definition's plain method strings onto the platform's
// HTTP method union. The generator emits uppercase strings; this fails closed on
// anything the platform request schema does not accept.

export const HTTP_METHODS = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD'] as const;

export type ZapierHttpMethod = (typeof HTTP_METHODS)[number];

export function toHttpMethod(method: string): ZapierHttpMethod {
  const match = HTTP_METHODS.find(known => known === method.toUpperCase());
  if (!match) {
    throw new Error(`Unsupported HTTP method: ${method}`);
  }
  return match;
}
