'use client';

import { cn } from '@contractor-ops/ui/lib/utils';
import { useCallback, useEffect, useState } from 'react';

type ReactionKey = 'thumbs' | 'heart' | 'party';

const REACTIONS: ReadonlyArray<{ key: ReactionKey; emoji: string; label: string }> = [
  { key: 'thumbs', emoji: '👍', label: 'Useful' },
  { key: 'heart', emoji: '❤️', label: 'Loved it' },
  { key: 'party', emoji: '🎉', label: 'Great news' },
];

interface ReactionsProps {
  postId: number;
}

export function Reactions({ postId }: ReactionsProps) {
  const storageKey = `co-blog-reactions:${postId}`;
  const [picked, setPicked] = useState<ReactionKey | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setPicked((window.localStorage.getItem(storageKey) as ReactionKey | null) ?? null);
  }, [storageKey]);

  const onToggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (typeof window === 'undefined') {
        return;
      }
      const key = event.currentTarget.dataset.reactionKey as ReactionKey | undefined;
      if (!key) {
        return;
      }
      const next = picked === key ? null : key;
      setPicked(next);
      if (next) {
        window.localStorage.setItem(storageKey, next);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    },
    [picked, storageKey],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Found this useful?
      </span>
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 p-1 backdrop-blur">
        {REACTIONS.map(reaction => {
          const active = picked === reaction.key;
          return (
            <button
              key={reaction.key}
              type="button"
              data-reaction-key={reaction.key}
              onClick={onToggle}
              aria-pressed={active}
              aria-label={reaction.label}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform',
                'hover:scale-110 active:scale-95',
                active && 'bg-primary/15 ring-2 ring-primary/30',
              )}>
              <span aria-hidden>{reaction.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
