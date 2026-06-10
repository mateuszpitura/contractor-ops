import type { PrismaClient } from '@contractor-ops/db';

import { makeError } from './shared.js';
import type { ConfirmMatchInput } from './types.js';

export async function confirmMatch(db: PrismaClient, input: ConfirmMatchInput): Promise<void> {
  const intake = await db.invoiceIntakeRequest.findUnique({
    where: { id: input.intakeId },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });
  if (!intake || intake.organizationId !== input.orgId) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }
  if (intake.status !== 'PARSED' && intake.status !== 'NEEDS_REVIEW') {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Cannot confirm match on intake in status ${intake.status}`,
    );
  }

  const contractor = await db.contractor.findFirst({
    where: { id: input.contractorId, organizationId: input.orgId },
    select: { id: true },
  });
  if (!contractor) {
    throw makeError('NOT_FOUND', `Contractor ${input.contractorId} not found`);
  }

  if (input.contractId) {
    const contract = await db.contract.findFirst({
      where: {
        id: input.contractId,
        organizationId: input.orgId,
        contractorId: input.contractorId,
      },
      select: { id: true },
    });
    if (!contract) {
      throw makeError('NOT_FOUND', `Contract ${input.contractId} not found`);
    }
  }

  await db.invoiceIntakeRequest.update({
    where: { id: input.intakeId },
    data: {
      matchedContractorId: input.contractorId,
      matchedContractId: input.contractId ?? null,
      status: 'MATCHED',
    },
  });
}
