/**
 * TaskComments — presentational comment list + add form for a workflow task run.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { formatDistanceToNow } from 'date-fns';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import type { useTaskCommentsSection } from '../hooks/use-task-comments-section.js';

type TaskCommentsProps = ReturnType<typeof useTaskCommentsSection>;

export function TaskComments({
  body,
  setBody,
  comments,
  isLoading,
  isSubmitting,
  handleSubmit,
}: TaskCommentsProps) {
  const t = useTranslations('Workflows');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t('commentsHeading')}</h4>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`skel-${i}`} className="flex items-start gap-2">
              <Skeleton className="size-6 rounded-full shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noComments')}</p>
      ) : (
        <div className="space-y-3">
          {comments.map(comment => (
            <div key={comment.id} className="flex items-start gap-2">
              <Avatar className="size-6 shrink-0">
                {!!comment.author?.image && (
                  <AvatarImage src={comment.author.image} alt={comment.author?.name ?? ''} />
                )}
                <AvatarFallback className="text-xs">
                  {getAvatarInitials(comment.author?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium truncate">{comment.author?.name ?? 'Unknown'}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder={t('commentPlaceholder')}
          value={body}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => setBody(e.target.value)}
          rows={2}
          className="flex-1 resize-none"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          disabled={body.trim().length === 0 || isSubmitting}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={handleSubmit}
          className="self-end">
          {t('postComment')}
        </Button>
      </div>
    </div>
  );
}
