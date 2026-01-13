# Debug: Ceiling Detection Not Working

## Quick Test

Run this in your browser console or Node.js:

```javascript
import { gate_CeilingDetection } from './lib/gates/retentionGates.js';

// Test ceiling topics
console.log('Testing us_debt_treasuries:', gate_CeilingDetection('us_debt_treasuries'));
console.log('Testing currency_devaluation:', gate_CeilingDetection('currency_devaluation'));
console.log('Testing war_costs_economics:', gate_CeilingDetection('war_costs_economics'));

// Test non-ceiling topic
console.log('Testing logistics_supply_chain:', gate_CeilingDetection('logistics_supply_chain'));
```

Expected output:
- `us_debt_treasuries`: `{ has_ceiling: true, ... }`
- `currency_devaluation`: `{ has_ceiling: true, ... }`
- `war_costs_economics`: `{ has_ceiling: true, ... }`
- `logistics_supply_chain`: `{ has_ceiling: false, ... }`

## Common Issues

### Issue 1: Topic ID Mismatch
**Problem:** Topic IDs from classification don't match enhanced DNA topic IDs.

**Check:**
```sql
SELECT DISTINCT 
  raw_data->'recommendation'->>'topic' as topic_id
FROM signals 
WHERE show_id = 'YOUR_SHOW_ID'
ORDER BY topic_id;
```

**Solution:** Verify topic IDs match exactly:
- Enhanced DNA uses: `us_debt_treasuries`, `currency_devaluation`, `war_costs_economics`
- Classification might use different format

### Issue 2: Ceiling Detection Not Called
**Problem:** Code runs but ceiling detection isn't executed.

**Check:** Look for these logs in server console:
```
⛔ CEILING TOPIC DETECTED: "..."
   Topic: us_debt_treasuries
   Reason: Niche audience...
```

**Solution:** If you don't see these logs, ceiling detection isn't being called. Check:
1. Is `gate_CeilingDetection` imported?
2. Is it being called in the loop?
3. Do items have `rec.topic` set?

### Issue 3: Items Don't Have Topic IDs
**Problem:** Items pass through but don't have topic classification.

**Check:** Add logging:
```javascript
console.log('Topic IDs in recommendations:', recommendations.recommended.map(r => r.topic));
```

**Solution:** Ensure classification is working and topic IDs are being set.

## Manual Test

1. **Find a signal with ceiling topic:**
   ```sql
   SELECT id, title, raw_data->'recommendation'->>'topic' as topic
   FROM signals 
   WHERE raw_data->'recommendation'->>'topic' IN ('us_debt_treasuries', 'currency_devaluation', 'war_costs_economics')
   LIMIT 5;
   ```

2. **Check if ceiling_detected is set:**
   ```sql
   SELECT 
     id,
     title,
     raw_data->'recommendation'->>'ceiling_detected' as ceiling_detected,
     raw_data->'recommendation'->>'ceiling_reason' as ceiling_reason
   FROM signals 
   WHERE raw_data->'recommendation'->>'topic' = 'us_debt_treasuries'
   LIMIT 1;
   ```

3. **If ceiling_detected is NULL or false:**
   - The detection didn't run
   - Check server logs for errors
   - Verify topic ID matches exactly

## Enhanced Logging

The code now logs:
- ✅ When topic is checked (first 3 items)
- ⛔ When ceiling is detected (ALL items)
- ⚠️ When no topic ID exists

Look for these in server console when running RSS update.

