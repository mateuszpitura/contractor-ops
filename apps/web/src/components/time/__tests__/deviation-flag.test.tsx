import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DeviationFlag } from "../deviation-flag";

describe("DeviationFlag", () => {
  it("shows within-threshold label when deviation is small", () => {
    render(
      <DeviationFlag
        deviationPercent={2}
        thresholdPercent={10}
        expectedAmountMinor={10000}
        invoicedAmountMinor={10200}
        rateValueMinor={5000}
        approvedMinutes={120}
      />,
    );
    expect(screen.getByText("Within 10%")).toBeInTheDocument();
  });

  it("shows warning label when deviation exceeds threshold but not 2x", () => {
    render(
      <DeviationFlag
        deviationPercent={15}
        thresholdPercent={10}
        expectedAmountMinor={10000}
        invoicedAmountMinor={11500}
        rateValueMinor={5000}
        approvedMinutes={120}
      />,
    );
    expect(screen.getByText("+15.0% over expected")).toBeInTheDocument();
  });
});
