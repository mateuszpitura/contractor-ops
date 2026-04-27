export function trpcQueryKey(path: [string, string], input?: unknown): unknown[] {
  return input === undefined ? [path] : [path, input];
}

export function queryOptions(queryKey: unknown[]) {
  return { queryKey };
}

export function mutationOptions<T extends object>(opts?: T) {
  return (opts ?? {}) as T;
}
