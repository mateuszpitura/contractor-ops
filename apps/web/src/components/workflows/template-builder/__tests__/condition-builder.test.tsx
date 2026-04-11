import { render, screen, setup } from "@/test/test-utils";
import { ConditionBuilder, getConditionSummary } from "../condition-builder";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe("ConditionBuilder", () => {
  it("renders empty state with add button when value is null", () => {
    render(<ConditionBuilder value={null} onChange={vi.fn()} />);
    expect(screen.getByText(/No conditions/)).toBeInTheDocument();
    expect(screen.getByText("Add condition")).toBeInTheDocument();
  });

  it("calls onChange with initial rule when add button is clicked", async () => {
    const onChange = vi.fn();
    const { user } = setup(<ConditionBuilder value={null} onChange={onChange} />);
    await user.click(screen.getByText("Add condition"));
    expect(onChange).toHaveBeenCalledWith({
      combinator: "AND",
      rules: [{ field: "", operator: "equals", value: "" }],
    });
  });

  it("renders existing rules with remove buttons", () => {
    const value = {
      combinator: "AND" as const,
      rules: [
        { field: "contractor.type", operator: "equals" as const, value: "COMPANY" },
      ],
    };
    render(<ConditionBuilder value={value} onChange={vi.fn()} />);
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("shows combinator badge between rules", () => {
    const value = {
      combinator: "AND" as const,
      rules: [
        { field: "contractor.type", operator: "equals" as const, value: "COMPANY" },
        { field: "contractor.status", operator: "equals" as const, value: "ACTIVE" },
      ],
    };
    render(<ConditionBuilder value={value} onChange={vi.fn()} />);
    expect(screen.getByText("AND")).toBeInTheDocument();
  });

  it("removes rule and calls onChange with null when last rule removed", async () => {
    const onChange = vi.fn();
    const value = {
      combinator: "AND" as const,
      rules: [{ field: "contractor.type", operator: "equals" as const, value: "COMPANY" }],
    };
    const { user } = setup(<ConditionBuilder value={value} onChange={onChange} />);
    await user.click(screen.getByText("Remove"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("getConditionSummary", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;

  it("returns null for null conditions", () => {
    expect(getConditionSummary(null, t)).toBeNull();
  });

  it("returns null for empty rules", () => {
    expect(getConditionSummary({ combinator: "AND", rules: [] }, t)).toBeNull();
  });

  it("returns single rule summary", () => {
    const result = getConditionSummary(
      { combinator: "AND", rules: [{ field: "contractor.type", operator: "equals", value: "COMPANY" }] },
      t,
    );
    expect(result).toContain("conditionBadge");
  });

  it("returns multi rule count", () => {
    const result = getConditionSummary(
      {
        combinator: "AND",
        rules: [
          { field: "contractor.type", operator: "equals", value: "COMPANY" },
          { field: "contractor.status", operator: "equals", value: "ACTIVE" },
        ],
      },
      t,
    );
    expect(result).toContain("conditionBadgeMulti");
  });
});
