import { render, screen, setup } from "@/test/test-utils";
import type { DpdAddress, ParcelSize } from "../dpd-fieldset";
import { DpdFieldset } from "../dpd-fieldset";

function makeProps(overrides: Partial<Parameters<typeof DpdFieldset>[0]> = {}) {
  return {
    address: { street: "", city: "", postalCode: "", countryCode: "PL" } as DpdAddress,
    onAddressChange: vi.fn(),
    parcelSize: "medium" as ParcelSize,
    onParcelSizeChange: vi.fn(),
    ...overrides,
  };
}

describe("DpdFieldset", () => {
  it("renders address inputs and parcel size radios", () => {
    render(<DpdFieldset {...makeProps()} />);

    expect(screen.getByRole("textbox", { name: /street/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /city/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /postal/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("displays current address values", () => {
    const address: DpdAddress = {
      street: "ul. Testowa 5",
      city: "Warszawa",
      postalCode: "00-001",
      countryCode: "PL",
    };
    render(<DpdFieldset {...makeProps({ address })} />);

    expect(screen.getByDisplayValue("ul. Testowa 5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Warszawa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("00-001")).toBeInTheDocument();
  });

  it("calls onAddressChange when street is typed", async () => {
    const onAddressChange = vi.fn();
    const { user } = setup(<DpdFieldset {...makeProps({ onAddressChange })} />);

    const streetInput = screen.getByRole("textbox", { name: /street/i });
    await user.type(streetInput, "A");

    expect(onAddressChange).toHaveBeenCalledWith(expect.objectContaining({ street: "A" }));
  });

  it("calls onParcelSizeChange when a radio is clicked", async () => {
    const onParcelSizeChange = vi.fn();
    const { user } = setup(<DpdFieldset {...makeProps({ onParcelSizeChange })} />);

    const smallRadio = screen.getByRole("radio", { name: /small/i });
    await user.click(smallRadio);

    expect(onParcelSizeChange).toHaveBeenCalledWith("small");
  });

  it("highlights the selected parcel size", () => {
    render(<DpdFieldset {...makeProps({ parcelSize: "large" })} />);

    const largeRadio = screen.getByRole("radio", { name: /large/i });
    expect(largeRadio).toBeChecked();
  });
});
