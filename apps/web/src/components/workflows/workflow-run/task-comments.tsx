"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { getAvatarInitials } from "@/lib/avatar-initials";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCommentsProps {
  runId: string;
  taskRunId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskComments({ runId, taskRunId }: TaskCommentsProps) {
  const t = useTranslations("Workflows");
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const commentsQuery = useQuery(
    trpc.workflow.listComments.queryOptions({
      workflowRunId: runId,
      workflowTaskRunId: taskRunId,
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = (commentsQuery.data ?? []) as any[];

  const addCommentMutation = useMutation(
    trpc.workflow.addComment.mutationOptions({
      onSuccess: () => {
        toast.success(t("toastCommentPosted"));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.listComments.queryKey({
            workflowRunId: runId,
            workflowTaskRunId: taskRunId,
          }),
        });
        setBody("");
      },
      onError: () => {
        toast.error(t("errors.failedToPostComment"));
      },
    }),
  );

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    addCommentMutation.mutate({
      workflowRunId: runId,
      workflowTaskRunId: taskRunId,
      body: trimmed,
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{t("commentsHeading")}</h4>

      {/* Comment list */}
      {commentsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="size-6 rounded-full shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noComments")}</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2">
              <Avatar className="size-6 shrink-0">
                {comment.author?.image && (
                  <AvatarImage src={comment.author.image} alt={comment.author?.name ?? ""} />
                )}
                <AvatarFallback className="text-xs">
                  {getAvatarInitials(comment.author?.name, comment.author?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium truncate">
                    {comment.author?.name ?? "Unknown"}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {comment.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment input */}
      <div className="flex gap-2">
        <Textarea
          placeholder={t("commentPlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          disabled={body.trim().length === 0 || addCommentMutation.isPending}
          onClick={handleSubmit}
          className="self-end"
        >
          {t("postComment")}
        </Button>
      </div>
    </div>
  );
}
