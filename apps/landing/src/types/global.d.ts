// CSS side-effect imports (handled by Next.js bundler, not tsc).
// tsc ignores these by default but tsgo (TypeScript native preview) treats
// them strict — declare here so both compilers accept the import.
declare module '*.css';
