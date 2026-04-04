"use client";

import { BsMicrosoftTeams } from "react-icons/bs";
import { cn } from "@/lib/utils";

interface TeamsLogoProps {
  className?: string;
}

export function TeamsLogo({ className }: TeamsLogoProps) {
  return (
    <BsMicrosoftTeams
      className={cn("shrink-0", className)}
      style={{ color: "#6264A7" }}
      aria-hidden
    />
  );
}
