import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePermissions } from "../use-permissions";

const mockUseSession = vi.fn(() => ({
  isPending: false,
  data: {},
}));

const mockDashboard = vi.fn(() => ({
  userRole: "finance_admin" as string | null,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

vi.mock("@/components/layout/dashboard-context", () => ({
  useDashboardContext: () => mockDashboard(),
}));

describe("usePermissions", () => {
  beforeEach(() => {
    mockDashboard.mockReturnValue({ userRole: "finance_admin" });
  });

  it("finance_admin can approve invoices", () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("invoice", ["approve"])).toBe(true);
  });

  it("finance_admin cannot create contractors", () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("contractor", ["create"])).toBe(false);
  });

  it("returns false when role is missing", () => {
    mockDashboard.mockReturnValue({ userRole: null });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("invoice", ["read"])).toBe(false);
  });

  it("owner can manage equipment", () => {
    mockDashboard.mockReturnValue({ userRole: "owner" });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("equipment", ["delete"])).toBe(true);
  });
});
