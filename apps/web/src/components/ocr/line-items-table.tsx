"use client"

import { useCallback } from "react"
import { Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfidenceBadge } from "@/components/ocr/confidence-badge"

interface LineItem {
  id: string
  description: string
  quantity: number | null
  unit: string | null
  unitPriceMinor: number | null
  netAmountMinor: number | null
  vatRate: string | null
  vatAmountMinor: number | null
  grossAmountMinor: number | null
  confidence: number
}

interface LineItemsTableProps {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  readOnly?: boolean
}

function formatMinorUnits(minor: number | null): string {
  if (minor == null) return ""
  return (minor / 100).toFixed(2)
}

function parseToMinorUnits(display: string): number | null {
  const value = Number.parseFloat(display)
  if (Number.isNaN(value)) return null
  return Math.round(value * 100)
}

function formatNumber(value: number | null): string {
  if (value == null) return ""
  return String(value)
}

function parseNumber(display: string): number | null {
  const value = Number.parseFloat(display)
  if (Number.isNaN(value)) return null
  return value
}

export function LineItemsTable({
  items,
  onChange,
  readOnly = false,
}: LineItemsTableProps) {
  const updateItem = useCallback(
    (index: number, field: keyof LineItem, value: string) => {
      const updated = [...items]
      const item = { ...updated[index] }

      switch (field) {
        case "description":
        case "unit":
        case "vatRate":
          ;(item[field] as string | null) = value || null
          break
        case "quantity":
          item.quantity = parseNumber(value)
          break
        case "unitPriceMinor":
        case "netAmountMinor":
        case "vatAmountMinor":
        case "grossAmountMinor":
          ;(item[field] as number | null) = parseToMinorUnits(value)
          break
        default:
          break
      }

      updated[index] = item
      onChange(updated)
    },
    [items, onChange]
  )

  const removeItem = useCallback(
    (index: number) => {
      const updated = items.filter((_, i) => i !== index)
      onChange(updated)
    },
    [items, onChange]
  )

  const addItem = useCallback(() => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: "",
      quantity: null,
      unit: null,
      unitPriceMinor: null,
      netAmountMinor: null,
      vatRate: null,
      vatAmountMinor: null,
      grossAmountMinor: null,
      confidence: 0,
    }
    onChange([...items, newItem])
  }, [items, onChange])

  return (
    <div className="flex flex-col gap-3">
      {/* Heading */}
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-semibold">Line Items</h3>
        <Badge variant="secondary">{items.length} items</Badge>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="w-20">Qty</TableHead>
              <TableHead className="w-20">Unit</TableHead>
              <TableHead className="w-28">Unit Price</TableHead>
              <TableHead className="w-28">Net</TableHead>
              <TableHead className="w-24">VAT Rate</TableHead>
              <TableHead className="w-28">VAT Amount</TableHead>
              <TableHead className="w-28">Gross</TableHead>
              <TableHead className="w-16">Conf.</TableHead>
              {!readOnly && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={item.id}
                className="animate-in fade-in-0 duration-200"
              >
                <TableCell>
                  <InlineInput
                    value={item.description}
                    onChange={(v) => updateItem(index, "description", v)}
                    readOnly={readOnly}
                    placeholder="Description"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatNumber(item.quantity)}
                    onChange={(v) => updateItem(index, "quantity", v)}
                    readOnly={readOnly}
                    placeholder="0"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={item.unit ?? ""}
                    onChange={(v) => updateItem(index, "unit", v)}
                    readOnly={readOnly}
                    placeholder="pcs"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.unitPriceMinor)}
                    onChange={(v) => updateItem(index, "unitPriceMinor", v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.netAmountMinor)}
                    onChange={(v) => updateItem(index, "netAmountMinor", v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={item.vatRate ?? ""}
                    onChange={(v) => updateItem(index, "vatRate", v)}
                    readOnly={readOnly}
                    placeholder="23%"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.vatAmountMinor)}
                    onChange={(v) => updateItem(index, "vatAmountMinor", v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <InlineInput
                    value={formatMinorUnits(item.grossAmountMinor)}
                    onChange={(v) => updateItem(index, "grossAmountMinor", v)}
                    readOnly={readOnly}
                    placeholder="0.00"
                    className="text-end"
                  />
                </TableCell>
                <TableCell>
                  <ConfidenceBadge
                    confidence={item.confidence}
                    showPercentage={false}
                  />
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}
                      aria-label="Remove Item"
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add line item */}
      {!readOnly && (
        <Button variant="ghost" size="sm" onClick={addItem} className="w-fit">
          <Plus />
          Add line item
        </Button>
      )}
    </div>
  )
}

function InlineInput({
  value,
  onChange,
  readOnly,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  readOnly: boolean
  placeholder?: string
  className?: string
}) {
  if (readOnly) {
    return (
      <span className={cn("text-sm", className)}>
        {value || <span className="text-muted-foreground">&mdash;</span>}
      </span>
    )
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-7 border-transparent bg-transparent text-sm shadow-none hover:border-input focus-visible:border-input",
        className
      )}
    />
  )
}
