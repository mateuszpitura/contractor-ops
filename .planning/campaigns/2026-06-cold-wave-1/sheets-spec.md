# Google Sheets — post-import setup

After importing the CSVs as tabs into a single Google Sheet, apply the following dropdowns, formulas, and conditional formatting. ~15 minutes total.

## 1. Import order

1. Create new Google Sheet: `cold-wave-1`.
2. Import each CSV as its own tab (File → Import → Upload → "Insert new sheet(s)"):
   - `prospects.csv` → tab `prospects`
   - `copy_templates.csv` → tab `copy_templates`
   - `cells.csv` → tab `cells`
   - `suppression.csv` → tab `suppression`
   - `compliance.csv` → tab `compliance`
   - `domains.csv` → tab `domains`
   - `asset_specs.csv` → tab `asset_specs`
   - `timeline.csv` → tab `timeline`
3. Freeze row 1 on every tab (View → Freeze → 1 row).

## 2. Dropdowns on `prospects` tab

Apply Data → Data validation:

| Column | Type | Source |
|--------|------|--------|
| `geo` | Dropdown (chip) | `DE, PL, UK, AE, SA` |
| `segment` | Dropdown | `agency, smb, partner, adjacent` |
| `language` | Dropdown | `de, pl, en` |
| `seniority` | Dropdown | `C-Level, VP, Director, Manager, IC` |
| `email_verified` | Dropdown | `valid, risky, catch-all, invalid, unverified` |
| `offer_angle` | Dropdown | `classification-engine, e-invoicing, saudization-dashboard, full-saas-pilot, partnership-referral` |
| `pitch_variant` | Dropdown | `A, B, C` |
| `send_status` | Dropdown | `not_started, queued, sent, follow_up_1_sent, follow_up_2_sent, replied, booked, dead, unsubscribed` |
| `last_touch` | Dropdown | `step_1, step_2, step_3` |
| `reply_sentiment` | Dropdown | `interested, pass, wrong_person, unsubscribe, bounced, OOO` |

## 3. Conditional formatting on `prospects` tab

| Rule | Condition | Format |
|------|-----------|--------|
| Booked | `$Y2="booked"` | Green fill |
| Replied (interested) | `$AC2="interested"` | Light green fill |
| Dead / unsubscribed | `$Y2` in (`dead`, `unsubscribed`) | Gray strikethrough |
| Risky email | `$R2` in (`risky`, `catch-all`) | Yellow fill on email column |
| Invalid email | `$R2="invalid"` | Red fill on email column |
| Missing personalization | `$U2=""` AND `$Y2!="not_started"` | Red border on hook column |

(Column letters assume the CSV header order; adjust if you reorder.)

## 4. Formulas

### On `cells` tab — add live counters

In new columns after `notes`:

```
M2:  =COUNTIFS(prospects!B:B, A2_geo, prospects!C:C, B2_segment)            (prospects_loaded)
N2:  =COUNTIFS(prospects!B:B, A2_geo, prospects!C:C, B2_segment, prospects!Y:Y, "sent")
O2:  =COUNTIFS(prospects!B:B, A2_geo, prospects!C:C, B2_segment, prospects!Y:Y, "replied")
P2:  =COUNTIFS(prospects!B:B, A2_geo, prospects!C:C, B2_segment, prospects!Y:Y, "booked")
Q2:  =IFERROR(O2/N2, 0)   (reply rate)
R2:  =IFERROR(P2/N2, 0)   (booking rate)
```

Adjust the `prospects!B:B` (geo) and `prospects!C:C` (segment) ranges to match your real column letters after import — Google Sheets does not import column letters, just headers.

### On `prospects` tab — auto-suppress if email in suppression list

Add new column `suppressed`:

```
=IF(COUNTIF(suppression!A:A, Q2_email) > 0, "SUPPRESSED", "")
```

Then conditional-format any row where `suppressed = "SUPPRESSED"` with gray fill + strikethrough.

## 5. Protected ranges

Protect (Data → Protected sheets and ranges) so collaborators do not break schema:

- Row 1 on every tab (headers)
- `compliance` tab (legal copy)
- `domains` tab (DNS records)

## 6. Connect to Instantly / Smartlead

Most sending platforms ingest CSV export, not live Sheets. Workflow:

1. Filter `prospects` to `send_status = not_started` AND `email_verified = valid`.
2. File → Download → CSV.
3. Upload to Instantly campaign matching the cell.
4. When Instantly reports back (replies, bounces), update `send_status` + `replied_at` either manually or via Zapier/Make integration.

Optional: Instantly → webhook → Google Sheets via Make.com (cheapest is 1000 ops/mo free tier). Out of scope for first sub-wave.

## 7. Backup

Every Friday: File → Make a copy → suffix with date. Versioned snapshots in case live sheet corrupts during Apollo bulk imports.
