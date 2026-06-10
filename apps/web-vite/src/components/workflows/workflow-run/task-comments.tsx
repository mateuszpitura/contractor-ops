/**
 * TaskComments — presentational comment list + add form for a workflow task run.
 * View is single render path per variant; container picks loading vs list.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@contractor-ops/ui/components/shadcn/avatar';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { formatDistanceToNow } from 'date-fns';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { getAvatarInitials } from '../../../lib/avatar-initials.js';
import { useTaskCommentsSection } from '../hooks/use-task-comments-section.js';

type TaskCommentRow = ReturnType<typeof useTaskCommentsSection>['comments'][number];

export function TaskCommentsSkeleton() {
  return (
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
  );
}

interface TaskCommentsListProps {
  comments: TaskCommentRow[];
}

export function TaskCommentsList({ comments }: TaskCommentsListProps) {
  const t = useTranslations('Workflows');
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noComments')}</p>;
  }
  return (
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
  );
}

interface TaskCommentsComposerProps {
  body: string;
  setBody: (value: string) => void;
  isSubmitting: boolean;
  handleSubmit: () => void;
}

export function TaskCommentsComposer({
  body,
  setBody,
  isSubmitting,
  handleSubmit,
}: TaskCommentsComposerProps) {
  const t = useTranslations('Workflows');
  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value),
    [setBody],
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex gap-2">
      <Textarea
        placeholder={t('commentPlaceholder')}
        value={body}
        onChange={handleBodyChange}
        rows={2}
        className="flex-1 resize-none"
        onKeyDown={handleKeyDown}
      />
      <Button
        size="sm"
        disabled={body.trim().length === 0 || isSubmitting}
        onClick={handleSubmit}
        className="self-end">
        {t('postComment')}
      </Button>
    </div>
  );
}

type TaskCommentsViewProps = ReturnType<typeof useTaskCommentsSection>;

export function TaskCommentsView({
  body,
  setBody,
  comments,
  isLoading,
  isSubmitting,
  handleSubmit,
}: TaskCommentsViewProps) {
  const t = useTranslations('Workflows');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t('commentsHeading')}</h4>
      {isLoading ? <TaskCommentsSkeleton /> : <TaskCommentsList comments={comments} />}
      <TaskCommentsComposer
        body={body}
        setBody={setBody}
        isSubmitting={isSubmitting}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}

interface TaskCommentsProps {
  runId: string;
  taskRunId: string;
}

export function TaskComments({ runId, taskRunId }: TaskCommentsProps) {
  const section = useTaskCommentsSection(runId, taskRunId);
  return <TaskCommentsView {...section} />;
}
