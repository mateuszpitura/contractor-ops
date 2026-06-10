declare module 'saxon-js' {
  const SaxonJS: {
    transform: (options: Record<string, unknown>) => Promise<unknown> | unknown;
    getPlatform: () => Record<string, unknown>;
  };
  export default SaxonJS;
}
