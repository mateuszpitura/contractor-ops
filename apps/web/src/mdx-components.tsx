import type { MDXComponents } from 'mdx/types';
import type { AnchorHTMLAttributes, HTMLAttributes, LiHTMLAttributes, OlHTMLAttributes } from 'react';

/**
 * MDX component map — Phase 56 Plan 07.
 *
 * Maps MDX primitive elements to Contractor Ops Typography tokens per
 * UI-SPEC §Typography / §Interaction 9. Intentionally does NOT use the
 * Tailwind `prose` plugin — privacy-notice pages share layout chrome
 * (skip-link + hero + TOC + download CTA) and need token parity with the
 * React-PDF `GdprPrivacyNoticeTemplate` (same content, same visual weight).
 *
 * `rehype-autolink-headings` wraps each heading with an `<a href="#id">`
 * at compile-time (see `next.config.ts`). The heading components below
 * therefore render `children` as-is — the anchor wrapping is transparent.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h1
        className="text-[28px] font-semibold leading-[1.15] font-display tracking-tight"
        {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h2
        className="mt-12 text-[18px] font-semibold leading-[1.25] scroll-mt-24"
        {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h3 className="mt-8 text-[14px] font-semibold leading-[1.3]" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
      <p className="mt-4 text-[14px] leading-[1.6] text-foreground" {...props}>
        {children}
      </p>
    ),
    a: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        {...props}>
        {children}
      </a>
    ),
    ul: ({ children, ...props }: HTMLAttributes<HTMLUListElement>) => (
      <ul
        className="mt-4 list-disc ps-6 text-[14px] leading-[1.6] text-foreground marker:text-muted-foreground"
        {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: OlHTMLAttributes<HTMLOListElement>) => (
      <ol
        className="mt-4 list-decimal ps-6 text-[14px] leading-[1.6] text-foreground marker:text-muted-foreground"
        {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: LiHTMLAttributes<HTMLLIElement>) => (
      <li className="mt-1" {...props}>
        {children}
      </li>
    ),
    strong: ({ children, ...props }: HTMLAttributes<HTMLElement>) => (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: HTMLAttributes<HTMLElement>) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),
    ...components,
  };
}
