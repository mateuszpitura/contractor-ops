import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCalendarEvent } from '../calendar-event-service.js';

describe('deleteCalendarEvent', () => {
  const mockFindMany = vi.fn();
  const prisma = {
    externalLink: {
      findMany: mockFindMany,
      delete: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns without provider calls when no external links', async () => {
    mockFindMany.mockResolvedValue([]);

    await deleteCalendarEvent(prisma as never, {
      organizationId: 'org-1',
      entityType: 'CONTRACT',
      entityId: 'c-1',
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          entityId: 'c-1',
        }),
      }),
    );
    expect(prisma.externalLink.delete).not.toHaveBeenCalled();
  });
});
