import { CredentialAddDialog } from './credential-add-dialog.js';
import { CredentialsTab } from './credentials-tab.js';
import { useCredentialsTab } from './hooks/use-credentials-tab.js';

export interface CredentialsTabContainerProps {
  workflowRunId: string;
}

/**
 * Container — wires the credential-vault hook to the presentational tab + add
 * dialog for an offboarding workflow run.
 */
export function CredentialsTabContainer({ workflowRunId }: CredentialsTabContainerProps) {
  const {
    rows,
    isLoading,
    isError,
    refetch,
    addDialogOpen,
    setAddDialogOpen,
    createMutation,
    onMarkRotated,
    onRemove,
    isMutating,
  } = useCredentialsTab(workflowRunId);

  return (
    <>
      <CredentialsTab
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onAdd={() => setAddDialogOpen(true)}
        onMarkRotated={onMarkRotated}
        onRemove={onRemove}
        isMutating={isMutating}
      />
      <CredentialAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        workflowRunId={workflowRunId}
        isSubmitting={createMutation.isPending}
        onSubmit={input => createMutation.mutate(input)}
      />
    </>
  );
}
