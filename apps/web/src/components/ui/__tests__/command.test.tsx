import { render, screen, setup } from "@/test/test-utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../command";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

function renderCommand() {
  return setup(
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>
            Create new
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem>Open file</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem>Preferences</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>,
  );
}

describe("Command", () => {
  it("renders the input with placeholder", () => {
    renderCommand();
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders command items", () => {
    renderCommand();
    expect(screen.getByText("Create new")).toBeInTheDocument();
    expect(screen.getByText("Open file")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
  });

  it("renders group headings", () => {
    renderCommand();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders shortcut", () => {
    renderCommand();
    const shortcut = screen.getByText("N").closest("[data-slot='command-shortcut']");
    expect(shortcut).toBeInTheDocument();
  });

  it("sets data-slot on command root", () => {
    renderCommand();
    const root = document.querySelector("[data-slot='command']");
    expect(root).toBeInTheDocument();
  });

  it("sets data-slot on command input wrapper", () => {
    renderCommand();
    const wrapper = document.querySelector("[data-slot='command-input-wrapper']");
    expect(wrapper).toBeInTheDocument();
  });

  it("sets data-slot on command list", () => {
    renderCommand();
    const list = document.querySelector("[data-slot='command-list']");
    expect(list).toBeInTheDocument();
  });

  it("sets data-slot on command item", () => {
    renderCommand();
    const items = document.querySelectorAll("[data-slot='command-item']");
    expect(items.length).toBe(3);
  });

  it("sets data-slot on separator", () => {
    renderCommand();
    const sep = document.querySelector("[data-slot='command-separator']");
    expect(sep).toBeInTheDocument();
  });

  it("Command merges custom className", () => {
    render(
      <Command className="custom-cmd">
        <CommandList>
          <CommandItem>Item</CommandItem>
        </CommandList>
      </Command>,
    );
    const root = document.querySelector("[data-slot='command']");
    expect(root?.className).toContain("custom-cmd");
  });

  it("filters items when typing", async () => {
    const { user } = renderCommand();
    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "Pref");
    expect(screen.getByText("Preferences")).toBeInTheDocument();
    expect(screen.queryByText("Create new")).not.toBeInTheDocument();
  });

  it("shows empty state when no match", async () => {
    const { user } = renderCommand();
    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "zzzzz");
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });
});
