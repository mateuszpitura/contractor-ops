# Dropdown/Select Label Rendering Audit
**Date**: 2026-05-15  
**Scope**: `/apps/web/src/` components using shadcn `<Select>` and custom Combobox  
**Total files scanned**: 50+ files with Select imports  
**Audit Type**: READ-ONLY, pattern matching + code review

---

## Summary

**Bugs found**: 1 HIGH severity  
**Suspicious patterns (low/no bug)**: 4 files need review but likely OK  
**Well-implemented patterns**: 45+ files follow correct label rendering  

| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 1 | Raw enum rendering in Select dropdown (workflows condition-builder) |
| MEDIUM | 0 | — |
| LOW | 0 | — |
| **CLEAN** | **45+** | Correct label/translation rendering |

---

## Confirmed Bugs

### Bug #1: HIGH — Raw enum value rendered instead of label
**File**: `/apps/web/src/components/workflows/template-builder/condition-builder.tsx`  
**Location**: Lines 210–214  
**Severity**: HIGH (user-facing workflow automation, visible to contractors)

```tsx
{ENUM_VALUE_FIELDS[rule.field]?.map(v => (
  <SelectItem key={v} value={v}>
    {v}  // BUG: renders raw enum like "ACTIVE", "DRAFT", "LOW" etc.
  </SelectItem>
))}
```

**Details**:
- Component renders condition builder for workflow rules with enum-based fields (contractor.status, contract.status, contractor.complianceRiskLevel, etc.)
- The `ENUM_VALUE_FIELDS` map contains raw enum values like `['DRAFT', 'ONBOARDING', 'ACTIVE', ...]`
- SelectItem children render `{v}` (the raw enum) instead of a human-readable label
- User sees `LIFECYCLE_ACTIVE` or `DRAFT` in dropdown, not "Active" or "Draft"

**Impact**:
- Affects workflow template builder — users creating automation rules see cryptic enum keys
- HIGH impact because it's in the core workflow automation UI

**Fix**:
- Create `ENUM_VALUE_LABELS` map or use `t(`conditionValue.${v}`)` pattern
- Example:
  ```tsx
  {ENUM_VALUE_FIELDS[rule.field]?.map(v => (
    <SelectItem key={v} value={v}>
      {t(`conditionValue.${v}` as Parameters<typeof t>[0])}
    </SelectItem>
  ))}
  ```
- Or add a labels registry (see Recommendation section)

---

## Likely-OK but Spot-Check Recommended

### File: `/apps/web/src/components/integrations/google-workspace/role-assignment-controls.tsx`
**Status**: CLEAN ✓  
**Lines**: 64–66  
```tsx
{ROLE_OPTIONS.map(role => (
  <SelectItem key={role} value={role}>
    {ROLE_LABELS[role]}  // Uses ROLE_LABELS map ✓
  </SelectItem>
))}
```
**Note**: Good pattern — has static `ROLE_LABELS` registry at top of file (lines 21–30). This is the pattern we want.

### File: `/apps/web/src/components/integrations/google-workspace/group-role-mapping-step.tsx`
**Status**: CLEAN ✓  
**Lines**: 75–78  
```tsx
{ROLE_OPTIONS.map(role => (
  <SelectItem key={role} value={role}>
    {ROLE_LABELS[role]}  // ✓
  </SelectItem>
))}
```
**Note**: Imports `ROLE_LABELS, ROLE_OPTIONS` from role-assignment-controls (line 14). Consistent pattern.

### File: `/apps/web/src/components/onboarding/people-review-step.tsx`
**Status**: CLEAN ✓  
**Lines**: 337–340 and 456–459  
```tsx
{ROLE_OPTIONS.map(r => (
  <SelectItem key={r.value} value={r.value}>
    {r.label}  // ✓ Uses pre-built label from options array
  </SelectItem>
))}
```
**Note**: `ROLE_OPTIONS` is an array of `{value, label}` objects, so label lookup is safe.

### File: `/apps/web/src/components/contracts/contract-detail/send-for-signature-dialog.tsx`
**Status**: CLEAN ✓  
**Lines**: 374–377, 392–394  
```tsx
<SelectItem value="7">{tSend('expires7')}</SelectItem>
<SelectItem value="14">{tSend('expires14')}</SelectItem>
<SelectItem value="30">{tSend('expires30')}</SelectItem>
<SelectItem value="60">{tSend('expires60')}</SelectItem>
```
**Note**: Hardcoded SelectItems with translation keys. Correct pattern.

---

## Custom Comboboxes — All Clean

### File: `/apps/web/src/components/contractors/compliance/handelsregister-input.tsx`
**Status**: CLEAN ✓  
**Lines**: 124  
```tsx
{selectedCourt ? selectedCourt.name : 'Select court...'}
```
**Pattern**: Custom Command/Popover combobox (Radix Command) renders `selectedCourt.name` in trigger, not the ID. Correct.

---

## Well-Implemented Select Patterns (Representative Examples)

All following files implement correct label rendering patterns:

1. **Billing Model Select** (`/contractors/contractor-wizard/step-billing.tsx:105–110`)
   - Uses items array with `{value, label}` structure
   - Renders `{model.label}` in SelectItem ✓

2. **Owner Select** (`/contractors/contractor-wizard/step-assignment.tsx:71–74`)
   - Maps users to `{value: userId, label: displayName}`
   - Renders `{item.label}` ✓

3. **Currency Select** (`/invoices/invoice-detail/invoice-metadata-form.tsx:485–489`)
   - Static `CURRENCY_OPTIONS` array with labels
   - Renders `{opt.label}` ✓

4. **VAT Rate Selector** (`/invoices/vat-rate-selector.tsx:78–107`)
   - Builds display string with rate + description: `{rate.ratePercent}% — {rate.description}` ✓

5. **Task Type Select** (`/workflows/template-builder/task-card.tsx:247–254`)
   - Uses `taskTypeItems` array with labels built via `t(enumKey(type))`
   - Renders `{item.label}` ✓

6. **Condition Builder Field Select** (`/workflows/template-builder/condition-builder.tsx:170–175`)
   - Renders field labels via translation: `{t(`conditionField.${field}`)}`  ✓

7. **Settings Condition Builder** (`/settings/condition-builder.tsx:53–61`)
   - Pre-builds `fieldItems` and `operatorItems` with labels via `t(labelKey)` ✓

---

## Recommendation

### Option A: Shared Enum Label Helper (RECOMMENDED)
Create a centralized util for enum → label mapping:

```typescript
// libs/utils/src/enum-labels.ts
export const ENUM_LABELS: Record<string, Record<string, string>> = {
  'contractor.status': {
    DRAFT: 'Draft',
    ONBOARDING: 'Onboarding',
    ACTIVE: 'Active',
    OFFBOARDING: 'Offboarding',
    ENDED: 'Ended',
  },
  'contractor.type': {
    SOLE_TRADER: 'Sole Trader',
    COMPANY: 'Company',
    INDIVIDUAL_FREELANCER: 'Freelancer',
    OTHER: 'Other',
  },
  // ... etc
};

export function getEnumLabel(fieldName: string, value: string): string {
  return ENUM_LABELS[fieldName]?.[value] ?? value;
}
```

**Benefits**:
- Single source of truth for all enum labels
- Easier to maintain across codebase
- No need to add translations for every enum (can fallback to titleCase)

### Option B: Per-File Label Registry (QUICK FIX)
Add at top of condition-builder.tsx:

```typescript
const ENUM_VALUE_LABELS: Record<string, string> = {
  // contractor.status
  DRAFT: 'Draft',
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  OFFBOARDING: 'Offboarding',
  ENDED: 'Ended',
  // contractor.type
  SOLE_TRADER: 'Sole Trader',
  // ... etc
};
```

Then use: `{ENUM_VALUE_LABELS[v] ?? v}`

### Option C: Translations (CONSISTENT WITH CODEBASE)
Use i18n like the rest of the codebase:

```tsx
{ENUM_VALUE_FIELDS[rule.field]?.map(v => (
  <SelectItem key={v} value={v}>
    {t(`conditionValue.${v}` as Parameters<typeof t>[0])}
  </SelectItem>
))}
```

Requires adding keys to translation files (e.g. `conditionValue.ACTIVE`, `conditionValue.DRAFT`).

---

## DropdownMenu Radio Items

**No issues found.** Only one file uses `DropdownMenuRadioItem`:
- `/components/ui/dropdown-menu.tsx` — This is the component definition itself, not a consumer.

---

## Conclusion

**1 HIGH-severity bug found** in the workflow condition builder where enum values are rendered raw.

**Recommendation**: Implement Option C (translations) for consistency with the codebase. The ENUM_VALUE_FIELDS map already enumerates all possible values per field, so a simple loop adding translation keys is quick.

**Timeline**: Fix this before the next UI quality pass release since it directly impacts user experience in workflow automation (contractors may not understand what "ACTIVE" vs "Active" means in the context of automation rules).

---

*Audit completed in read-only mode. No files modified.*
