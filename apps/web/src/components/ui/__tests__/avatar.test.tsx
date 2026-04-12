import { render, screen } from "@/test/test-utils";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "../avatar";

describe("Avatar", () => {
  it("renders with data-slot=avatar", () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-slot", "avatar");
  });

  it("defaults to size=default", () => {
    render(
      <Avatar data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-size", "default");
  });

  it.each(["sm", "lg"] as const)("accepts size=%s", (size) => {
    render(
      <Avatar data-testid="avatar" size={size}>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-size", size);
  });

  it("merges custom className", () => {
    render(
      <Avatar data-testid="avatar" className="border-2">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByTestId("avatar").className).toContain("border-2");
  });
});

describe("AvatarFallback", () => {
  it("renders fallback text", () => {
    render(
      <Avatar>
        <AvatarFallback>MP</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("MP")).toBeInTheDocument();
  });

  it("sets data-slot=avatar-fallback", () => {
    render(
      <Avatar>
        <AvatarFallback>MP</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("MP")).toHaveAttribute("data-slot", "avatar-fallback");
  });
});

describe("AvatarImage", () => {
  it("shows fallback when image has not loaded", () => {
    // In jsdom, images never actually load so the fallback is always shown
    render(
      <Avatar>
        <AvatarImage src="/photo.jpg" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});

describe("AvatarBadge", () => {
  it("renders with data-slot=avatar-badge", () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
        <AvatarBadge data-testid="badge" />
      </Avatar>,
    );
    expect(screen.getByTestId("badge")).toHaveAttribute("data-slot", "avatar-badge");
  });

  it("renders as a span", () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
        <AvatarBadge data-testid="badge" />
      </Avatar>,
    );
    expect(screen.getByTestId("badge").tagName).toBe("SPAN");
  });
});

describe("AvatarGroup", () => {
  it("renders with data-slot=avatar-group", () => {
    render(
      <AvatarGroup data-testid="group">
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
      </AvatarGroup>,
    );
    expect(screen.getByTestId("group")).toHaveAttribute("data-slot", "avatar-group");
  });
});

describe("AvatarGroupCount", () => {
  it("renders with data-slot=avatar-group-count", () => {
    render(<AvatarGroupCount data-testid="count">+3</AvatarGroupCount>);
    expect(screen.getByTestId("count")).toHaveAttribute("data-slot", "avatar-group-count");
    expect(screen.getByText("+3")).toBeInTheDocument();
  });
});
