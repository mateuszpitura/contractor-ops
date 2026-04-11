import { render, screen, setup } from "@/test/test-utils";
import { CookieConsentBanner } from "../cookie-consent-banner";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders when consent not yet given", () => {
    render(<CookieConsentBanner />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/essential cookies/)).toBeInTheDocument();
    expect(screen.getByText("Got it")).toBeInTheDocument();
  });

  it("does not render when consent already given", () => {
    localStorage.setItem("cookie-consent-acknowledged", "2026-01-01");
    const { container } = render(<CookieConsentBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("hides banner and sets localStorage on accept", async () => {
    const { user } = setup(<CookieConsentBanner />);
    await user.click(screen.getByText("Got it"));
    expect(localStorage.getItem("cookie-consent-acknowledged")).toBeTruthy();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders learn more link", () => {
    render(<CookieConsentBanner />);
    expect(screen.getByText("Privacy policy")).toBeInTheDocument();
  });
});
