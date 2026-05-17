import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  LiHTMLAttributes,
  OlHTMLAttributes,
} from 'react';

export function H1({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className="text-[28px] font-semibold leading-[1.15] font-display tracking-tight" {...props}>
      {children}
    </h1>
  );
}

export function H2({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className="mt-12 text-[18px] font-semibold leading-[1.25] scroll-mt-24" {...props}>
      {children}
    </h2>
  );
}

export function H3({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className="mt-8 text-[14px] font-semibold leading-[1.3]" {...props}>
      {children}
    </h3>
  );
}

export function P({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className="mt-4 text-[14px] leading-[1.6] text-foreground" {...props}>
      {children}
    </p>
  );
}

export function A({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      {...props}>
      {children}
    </a>
  );
}

export function Ul({ children, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className="mt-4 list-disc ps-6 text-[14px] leading-[1.6] text-foreground marker:text-muted-foreground"
      {...props}>
      {children}
    </ul>
  );
}

export function Ol({ children, ...props }: OlHTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className="mt-4 list-decimal ps-6 text-[14px] leading-[1.6] text-foreground marker:text-muted-foreground"
      {...props}>
      {children}
    </ol>
  );
}

export function Li({ children, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li className="mt-1" {...props}>
      {children}
    </li>
  );
}

export function Strong({ children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  );
}

export function Em({ children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <em className="italic" {...props}>
      {children}
    </em>
  );
}
