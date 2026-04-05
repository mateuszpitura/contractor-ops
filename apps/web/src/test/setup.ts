import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { vi } from "vitest";

/**
 * Base UI ScrollArea schedules layout/state updates after mount (ResizeObserver, etc.),
 * which triggers "not wrapped in act(...)" in most UI tests. For tests that are not about
 * scroll behavior, a lightweight DOM stub keeps the same slots/class contract without
 * async updates. Real ScrollArea is tested in scroll-area.test.tsx via vi.unmock.
 */
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
    ...props
  }: React.ComponentProps<"div">) =>
    React.createElement(
      "div",
      {
        "data-slot": "scroll-area",
        className: ["relative", className].filter(Boolean).join(" "),
        ...props,
      },
      React.createElement(
        "div",
        {
          "data-slot": "scroll-area-viewport",
          className:
            "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
        },
        children,
      ),
    ),
  ScrollBar: () => null,
}));
