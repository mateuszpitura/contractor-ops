import { useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { TOS_CURRENT_VERSION } from '../../../lib/tos.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useTosReacceptance() {
  const trpc = useTRPC();
  const toasts = useCommonToasts();
  const [open, setOpen] = useState(true);

  const recordToS = useResourceMutation(
    trpc.consent.recordToS.mutationOptions({
      onSuccess: () => {
        setOpen(false);
      },
    }),
    {
      successMessage: toasts.done(),
      invalidate: [trpc.consent.pathFilter()],
    },
  );

  return {
    open,
    isPending: recordToS.isPending,
    onAccept: () => recordToS.mutate({ version: TOS_CURRENT_VERSION }),
  } as const;
}
