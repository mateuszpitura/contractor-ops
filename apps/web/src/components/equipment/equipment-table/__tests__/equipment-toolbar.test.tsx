import { render, screen, setup } from "@/test/test-utils";
import { EquipmentToolbar } from "../equipment-toolbar";

function makeProps(overrides: Partial<Parameters<typeof EquipmentToolbar>[0]> = {}) {
  return {
    search: "",
    onSearchChange: vi.fn(),
    filters: { type: [], status: [] },
    onFiltersChange: vi.fn(),
    isSearching: false,
    onAddEquipment: vi.fn(),
    ...overrides,
  };
}

describe("EquipmentToolbar", () => {
  it("renders search input and add button", () => {
    render(<EquipmentToolbar {...makeProps()} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add equipment/i })).toBeInTheDocument();
  });

  it("calls onAddEquipment when add button is clicked", async () => {
    const onAddEquipment = vi.fn();
    const { user } = setup(<EquipmentToolbar {...makeProps({ onAddEquipment })} />);

    await user.click(screen.getByRole("button", { name: /add equipment/i }));
    expect(onAddEquipment).toHaveBeenCalledTimes(1);
  });

  it("shows active filter badges when filters applied", () => {
    render(
      <EquipmentToolbar
        {...makeProps({
          filters: { type: ["LAPTOP"], status: [] },
        })}
      />,
    );

    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("does not show filter badges when no filters", () => {
    render(<EquipmentToolbar {...makeProps()} />);

    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  it("calls onFiltersChange when clear all is clicked", async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <EquipmentToolbar
        {...makeProps({
          filters: { type: ["LAPTOP"], status: [] },
          onFiltersChange,
        })}
      />,
    );

    await user.click(screen.getByText("Clear all"));
    expect(onFiltersChange).toHaveBeenCalledWith({ type: [], status: [] });
  });
});
