import { render, screen, setup } from "@/test/test-utils";
import type { DpdAddress, ParcelSize } from "../dpd-fieldset";
import type { UpsServiceCode } from "../ups-fieldset";
import { UpsFieldset } from "../ups-fieldset";

function makeProps(overrides: Partial<Parameters<typeof UpsFieldset>[0]> = {}) {
  return {
    address: { street: "", city: "", postalCode: "", countryCode: "PL" } as DpdAddress,
    onAddressChange: vi.fn(),
    parcelSize: "medium" as ParcelSize,
    onParcelSizeChange: vi.fn(),
    serviceCode: "11" as UpsServiceCode,
    onServiceCodeChange: vi.fn(),
    ...overrides,
  };
}

describe("UpsFieldset", () => {
  it("renders address inputs, parcel sizes, and service type selector", () => {
    render(<UpsFieldset {...makeProps()} />);

    expect(screen.getByRole("textbox", { name: /street/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /city/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /postal/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("calls onAddressChange when city is typed", async () => {
    const onAddressChange = vi.fn();
    const { user } = setup(<UpsFieldset {...makeProps({ onAddressChange })} />);

    const cityInput = screen.getByRole("textbox", { name: /city/i });
    await user.type(cityInput, "K");

    expect(onAddressChange).toHaveBeenCalledWith(expect.objectContaining({ city: "K" }));
  });

  it("calls onParcelSizeChange when radio is selected", async () => {
    const onParcelSizeChange = vi.fn();
    const { user } = setup(<UpsFieldset {...makeProps({ onParcelSizeChange })} />);

    await user.click(screen.getByRole("radio", { name: /large/i }));
    expect(onParcelSizeChange).toHaveBeenCalledWith("large");
  });
});
