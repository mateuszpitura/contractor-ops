/**
 * Equipment courier integration procedures: InPost, DPD, UPS shipment
 * creation, courier config management, connection testing, and label retrieval.
 */
import type { Prisma, Shipment } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import {
  dpdConfigSchema,
  dpdShipmentCreateSchema,
  inpostShipmentCreateSchema,
  upsConfigSchema,
  upsShipmentCreateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { adminProcedure, requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { requireTier } from '../middleware/tier.js';
import { getCourierClient } from '../services/courier/carrier-factory.js';
import type { DPDClientConfig } from '../services/courier/dpd-client.js';
import { DPDClient } from '../services/courier/dpd-client.js';
import type { InPostClientConfig } from '../services/courier/inpost-client.js';
import { InPostClient } from '../services/courier/inpost-client.js';
import type { UPSClientConfig } from '../services/courier/ups-client.js';
import { UPSClient } from '../services/courier/ups-client.js';
import { checkShipmentTaskCompletion } from '../services/equipment-workflow.js';
import {
  EQUIPMENT_NOT_ASSIGNED,
  EQUIPMENT_NOT_FOUND,
  EQUIPMENT_STATUS_TRANSITIONS,
  plain,
  SHIPMENT_NOT_FOUND,
} from './equipment-shared.js';

const log = createLogger({ service: 'equipment-couriers-router' });

// ---------------------------------------------------------------------------
// Equipment Couriers sub-router
// ---------------------------------------------------------------------------

export const equipmentCouriersRouter = router({
  // ─── InPost Integration ─────────────────────────────────────────────

  /**
   * Create an InPost shipment via ShipX API for one or more equipment items.
   * Creates Shipment + ShipmentEvent records and auto-advances equipment status.
   */
  createInPostShipment: tenantProcedure
    .use(requirePermission({ equipment: ['create'] }))
    .input(inpostShipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      // Load courier config for InPost
      const courierConfig = await ctx.db.courierConfig.findUnique({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier: 'inpost',
          },
        },
      });

      if (!courierConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'COURIER_CONFIG_NOT_FOUND',
        });
      }

      const configJson = courierConfig.configJson as unknown as InPostClientConfig;
      const client = new InPostClient(configJson);

      // Verify all equipment items exist and load contractor details
      const equipmentItems = await ctx.db.equipment.findMany({
        where: {
          id: { in: input.equipmentIds },
          organizationId: ctx.organizationId,
        },
        include: {
          assignments: {
            where: { unassignedAt: null },
            take: 1,
            include: {
              contractor: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phone: true,
                  preferredPaczkomatId: true,
                  preferredPaczkomatName: true,
                  preferredPaczkomatAddress: true,
                },
              },
            },
          },
        },
      });

      if (equipmentItems.length !== input.equipmentIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      // Get contractor from first assignment for shipment receiver/sender details
      const firstAssignment = equipmentItems[0]?.assignments[0];
      const contractor = firstAssignment?.contractor;

      if (!contractor) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_ASSIGNED,
        });
      }

      // Load org for sender details
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      // Build shipment params
      const shipmentResult = await client.createShipment({
        organizationId: ctx.organizationId,
        direction: input.direction,
        receiver: {
          name: contractor.displayName,
          email: contractor.email ?? '',
          phone: contractor.phone ?? '',
        },
        sender: {
          name: org?.name ?? 'Organization',
          email: '',
          phone: '',
        },
        targetPoint: input.targetPointId,
        parcelSize: input.parcelSize,
        reference: input.workflowTaskRunId ? `workflow-${input.workflowTaskRunId}` : undefined,
      });

      // Determine new equipment status
      const newEquipmentStatus =
        input.direction === 'OUTBOUND' ? 'IN_TRANSIT' : 'RETURN_IN_TRANSIT';

      // Create shipment records for each equipment item
      const shipments = await ctx.db.$transaction(async tx => {
        const created: Shipment[] = [];

        for (const eq of equipmentItems) {
          const shipment = await tx.shipment.create({
            data: {
              organizationId: ctx.organizationId,
              equipmentId: eq.id,
              workflowTaskRunId: input.workflowTaskRunId ?? null,
              direction: input.direction,
              carrier: 'InPost',
              trackingNumber: shipmentResult.trackingNumber,
              externalId: shipmentResult.externalId,
              labelUrl: shipmentResult.labelUrl ?? null,
              currentStatus: 'CREATED',
              createdByUserId: userId,
            },
          });

          // Create initial CREATED event
          await tx.shipmentEvent.create({
            data: {
              organizationId: ctx.organizationId,
              shipmentId: shipment.id,
              status: 'CREATED',
              notes: input.notes ?? null,
              createdByUserId: userId,
            },
          });

          // Create LABEL_GENERATED event (ShipX auto-generates label)
          await tx.shipmentEvent.create({
            data: {
              organizationId: ctx.organizationId,
              shipmentId: shipment.id,
              status: 'LABEL_GENERATED',
              notes: 'Label auto-generated by ShipX on shipment creation',
              createdByUserId: userId,
            },
          });

          // Auto-advance equipment status
          await tx.equipment.update({
            where: { id: eq.id },
            data: { status: newEquipmentStatus },
          });

          created.push(shipment);
        }

        // Update contractor's preferred Paczkomat on outbound shipments (D-03)
        if (input.direction === 'OUTBOUND' && contractor) {
          await tx.contractor.update({
            where: { id: contractor.id },
            data: {
              preferredPaczkomatId: input.targetPointId,
              preferredPaczkomatName: input.targetPointName,
              preferredPaczkomatAddress: input.targetPointAddress,
            },
          });
        }

        return created;
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: userId,
          actorName: ctx.user?.name,
          action: 'shipment.createInPost',
          resourceType: 'SHIPMENT',
          resourceId: shipments[0]?.id ?? '',
          newValuesJson: {
            equipmentIds: input.equipmentIds,
            direction: input.direction,
            externalId: shipmentResult.externalId,
            trackingNumber: shipmentResult.trackingNumber,
            targetPoint: input.targetPointId,
          },
        },
      });

      // Fetch created shipments with events
      const result = await ctx.db.shipment.findMany({
        where: {
          id: { in: shipments.map(s => s.id) },
        },
        include: {
          events: { orderBy: { occurredAt: 'asc' } },
        },
      });

      return plain(result);
    }),

  // ─── DPD Integration (PRO tier) ──────────────────────────────────

  /**
   * Create a DPD shipment for one or more equipment items.
   * Gated to PRO tier. Creates Shipment + ShipmentEvent records and
   * auto-advances equipment status.
   */
  createDpdShipment: tenantProcedure
    .use(requirePermission({ equipment: ['create'] }))
    .use(requireTier('PRO'))
    .input(dpdShipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      // 1. Load courier config for DPD
      const courierConfig = await ctx.db.courierConfig.findUnique({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier: 'dpd',
          },
        },
      });

      if (!courierConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'COURIER_CONFIG_NOT_FOUND',
        });
      }

      const configJson = courierConfig.configJson as unknown as DPDClientConfig;
      const client = new DPDClient(configJson);

      // 2. Load equipment items with current assignments
      const equipmentItems = await ctx.db.equipment.findMany({
        where: {
          id: { in: input.equipmentIds },
          organizationId: ctx.organizationId,
        },
        include: {
          assignments: {
            where: { unassignedAt: null },
            take: 1,
            include: {
              contractor: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      if (equipmentItems.length !== input.equipmentIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const contractor = equipmentItems[0]?.assignments[0]?.contractor;
      if (!contractor) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_ASSIGNED,
        });
      }

      // Load org for sender info
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      // 3. Create shipment via DPD API
      const shipmentResult = await client.createShipment({
        organizationId: ctx.organizationId,
        direction: input.direction,
        receiver: {
          name: contractor.displayName,
          email: contractor.email ?? '',
          phone: contractor.phone ?? '',
        },
        sender: {
          name: org?.name ?? 'Organization',
          email: '',
          phone: '',
          street: input.deliveryAddress.street,
          city: input.deliveryAddress.city,
          postalCode: input.deliveryAddress.postalCode,
          countryCode: input.deliveryAddress.countryCode,
        },
        deliveryAddress: input.deliveryAddress,
        parcelSize: input.parcelSize,
        reference: input.workflowTaskRunId ? `workflow-${input.workflowTaskRunId}` : undefined,
      });

      // 4. Create DB records for each equipment item
      const newEquipmentStatus =
        input.direction === 'OUTBOUND' ? 'IN_TRANSIT' : 'RETURN_IN_TRANSIT';

      const shipments = await ctx.db.$transaction(async tx => {
        const created: Shipment[] = [];

        for (const item of equipmentItems) {
          // Validate equipment status transition
          const allowed = EQUIPMENT_STATUS_TRANSITIONS[item.status] ?? [];
          if (!allowed.includes(newEquipmentStatus)) continue;

          const shipment = await tx.shipment.create({
            data: {
              organizationId: ctx.organizationId,
              equipmentId: item.id,
              direction: input.direction,
              carrier: 'DPD',
              externalId: shipmentResult.externalId,
              trackingNumber: shipmentResult.trackingNumber,
              currentStatus: 'CREATED',
              workflowTaskRunId: input.workflowTaskRunId ?? null,
              createdByUserId: userId,
            },
          });

          await tx.shipmentEvent.create({
            data: {
              organizationId: ctx.organizationId,
              shipmentId: shipment.id,
              status: 'CREATED',
              notes: `DPD shipment created: ${shipmentResult.trackingNumber}`,
              createdByUserId: userId,
            },
          });

          await tx.equipment.update({
            where: { id: item.id },
            data: { status: newEquipmentStatus },
          });

          created.push(shipment);
        }

        return created;
      });

      // 5. Audit log
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: userId,
          actorName: ctx.user?.name,
          action: 'shipment.createDpd',
          resourceType: 'SHIPMENT',
          resourceId: shipments[0]?.id ?? '',
          newValuesJson: {
            equipmentIds: input.equipmentIds,
            carrier: 'DPD',
            trackingNumber: shipmentResult.trackingNumber,
            direction: input.direction,
          },
        },
      });

      // 6. Check workflow task completion
      if (input.workflowTaskRunId && shipments[0]) {
        void checkShipmentTaskCompletion(ctx.db, ctx.organizationId, {
          id: shipments[0].id,
          workflowTaskRunId: input.workflowTaskRunId,
          direction: input.direction,
          currentStatus: 'CREATED',
        }).catch(err => log.error({ err }, 'dpd shipment task completion check failed'));
      }

      // Fetch created shipments with events
      const result = await ctx.db.shipment.findMany({
        where: { id: { in: shipments.map(s => s.id) } },
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      });

      return plain(result);
    }),

  // ─── UPS Integration (PRO tier) ──────────────────────────────────

  /**
   * Create a UPS shipment for one or more equipment items.
   * Gated to PRO tier. Creates Shipment + ShipmentEvent records and
   * auto-advances equipment status.
   */
  createUpsShipment: tenantProcedure
    .use(requirePermission({ equipment: ['create'] }))
    .use(requireTier('PRO'))
    .input(upsShipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      // 1. Load courier config for UPS
      const courierConfig = await ctx.db.courierConfig.findUnique({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier: 'ups',
          },
        },
      });

      if (!courierConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'COURIER_CONFIG_NOT_FOUND',
        });
      }

      const configJson = courierConfig.configJson as unknown as UPSClientConfig;
      const client = new UPSClient(configJson);

      // 2. Load equipment items with current assignments
      const equipmentItems = await ctx.db.equipment.findMany({
        where: {
          id: { in: input.equipmentIds },
          organizationId: ctx.organizationId,
        },
        include: {
          assignments: {
            where: { unassignedAt: null },
            take: 1,
            include: {
              contractor: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      if (equipmentItems.length !== input.equipmentIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const contractor = equipmentItems[0]?.assignments[0]?.contractor;
      if (!contractor) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_ASSIGNED,
        });
      }

      // Load org for sender info
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      // 3. Create shipment via UPS API
      const shipmentResult = await client.createShipment({
        organizationId: ctx.organizationId,
        direction: input.direction,
        receiver: {
          name: contractor.displayName,
          email: contractor.email ?? '',
          phone: contractor.phone ?? '',
        },
        sender: {
          name: org?.name ?? 'Organization',
          email: '',
          phone: '',
          street: input.deliveryAddress.street,
          city: input.deliveryAddress.city,
          postalCode: input.deliveryAddress.postalCode,
          countryCode: input.deliveryAddress.countryCode,
        },
        deliveryAddress: input.deliveryAddress,
        parcelSize: input.parcelSize,
        serviceCode: input.serviceCode,
        reference: input.workflowTaskRunId ? `workflow-${input.workflowTaskRunId}` : undefined,
      });

      // 4. Create DB records for each equipment item
      const newEquipmentStatus =
        input.direction === 'OUTBOUND' ? 'IN_TRANSIT' : 'RETURN_IN_TRANSIT';

      const shipments = await ctx.db.$transaction(async tx => {
        const created: Shipment[] = [];

        for (const item of equipmentItems) {
          // Validate equipment status transition
          const allowed = EQUIPMENT_STATUS_TRANSITIONS[item.status] ?? [];
          if (!allowed.includes(newEquipmentStatus)) continue;

          const shipment = await tx.shipment.create({
            data: {
              organizationId: ctx.organizationId,
              equipmentId: item.id,
              direction: input.direction,
              carrier: 'UPS',
              externalId: shipmentResult.externalId,
              trackingNumber: shipmentResult.trackingNumber,
              currentStatus: 'CREATED',
              workflowTaskRunId: input.workflowTaskRunId ?? null,
              createdByUserId: userId,
            },
          });

          await tx.shipmentEvent.create({
            data: {
              organizationId: ctx.organizationId,
              shipmentId: shipment.id,
              status: 'CREATED',
              notes: `UPS shipment created: ${shipmentResult.trackingNumber}`,
              createdByUserId: userId,
            },
          });

          await tx.equipment.update({
            where: { id: item.id },
            data: { status: newEquipmentStatus },
          });

          created.push(shipment);
        }

        return created;
      });

      // 5. Audit log
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: userId,
          actorName: ctx.user?.name,
          action: 'shipment.createUps',
          resourceType: 'SHIPMENT',
          resourceId: shipments[0]?.id ?? '',
          newValuesJson: {
            equipmentIds: input.equipmentIds,
            carrier: 'UPS',
            trackingNumber: shipmentResult.trackingNumber,
            direction: input.direction,
            serviceCode: input.serviceCode,
          },
        },
      });

      // 6. Check workflow task completion
      if (input.workflowTaskRunId && shipments[0]) {
        void checkShipmentTaskCompletion(ctx.db, ctx.organizationId, {
          id: shipments[0].id,
          workflowTaskRunId: input.workflowTaskRunId,
          direction: input.direction,
          currentStatus: 'CREATED',
        }).catch(err => log.error({ err }, 'ups shipment task completion check failed'));
      }

      // Fetch created shipments with events
      const result = await ctx.db.shipment.findMany({
        where: { id: { in: shipments.map(s => s.id) } },
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      });

      return plain(result);
    }),

  // ─── Courier Config Management ────────────────────────────────────

  /**
   * Save (upsert) courier configuration credentials for a carrier.
   * Admin-only. Credentials are stored encrypted at rest and never
   * returned to the client (write-only for security).
   */
  saveCourierConfig: adminProcedure
    .input(z.union([dpdConfigSchema, upsConfigSchema]))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }

      const { carrier, ...credentials } = input;
      await ctx.db.courierConfig.upsert({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier,
          },
        },
        create: {
          organizationId: ctx.organizationId,
          carrier,
          configJson: credentials as unknown as Prisma.InputJsonValue,
        },
        update: {
          configJson: credentials as unknown as Prisma.InputJsonValue,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: userId,
          actorName: ctx.user?.name,
          action: 'courierConfig.save',
          resourceType: 'ORGANIZATION',
          resourceId: carrier,
          newValuesJson: { carrier, updated: true } as Prisma.InputJsonValue,
        },
      });

      return { success: true };
    }),

  /**
   * List configured courier providers for the organization.
   * Returns carrier names and timestamps only -- credentials are
   * never sent back to the client.
   */
  getCourierConfigs: adminProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.courierConfig.findMany({
      where: { organizationId: ctx.organizationId },
      select: { carrier: true, createdAt: true, updatedAt: true },
    });
    return configs;
  }),

  /**
   * Test courier connection by instantiating the carrier client and making
   * a lightweight API probe. Returns structured success/failure so the UI
   * can show a toast without exposing internal error details.
   */
  testCourierConnection: adminProcedure
    .input(z.union([dpdConfigSchema, upsConfigSchema]))
    .mutation(async ({ input }) => {
      const { carrier, ...credentials } = input;
      try {
        const client = getCourierClient(carrier, credentials);
        // Attempt a lightweight API call to verify credentials work.
        // getStatus with a dummy ID will authenticate and return an error
        // about the shipment not existing (not an auth error).
        // If auth fails, it throws before reaching the API response.
        await client.getStatus('TEST_CONNECTION_PROBE');
        return { success: true as const };
      } catch (error) {
        // If the error is about the shipment not being found, that means
        // auth succeeded -- the API accepted our credentials.
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found') || msg.includes('NOT_FOUND') || msg.includes('404')) {
          return { success: true as const };
        }
        return {
          success: false as const,
          error: 'Connection failed. Check your credentials.',
        };
      }
    }),

  /**
   * Get shipment label as base64-encoded PDF.
   * Fetches from ShipX API using the shipment's externalId.
   */
  getShipmentLabel: tenantProcedure
    .use(requirePermission({ equipment: ['read'] }))
    .input(z.object({ shipmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const shipment = await ctx.db.shipment.findFirst({
        where: {
          id: input.shipmentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: SHIPMENT_NOT_FOUND,
        });
      }

      if (shipment.carrier !== 'InPost' || !shipment.externalId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'SHIPMENT_NO_INPOST_LABEL',
        });
      }

      // Load courier config
      const courierConfig = await ctx.db.courierConfig.findUnique({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier: 'inpost',
          },
        },
      });

      if (!courierConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'COURIER_CONFIG_NOT_FOUND',
        });
      }

      const configJson = courierConfig.configJson as unknown as InPostClientConfig;
      const client = new InPostClient(configJson);

      const labelBuffer = await client.getLabel(shipment.externalId, 'pdf');

      return {
        data: labelBuffer.toString('base64'),
        contentType: 'application/pdf',
        filename: `inpost-label-${shipment.trackingNumber ?? shipment.externalId}.pdf`,
      };
    }),
});
