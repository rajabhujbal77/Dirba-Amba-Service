# On-the-Fly Customer Pricing - Implementation Guide

> **Date:** January 13, 2026  
> **Feature:** Editable package prices during booking with customer-specific price memory

---

## Overview

This feature allows:
1. **Default prices** from Settings pricing table
2. **Editable prices** during booking - clerk can change any price
3. **Remember pricing** - custom prices saved per customer for automatic use next time

---

## Files Modified

| File | Changes |
|------|---------|
| `src/app/components/NewBooking.tsx` | Added editable price input, customer pricing fetch, save custom prices on submit |
| `src/app/utils/api.ts` | Uses existing `creditApi.getCustomerPricing()` and `setCustomerPricing()` |

---

## Backup Files

Before implementation, backups were created:
- `src/app/components/NewBooking.tsx.backup`
- `src/app/utils/api.ts.backup`

---

## How to Revert

If the feature doesn't work as expected:

### Option 1: Restore from backup files
```powershell
Copy-Item "src\app\components\NewBooking.tsx.backup" "src\app\components\NewBooking.tsx" -Force
Copy-Item "src\app\utils\api.ts.backup" "src\app\utils\api.ts" -Force
```

### Option 2: Git revert
```bash
git log --oneline -5  # Find the commit before this feature
git revert <commit-hash>
```

---

## How It Works

1. **Step 3** fetches customer pricing when mounted (based on sender phone)
2. **Price hierarchy**: Customer pricing → Depot pricing → Base price
3. **Editable input**: Small price input field beside each package
4. **Visual indicators**: 
   - "💰 Special pricing applied" message when customer has saved prices
   - Orange border when price differs from standard
   - Shows discount/markup amount (e.g., "-₹10" or "+₹5")
5. **On submit**: Saves any custom prices to `credit_customer_pricing` table

---

## Database Tables Used

**`credit_customer_pricing`** (already exists):
- `customer_phone` - sender's phone number
- `package_id` - package UUID
- `depot_id` - destination depot UUID
- `discounted_price` - custom price for this customer

Works for ALL payment methods (cash, online, to_pay, credit).

---

## Testing Checklist

- [x] Default prices display from Settings
- [x] Price input is editable
- [x] Total updates when price is changed
- [x] Custom prices saved on booking submit
- [x] Next booking for same customer shows saved prices
- [x] Works for cash, online, to_pay, and credit payment methods

---

## Notes

- Credit Ledger still only shows credit customers (filtered by payment_method='credit')
- This feature uses the same `credit_customer_pricing` table but works for all payment types
- Build verified: ✅ Success
