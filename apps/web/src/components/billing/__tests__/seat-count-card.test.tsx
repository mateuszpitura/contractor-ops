import { render, screen } from "@/test/test-utils";
import { SeatCountCard } from "../seat-count-card";

describe("SeatCountCard", () => {
  it("renders the active seats label and count", () => {
    render(
      <SeatCountCard
        activeContractors={5}
        includedSeats={10}
        seatPriceMinor={1500}
      />,
    );
    expect(screen.getByText("Active Seats")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows active/included text", () => {
    render(
      <SeatCountCard
        activeContractors={5}
        includedSeats={10}
        seatPriceMinor={1500}
      />,
    );
    expect(
      screen.getByText("5 active / 10 included"),
    ).toBeInTheDocument();
  });

  it("does not show overage text when within included seats", () => {
    render(
      <SeatCountCard
        activeContractors={5}
        includedSeats={10}
        seatPriceMinor={1500}
      />,
    );
    expect(screen.queryByText(/additional seats/)).not.toBeInTheDocument();
  });

  it("shows overage text when active exceeds included", () => {
    render(
      <SeatCountCard
        activeContractors={12}
        includedSeats={10}
        seatPriceMinor={1500}
      />,
    );
    expect(
      screen.getByText("2 additional seats billed at 15/seat"),
    ).toBeInTheDocument();
  });

  it("renders a progress bar", () => {
    render(
      <SeatCountCard
        activeContractors={5}
        includedSeats={10}
        seatPriceMinor={1500}
      />,
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
