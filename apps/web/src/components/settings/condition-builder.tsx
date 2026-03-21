"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Condition = {
  field: "amount" | "contractorType";
  operator: "gt" | "lt" | "eq";
  value: string | number;
};

type ConditionBuilderProps = {
  value: Condition[];
  onChange: (conditions: Condition[]) => void;
};

// ---------------------------------------------------------------------------
// Field / operator label maps
// ---------------------------------------------------------------------------

const FIELD_OPTIONS: { value: Condition["field"]; label: string }[] = [
  { value: "amount", label: "Amount" },
  { value: "contractorType", label: "Contractor type" },
];

const OPERATOR_OPTIONS: { value: Condition["operator"]; label: string }[] = [
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "eq", label: "Equals" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  function handleAdd() {
    onChange([...value, { field: "amount", operator: "gt", value: "" }]);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleUpdate(index: number, patch: Partial<Condition>) {
    onChange(
      value.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, ...patch };
        // Reset value when field changes
        if (patch.field && patch.field !== c.field) {
          updated.value = "";
        }
        return updated;
      }),
    );
  }

  return (
    <div className="space-y-3">
      {value.map((condition, index) => (
        <div key={index} className="flex h-10 items-center gap-2">
          {/* Field select */}
          <Select
            value={condition.field}
            onValueChange={(v) =>
              handleUpdate(index, { field: v as Condition["field"] })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {FIELD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator select */}
          <Select
            value={condition.operator}
            onValueChange={(v) =>
              handleUpdate(index, { operator: v as Condition["operator"] })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select operator..." />
            </SelectTrigger>
            <SelectContent>
              {OPERATOR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value input */}
          <Input
            type={condition.field === "amount" ? "number" : "text"}
            value={condition.value}
            onChange={(e) =>
              handleUpdate(index, {
                value:
                  condition.field === "amount"
                    ? e.target.value === ""
                      ? ""
                      : Number(e.target.value)
                    : e.target.value,
              })
            }
            placeholder="Enter value..."
            className="flex-1"
            min={condition.field === "amount" ? 0 : undefined}
          />

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => handleRemove(index)}
            aria-label="Remove condition"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      {/* Add condition */}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-1.5 size-3.5" />
        Add condition
      </Button>

      <p className="text-xs text-muted-foreground">
        When an invoice matches these conditions, this chain is used. Leave empty
        for the default chain.
      </p>
    </div>
  );
}
