import { act, renderHook } from "@testing-library/react";
import { SearchProvider, useSearch } from "../search-provider";

describe("SearchProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides default closed state", () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider,
    });
    expect(result.current.open).toBe(false);
    expect(result.current.recentItems).toEqual([]);
  });

  it("allows toggling open state", () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider,
    });
    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);
  });

  it("adds recent items and deduplicates", () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider,
    });
    act(() => {
      result.current.addRecentItem({ id: "c1", type: "contractor", name: "Acme" });
    });
    expect(result.current.recentItems).toHaveLength(1);
    expect(result.current.recentItems[0].name).toBe("Acme");

    // Add same item again - should deduplicate
    act(() => {
      result.current.addRecentItem({ id: "c1", type: "contractor", name: "Acme" });
    });
    expect(result.current.recentItems).toHaveLength(1);
  });

  it("persists recent items to localStorage", () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider,
    });
    act(() => {
      result.current.addRecentItem({ id: "c1", type: "contractor", name: "Acme" });
    });
    const stored = localStorage.getItem("contractor-ops:recent-items");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toHaveLength(1);
  });

  it("throws when used without provider", () => {
    expect(() => {
      renderHook(() => useSearch());
    }).toThrow("useSearch must be used within a SearchProvider");
  });
});
