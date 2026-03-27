"use client"

import { CheckCircle2, AlertCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const

/**
 * Validates a Polish NIP (tax identification number) using modulo-11 checksum.
 * NIP must be exactly 10 digits. The 10th digit is the check digit.
 */
function validateNip(nip: string): boolean {
  const digits = nip.replace(/[\s-]/g, "")

  if (!/^\d{10}$/.test(digits)) {
    return false
  }

  const sum = NIP_WEIGHTS.reduce(
    (acc, weight, index) => acc + weight * Number(digits[index]),
    0
  )

  const remainder = sum % 11

  // Remainder of 10 means invalid NIP
  if (remainder === 10) {
    return false
  }

  return remainder === Number(digits[9])
}

interface NipValidationBadgeProps {
  nip: string | null
}

export function NipValidationBadge({ nip }: NipValidationBadgeProps) {
  if (!nip || nip.trim().length === 0) {
    return null
  }

  const isValid = validateNip(nip)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          {isValid ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3.5" />
              <span>Valid NIP format</span>
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="size-3.5" />
              <span>Invalid NIP format</span>
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isValid
              ? `NIP ${nip.replace(/[\s-]/g, "")} passes modulo-11 checksum validation`
              : "Invalid NIP format -- expected 10 digits with valid checksum"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { validateNip }
