import { render, screen, setup } from "@/test/test-utils";
import { CarrierCredentialForm } from "../carrier-credential-form";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQuery: () => ({ isLoading: false, data: [] }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    equipment: {
      saveCourierConfig: { mutationOptions: vi.fn((o: object) => o) },
      getCourierConfigs: {
        queryOptions: vi.fn(() => ({ queryKey: ["equipment", "getCourierConfigs"] })),
      },
      testCourierConnection: { mutationOptions: vi.fn((o: object) => o) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("CarrierCredentialForm", () => {
  it("renders DPD card title", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    expect(screen.getByText("DPD")).toBeInTheDocument();
  });

  it("renders UPS credential fields", () => {
    render(<CarrierCredentialForm carrier="ups" carrierLabel="UPS" />);
    expect(screen.getByText("Client ID")).toBeInTheDocument();
    expect(screen.getByText("Client Secret")).toBeInTheDocument();
    expect(screen.getByText("Account Number")).toBeInTheDocument();
  });

  it("renders DPD credential fields", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByText("FID Account Number")).toBeInTheDocument();
  });

  it("renders test and save buttons", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    expect(screen.getByText("Test connection")).toBeInTheDocument();
    expect(screen.getByText("Save credentials")).toBeInTheDocument();
  });

  it("shows notConfigured badge when no config", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  // ---- Sandbox checkbox ----
  it("renders sandbox checkbox for DPD", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    expect(screen.getByText("Sandbox mode")).toBeInTheDocument();
  });

  it("renders sandbox checkbox for UPS", () => {
    render(<CarrierCredentialForm carrier="ups" carrierLabel="UPS" />);
    expect(screen.getByText("Sandbox mode")).toBeInTheDocument();
  });

  // ---- Password visibility toggle ----
  it("renders show/hide buttons for password fields (DPD)", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const showButtons = screen.getAllByLabelText("Show");
    expect(showButtons.length).toBe(3); // username, password, fid
  });

  it("renders show/hide buttons for password fields (UPS)", () => {
    render(<CarrierCredentialForm carrier="ups" carrierLabel="UPS" />);
    const showButtons = screen.getAllByLabelText("Show");
    expect(showButtons.length).toBe(3); // clientId, clientSecret, accountNumber
  });

  it("toggles password visibility when show button is clicked (DPD)", async () => {
    const { user } = setup(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const showButtons = screen.getAllByLabelText("Show");
    await user.click(showButtons[0]);
    // After click, button should show "Hide"
    expect(screen.getByLabelText("Hide")).toBeInTheDocument();
  });

  // ---- Test connection button ----
  it("test connection button is not disabled initially", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const testBtn = screen.getByText("Test connection").closest("button");
    expect(testBtn).not.toBeDisabled();
  });

  // ---- Save credentials button ----
  it("save credentials button is not disabled initially", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const saveBtn = screen.getByText("Save credentials").closest("button");
    expect(saveBtn).not.toBeDisabled();
  });

  // ---- Card title for UPS ----
  it("renders UPS card title", () => {
    render(<CarrierCredentialForm carrier="ups" carrierLabel="UPS" />);
    expect(screen.getByText("UPS")).toBeInTheDocument();
  });

  // ---- Truck icon rendered ----
  it("renders truck icon in card header", () => {
    const { container } = render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  // ---- Password inputs are type=password by default ----
  it("password inputs are type password by default", () => {
    const { container } = render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(3);
  });

  // ---- Test connection button click ----
  it("test connection button is clickable", async () => {
    const { user } = setup(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const testBtn = screen.getByText("Test connection").closest("button")!;
    await user.click(testBtn);
    // Should not throw
  });

  // ---- Save credentials button click ----
  it("save credentials button is clickable", async () => {
    const { user } = setup(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    const saveBtn = screen.getByText("Save credentials").closest("button")!;
    await user.click(saveBtn);
    // Should not throw
  });

  // ---- UPS specific fields ----
  it("does not render DPD fields when carrier is UPS", () => {
    render(<CarrierCredentialForm carrier="ups" carrierLabel="UPS" />);
    expect(screen.queryByText("Username")).not.toBeInTheDocument();
    expect(screen.queryByText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("FID Account Number")).not.toBeInTheDocument();
  });

  // ---- DPD specific fields ----
  it("does not render UPS fields when carrier is DPD", () => {
    render(<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />);
    expect(screen.queryByText("Client ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Client Secret")).not.toBeInTheDocument();
    expect(screen.queryByText("Account Number")).not.toBeInTheDocument();
  });

  // ---- Typing in credential fields ----
  it("allows typing into DPD username field", async () => {
    const { user, container } = setup(
      <CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />,
    );
    const inputs = container.querySelectorAll('input[type="password"]');
    await user.type(inputs[0] as HTMLElement, "my-user");
    expect(inputs[0]).toHaveValue("my-user");
  });

  it("allows typing into UPS client ID field", async () => {
    const { user, container } = setup(
      <CarrierCredentialForm carrier="ups" carrierLabel="UPS" />,
    );
    const inputs = container.querySelectorAll('input[type="password"]');
    await user.type(inputs[0] as HTMLElement, "client-123");
    expect(inputs[0]).toHaveValue("client-123");
  });

  // ---- Toggle password visibility for multiple fields ----
  it("toggles visibility back to hidden after two clicks", async () => {
    const { user, container } = setup(
      <CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />,
    );
    const showButtons = screen.getAllByLabelText("Show");
    await user.click(showButtons[0]);
    expect(screen.getByLabelText("Hide")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Hide"));
    // After hiding, we should have all "Show" buttons again
    expect(screen.getAllByLabelText("Show").length).toBe(3);
  });

  // ---- Sandbox checkbox interaction ----
  it("toggles sandbox checkbox for DPD", async () => {
    const { user } = setup(
      <CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />,
    );
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    // Checkbox should now be checked
    expect(checkbox).toBeChecked();
  });
});
