import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { TOS_CURRENT_VERSION } from '../../../lib/tos.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useTosReacceptance() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();
  const [open, setOpen] = useState(true);

  const recordToS = useMutation(
    trpc.consent.recordToS.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.consent.pathFilter());
        toast.success(toasts.done());
        setOpen(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  return {
    open,
    isPending: recordToS.isPending,
    onAccept: () => recordToS.mutate({ version: TOS_CURRENT_VERSION }),
  } as const;
}
