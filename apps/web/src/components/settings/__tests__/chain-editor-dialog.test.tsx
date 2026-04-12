import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { ChainEditorDialog } from "../chain-editor-dialog";

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: [] }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    approval: {
      createChain: { mutationOptions: vi.fn((o: object) => o) },
      updateChain: { mutationOptions: vi.fn((o: object) => o) },
      listChains: { queryKey: vi.fn(() => ["approval", "listChains"]) },
    },
    user: {
      list: { queryOptions: vi.fn(() => ({ queryKey: ["user", "list"] })) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/settings/condition-builder", () => ({
  ConditionBuilder: ({ value, onChange }: any) => (
    <div data-testid="condition-builder">
      <span data-testid="condition-count">{value?.length ?? 0}</span>
      <button
        data-testid="add-condition"
        onClick={() =>
          onChange([...(value ?? []), { field: "amount", operator: "gt", value: 1000 }])
        }
      >
        Add
      </button>
    </div>
  ),
}));

const twoStepChain = {
  id: "c1",
  name: "Invoice Chain",
  isDefault: true,
  isActive: true,
  conditionsJson: [{ field: "amount", operator: "gt", value: 5000 }],
  stepsJson: [
    {
      name: "Manager Review",
      approverUserId: null,
      approverRole: "OPS_MANAGER",
      slaHours: 48,
      required: true,
    },
    {
      name: "Finance Review",
      approverUserId: null,
      approverRole: "FINANCE_ADMIN",
      slaHours: 24,
      required: false,
    },
  ],
};

describe("ChainEditorDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Basic create mode ----
  it("renders create mode title when chainData is null", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Create approval chain")).toBeInTheDocument();
  });

  it("renders create description text in create mode", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText(/Set up a new approval chain/i)).toBeInTheDocument();
  });

  it("renders chain name input", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByLabelText("Chain name")).toBeInTheDocument();
  });

  it("renders save and discard buttons", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Save chain")).toBeInTheDocument();
    expect(screen.getByText("Discard changes")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ChainEditorDialog open={false} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.queryByText("Create approval chain")).not.toBeInTheDocument();
  });

  // ---- Default toggle ----
  it("renders default toggle switch", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Set as default chain")).toBeInTheDocument();
  });

  // ---- Approval levels ----
  it("renders approval levels section heading", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Approval levels")).toBeInTheDocument();
  });

  it("renders add level button", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Add level")).toBeInTheDocument();
  });

  it("starts with one default approval level", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    // Level badge "1" should exist
    expect(screen.getByText("1")).toBeInTheDocument();
    // Should NOT have a "2"
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("adds a second level when add level is clicked", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    await user.click(screen.getByText("Add level"));
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("adds up to 3 levels then disables add button", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    await user.click(screen.getByText("Add level"));
    await user.click(screen.getByText("Add level"));
    // Now at 3 levels, button should be disabled
    const addBtn = screen.getByText("Add level").closest("button");
    expect(addBtn).toBeDisabled();
  });

  it("shows remove level button when more than one level exists", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    // With one level, no remove button
    expect(screen.queryByLabelText("Remove level")).not.toBeInTheDocument();
    // Add second level
    await user.click(screen.getByText("Add level"));
    const removeButtons = screen.getAllByLabelText("Remove level");
    expect(removeButtons.length).toBe(2);
  });

  it("removes a level when remove button is clicked", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    await user.click(screen.getByText("Add level"));
    expect(screen.getByText("2")).toBeInTheDocument();
    const removeButtons = screen.getAllByLabelText("Remove level");
    await user.click(removeButtons[1]);
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  // ---- SLA input ----
  it("renders SLA hours input for each step", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByLabelText("SLA (hours)")).toBeInTheDocument();
  });

  it("has default SLA value of 24", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    const slaInput = screen.getByLabelText("SLA (hours)");
    expect(slaInput).toHaveValue(24);
  });

  it("allows changing SLA value", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    const slaInput = screen.getByLabelText("SLA (hours)");
    await user.clear(slaInput);
    await user.type(slaInput, "72");
    expect(slaInput).toHaveValue(72);
  });

  // ---- Required toggle ----
  it("renders required toggle for each step", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  // ---- Approver type ----
  it("renders user and role radio buttons for approver type", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Specific user")).toBeInTheDocument();
    expect(screen.getByText("Role-based")).toBeInTheDocument();
  });

  // ---- Edit mode ----
  it("renders edit mode title when chainData is provided", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    expect(screen.getByText("Edit approval chain")).toBeInTheDocument();
  });

  it("renders edit description text in edit mode", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    expect(screen.getByText(/Update chain settings/i)).toBeInTheDocument();
  });

  it("populates form fields when editing existing chain", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    expect(screen.getByDisplayValue("Invoice Chain")).toBeInTheDocument();
  });

  it("populates multiple steps when editing chain with two steps", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    expect(screen.getByDisplayValue("Manager Review")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Finance Review")).toBeInTheDocument();
    // Two remove buttons mean two levels
    const removeButtons = screen.getAllByLabelText("Remove level");
    expect(removeButtons.length).toBe(2);
  });

  it("populates SLA values from chain data", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    const slaInputs = screen.getAllByLabelText("SLA (hours)");
    expect(slaInputs[0]).toHaveValue(48);
    expect(slaInputs[1]).toHaveValue(24);
  });

  // ---- Conditions section ----
  it("renders conditions section", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByTestId("condition-builder")).toBeInTheDocument();
  });

  it("renders existing condition count in edit mode", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    expect(screen.getByTestId("condition-count")).toHaveTextContent("1");
  });

  // ---- Discard ----
  it("calls onOpenChange when discard is clicked", async () => {
    const onOpenChange = vi.fn();
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={onOpenChange} chainData={null} />,
    );
    await user.click(screen.getByText("Discard changes"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---- Level name input ----
  it("renders level name input with placeholder", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByLabelText("Level name")).toBeInTheDocument();
  });

  it("allows editing level name", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    const nameInput = screen.getByLabelText("Level name");
    await user.type(nameInput, "Finance Approval");
    expect(nameInput).toHaveValue("Finance Approval");
  });

  // ---- Add condition via ConditionBuilder ----
  it("adds conditions via ConditionBuilder", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    expect(screen.getByTestId("condition-count")).toHaveTextContent("0");
    await user.click(screen.getByTestId("add-condition"));
    expect(screen.getByTestId("condition-count")).toHaveTextContent("1");
  });

  // ---- Remove last level re-enables add ----
  it("re-enables add level button after removing a level", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    // Add 2 levels (total 3)
    await user.click(screen.getByText("Add level"));
    await user.click(screen.getByText("Add level"));
    expect(screen.getByText("Add level").closest("button")).toBeDisabled();
    // Remove one
    const removeButtons = screen.getAllByLabelText("Remove level");
    await user.click(removeButtons[2]);
    expect(screen.getByText("Add level").closest("button")).not.toBeDisabled();
  });

  // ---- Edit mode populates conditions ----
  it("shows zero conditions when editing chain has empty conditions", () => {
    const chainWithNoConditions = {
      ...twoStepChain,
      conditionsJson: [],
    };
    render(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={chainWithNoConditions} />,
    );
    expect(screen.getByTestId("condition-count")).toHaveTextContent("0");
  });

  // ---- Edit mode with single step ----
  it("populates single step in edit mode", () => {
    const singleStepChain = {
      ...twoStepChain,
      stepsJson: [twoStepChain.stepsJson[0]],
    };
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={singleStepChain} />);
    expect(screen.getByDisplayValue("Manager Review")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Finance Review")).not.toBeInTheDocument();
  });

  // ---- Chain name in edit mode ----
  it("allows changing chain name in edit mode", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />,
    );
    const nameInput = screen.getByDisplayValue("Invoice Chain");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Chain");
    expect(nameInput).toHaveValue("Updated Chain");
  });

  // ---- Default toggle interaction ----
  it("toggles default switch on click", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    const switches = screen.getAllByRole("switch");
    const defaultSwitch = switches[0]; // first switch is the default toggle
    await user.click(defaultSwitch);
    expect(defaultSwitch).toBeChecked();
  });

  // ---- Required toggle interaction ----
  it("toggles required switch for a step", async () => {
    const { user } = setup(
      <ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />,
    );
    const switches = screen.getAllByRole("switch");
    const requiredSwitch = switches[switches.length - 1]; // last switch is required
    expect(requiredSwitch).toBeChecked();
    await user.click(requiredSwitch);
    expect(requiredSwitch).not.toBeChecked();
  });

  // ---- Edit mode with role-based approver shows role selector ----
  it("renders role selector for role-based step in edit mode", () => {
    const roleChain = {
      ...twoStepChain,
      stepsJson: [
        {
          name: "Role Step",
          approverUserId: null,
          approverRole: "OPS_MANAGER",
          slaHours: 48,
          required: true,
        },
      ],
    };
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={roleChain} />);
    expect(screen.getByDisplayValue("Role Step")).toBeInTheDocument();
  });

  // ---- Edit mode default toggle state ----
  it("populates default toggle from chain data in edit mode", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={twoStepChain} />);
    const switches = screen.getAllByRole("switch");
    const defaultSwitch = switches[0];
    expect(defaultSwitch).toBeChecked();
  });

  // ---- Submit button rendered ----
  it("renders submit button with correct text", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    const saveBtn = screen.getByText("Save chain").closest("button");
    expect(saveBtn).not.toBeDisabled();
  });

  // ---- Conditions heading ----
  it("renders routing conditions heading", () => {
    render(<ChainEditorDialog open={true} onOpenChange={vi.fn()} chainData={null} />);
    expect(screen.getByText("Routing conditions")).toBeInTheDocument();
  });
});
