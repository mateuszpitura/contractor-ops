"use client";

import {
  Laptop,
  Monitor,
  Smartphone,
  Headphones,
  Keyboard,
  Mouse,
  Package,
  Box,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EquipmentType =
  | "LAPTOP"
  | "MONITOR"
  | "PHONE"
  | "HEADSET"
  | "KEYBOARD"
  | "MOUSE"
  | "OTHER";

const TYPE_ICON_MAP: Record<EquipmentType, LucideIcon> = {
  LAPTOP: Laptop,
  MONITOR: Monitor,
  PHONE: Smartphone,
  HEADSET: Headphones,
  KEYBOARD: Keyboard,
  MOUSE: Mouse,
  OTHER: Package,
};

interface EquipmentTypeIconProps {
  type: string;
  className?: string;
}

/**
 * Maps an equipment type to its corresponding Lucide icon.
 * Falls back to Box for unrecognized custom types.
 */
export function EquipmentTypeIcon({ type, className }: EquipmentTypeIconProps) {
  const Icon = TYPE_ICON_MAP[type as EquipmentType] ?? Box;
  return <Icon className={cn("h-4 w-4 text-muted-foreground", className)} />;
}
