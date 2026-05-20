'use client';

import { Check, Copy, Link as LinkIcon, Send, Share2 } from 'lucide-react';
import { useCallback, useState } from 'react';

interface ShareDropdownProps {
  url: string;
  title: string;
}

export function ShareDropdown({ url, title }: ShareDropdownProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof navigator === 'undefined') {
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [url]);

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 p-1 backdrop-blur">
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="Share on X">
        <Send aria-hidden className="size-4" />
      </a>
      <a
        href={linkedinHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="Share on LinkedIn">
        <Share2 aria-hidden className="size-4" />
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        aria-label="Copy link">
        {copied ? (
          <Check aria-hidden className="size-4 text-primary" />
        ) : (
          <LinkIcon aria-hidden className="size-4" />
        )}
        <span className="hidden md:inline">{copied ? 'Copied' : 'Copy link'}</span>
        {copied ? null : <Copy aria-hidden className="size-3 md:hidden" />}
      </button>
    </div>
  );
}
