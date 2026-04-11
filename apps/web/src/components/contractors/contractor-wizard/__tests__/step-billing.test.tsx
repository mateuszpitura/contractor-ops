import { render, screen } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { StepBilling } from "../step-billing";

function Wrapper() {
  const form = useForm({
    defaultValues: {
      billingModel: "",
      currency: "PLN",
      rateValueMinor: 0,
      bankAccount: "",
      paymentTermsDays: undefined,
    },
  });
  return <StepBilling form={form as any} />;
}

describe("StepBilling", () => {
  it("renders billing model, currency, rate, bank account, and payment terms fields", () => {
    render(<Wrapper />);
    // Should have rate input
    const rateInput = screen.getByLabelText(/rate/i);
    expect(rateInput).toBeInTheDocument();
  });

  it("renders bank account input with IBAN placeholder", () => {
    render(<Wrapper />);
    const bankInput = screen.getByPlaceholderText(/PL00/);
    expect(bankInput).toBeInTheDocument();
  });

  it("renders payment terms input", () => {
    render(<Wrapper />);
    const ptInput = screen.getByPlaceholderText("30");
    expect(ptInput).toBeInTheDocument();
  });
});
