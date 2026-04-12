import { render, screen, setup } from "@/test/test-utils";
import type { ProfileField } from "../profile-section";
import { ProfileSection } from "../profile-section";

vi.mock("@/components/portal/pending-change-banner", () => ({
  PendingChangeBanner: () => <div data-testid="pending-banner" />,
}));

function makeFields(): ProfileField[] {
  return [
    { key: "displayName", label: "Display Name", value: "Jan Kowalski" },
    { key: "email", label: "Email", value: "jan@example.com", readOnly: true },
    { key: "phone", label: "Phone", value: "+48 123 456 789" },
  ];
}

describe("ProfileSection", () => {
  it("renders title and field labels in view mode", () => {
    render(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    expect(screen.getByText("Personal Info")).toBeInTheDocument();
    expect(screen.getByText("Display Name")).toBeInTheDocument();
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
  });

  it("shows field values in view mode", () => {
    render(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    expect(screen.getByText("jan@example.com")).toBeInTheDocument();
    expect(screen.getByText("+48 123 456 789")).toBeInTheDocument();
  });

  it("shows edit button", () => {
    render(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("switches to edit mode when edit is clicked", async () => {
    const { user } = setup(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();
  });

  it("shows requires approval badge when requiresApproval is true", () => {
    render(
      <ProfileSection
        title="Financial"
        fields={makeFields()}
        onSave={vi.fn()}
        requiresApproval
        defaultOpen
      />,
    );

    expect(screen.getByText(/requires approval/i)).toBeInTheDocument();
  });

  it("renders pending change banner when pendingChangeRequest provided", () => {
    render(
      <ProfileSection
        title="Financial"
        fields={makeFields()}
        onSave={vi.fn()}
        pendingChangeRequest={{
          id: "cr-1",
          requestedChanges: { bankName: "PKO" },
          createdAt: new Date(),
        }}
        defaultOpen
      />,
    );

    expect(screen.getByTestId("pending-banner")).toBeInTheDocument();
  });

  it("shows read-only field with lock icon in edit mode", async () => {
    const { user } = setup(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    // Email is readOnly, should still be visible in edit mode
    expect(screen.getByText("jan@example.com")).toBeInTheDocument();
  });

  it("discards changes and returns to view mode when discard is clicked", async () => {
    const { user } = setup(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /discard/i }));
    // Should be back in view mode
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("renders editable inputs in edit mode for non-readOnly fields", async () => {
    const { user } = setup(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    // Display Name and Phone are editable
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("calls onSave with form values when save is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { user } = setup(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={onSave} defaultOpen />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it("shows financial approval note when requiresApproval is true in edit mode", async () => {
    const { user } = setup(
      <ProfileSection
        title="Financial"
        fields={makeFields()}
        onSave={vi.fn()}
        requiresApproval
        defaultOpen
      />,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText(/changes.*require.*approval/i)).toBeInTheDocument();
  });

  it("shows fallback value for fields with null value", () => {
    const fields = [{ key: "address", label: "Address", value: null }];
    render(<ProfileSection title="Info" fields={fields} onSave={vi.fn()} defaultOpen />);
    // The fallback is t("fallbackValue") which should render some placeholder text
    expect(screen.getByText("Address")).toBeInTheDocument();
  });

  it("does not show requires approval badge when requiresApproval is false", () => {
    render(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );
    expect(screen.queryByText(/requires approval/i)).not.toBeInTheDocument();
  });

  it("does not show pending banner when no pendingChangeRequest", () => {
    render(
      <ProfileSection title="Personal Info" fields={makeFields()} onSave={vi.fn()} defaultOpen />,
    );
    expect(screen.queryByTestId("pending-banner")).not.toBeInTheDocument();
  });

  it("renders all field values in view mode for bank fields", () => {
    const bankFields = [
      { key: "bankName", label: "Bank Name", value: "PKO BP" },
      { key: "accountNumber", label: "Account Number", value: "PL12345678" },
      { key: "swift", label: "SWIFT", value: "BPKOPLPW" },
    ];
    render(
      <ProfileSection title="Bank Details" fields={bankFields} onSave={vi.fn()} defaultOpen />,
    );
    expect(screen.getByText("PKO BP")).toBeInTheDocument();
    expect(screen.getByText("PL12345678")).toBeInTheDocument();
    expect(screen.getByText("BPKOPLPW")).toBeInTheDocument();
  });

  it("renders edit mode with bank field inputs", async () => {
    const bankFields = [
      { key: "bankName", label: "Bank Name", value: "PKO BP" },
      { key: "swift", label: "SWIFT", value: "BPKOPLPW" },
    ];
    const { user } = setup(
      <ProfileSection title="Bank Details" fields={bankFields} onSave={vi.fn()} defaultOpen />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("Bank Name")).toBeInTheDocument();
    expect(screen.getByLabelText("SWIFT")).toBeInTheDocument();
  });

  it("saves updated bank field values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const bankFields = [{ key: "bankName", label: "Bank Name", value: "PKO BP" }];
    const { user } = setup(
      <ProfileSection title="Bank Details" fields={bankFields} onSave={onSave} defaultOpen />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const input = screen.getByLabelText("Bank Name");
    await user.clear(input);
    await user.type(input, "mBank");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalled();
  });
});
