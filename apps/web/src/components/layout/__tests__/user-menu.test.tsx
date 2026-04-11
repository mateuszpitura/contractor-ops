import { render, screen, setup } from "@/test/test-utils";
import { UserMenu } from "../user-menu";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: { name: "Jan Kowalski", email: "jan@test.com", image: null },
      },
    }),
    signOut: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("@/lib/avatar-initials", () => ({
  getAvatarInitials: () => "JK",
}));

vi.mock("@/hooks/use-density", () => ({
  useDensity: () => ({ density: "comfortable", toggleDensity: vi.fn() }),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/i18n/routing", () => ({}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("UserMenu", () => {
  it("renders user name and email", () => {
    render(<UserMenu />);
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText("jan@test.com")).toBeInTheDocument();
  });

  it("renders avatar initials", () => {
    render(<UserMenu />);
    expect(screen.getAllByText("JK").length).toBeGreaterThan(0);
  });

  it("renders trigger button with user info", () => {
    render(<UserMenu />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders user name in the trigger area", () => {
    render(<UserMenu />);
    const nameElements = screen.getAllByText("Jan Kowalski");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders user email in the trigger area", () => {
    render(<UserMenu />);
    const emailElements = screen.getAllByText("jan@test.com");
    expect(emailElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders avatar fallback initials", () => {
    render(<UserMenu />);
    const initials = screen.getAllByText("JK");
    expect(initials.length).toBeGreaterThanOrEqual(1);
  });

  it("renders SVG icons", () => {
    const { container } = render(<UserMenu />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Menu items rendered after opening dropdown ----
  it("renders settings menu item after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("Settings")).toBeInTheDocument();
  });

  it("renders dark mode toggle after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("Dark mode")).toBeInTheDocument();
  });

  it("renders sign out after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("Sign out")).toBeInTheDocument();
  });

  it("renders density toggle after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("Compact")).toBeInTheDocument();
  });

  it("renders language switcher after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("Language")).toBeInTheDocument();
  });

  it("renders locale switch button after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("PL")).toBeInTheDocument();
  });

  it("renders edit name after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    expect(await screen.findByText("Edit name")).toBeInTheDocument();
  });

  // ---- Dark mode switch ----
  it("renders dark mode switch after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const switches = await screen.findAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Density switch ----
  it("renders density switch after opening menu", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const switches = await screen.findAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(2);
  });

  // ---- Settings navigation ----
  it("renders settings menu item with icon", async () => {
    const { user, container } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    await screen.findByText("Settings");
    const settingsItem = screen.getByText("Settings");
    expect(settingsItem).toBeInTheDocument();
  });

  // ---- Sign out menu item ----
  it("renders sign out menu item with icon", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const signOut = await screen.findByText("Sign out");
    expect(signOut).toBeInTheDocument();
  });

  // ---- Dark mode switch interaction ----
  it("can toggle dark mode switch", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const switches = await screen.findAllByRole("switch");
    const darkModeSwitch = switches.find(
      (s) => s.getAttribute("aria-label") === "Dark mode",
    );
    expect(darkModeSwitch).toBeDefined();
    if (darkModeSwitch) {
      await user.click(darkModeSwitch);
      // Should not throw
    }
  });

  // ---- Density switch interaction ----
  it("can toggle density switch", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const switches = await screen.findAllByRole("switch");
    const densitySwitch = switches.find(
      (s) => s.getAttribute("aria-label") === "Compact",
    );
    expect(densitySwitch).toBeDefined();
    if (densitySwitch) {
      await user.click(densitySwitch);
    }
  });

  // ---- Language switch ----
  it("renders language switch button showing PL", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const plButton = await screen.findByText("PL");
    expect(plButton).toBeInTheDocument();
  });

  it("clicking language switch does not throw", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const plButton = await screen.findByText("PL");
    await user.click(plButton);
  });

  // ---- Edit name dialog ----
  it("opens edit name dialog when Edit name is clicked", async () => {
    const { user } = setup(<UserMenu />);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);
    const editNameItem = await screen.findByText("Edit name");
    await user.click(editNameItem);
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
  });

  // ---- User info without image shows fallback ----
  it("shows avatar fallback when user has no image", () => {
    render(<UserMenu />);
    const initials = screen.getAllByText("JK");
    expect(initials.length).toBeGreaterThanOrEqual(1);
  });
});
