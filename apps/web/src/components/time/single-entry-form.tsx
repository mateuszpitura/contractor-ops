"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contract {
  id: string;
  title: string;
}

interface SingleEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
  onSubmit: (entry: {
    contractId: string;
    entryDate: string;
    minutes: number;
    description?: string;
  }) => void;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog form for ad-hoc time entry per UI-SPEC SingleEntryForm (D-01).
 *
 * Fields: Date (datepicker), Project (select), Hours (number), Description (textarea).
 * Footer: "Discard Entry" outline + "Add Entry" primary.
 */
export function SingleEntryForm({
  open,
  onOpenChange,
  contracts,
  onSubmit,
  isSubmitting,
}: SingleEntryFormProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [contractId, setContractId] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const resetForm = () => {
    setDate(new Date());
    setContractId("");
    setHours("");
    setDescription("");
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!date) {
      newErrors.date = "Date is required";
    }
    if (!contractId) {
      newErrors.contractId = "Project is required";
    }
    const hoursVal = parseFloat(hours);
    if (!hours || isNaN(hoursVal) || hoursVal < 0.25 || hoursVal > 24) {
      newErrors.hours = "Hours must be between 0.25 and 24";
    }
    if (description && description.length > 500) {
      newErrors.description = "Description must be 500 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const hoursVal = parseFloat(hours);
    const minutes = Math.round(hoursVal * 60);

    onSubmit({
      contractId,
      entryDate: format(date!, "yyyy-MM-dd"),
      minutes,
      description: description || undefined,
    });

    resetForm();
  };

  const handleDiscard = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Time Entry</DialogTitle>
          <DialogDescription>
            Add a single time entry for a specific date and project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label htmlFor="entry-date">Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="entry-date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarDays className="me-2 h-4 w-4" />
                  {date ? format(date, "MMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                  defaultMonth={date}
                />
              </PopoverContent>
            </Popover>
            {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>

          {/* Project select */}
          <div className="space-y-2">
            <Label htmlFor="entry-project">Project</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger id="entry-project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contractId && <p className="text-sm text-destructive">{errors.contractId}</p>}
          </div>

          {/* Hours input */}
          <div className="space-y-2">
            <Label htmlFor="entry-hours">Hours</Label>
            <Input
              id="entry-hours"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              placeholder="e.g. 1.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}
          </div>

          {/* Description textarea */}
          <div className="space-y-2">
            <Label htmlFor="entry-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="entry-description"
              rows={3}
              maxLength={500}
              placeholder="What did you work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
            {description.length > 0 && (
              <p className="text-xs text-muted-foreground text-end">{description.length}/500</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDiscard}>
            Discard Entry
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
