-- Add sort_order column to packages table for controlling display order
-- Run this in Supabase SQL Editor

-- Step 1: Add the sort_order column
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Step 2: Initialize sort_order values based on current row order
-- This assigns 1, 2, 3, etc. to existing packages
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, name) as rn
  FROM packages
)
UPDATE packages p
SET sort_order = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Step 3: Verify the results
SELECT id, name, sort_order FROM packages ORDER BY sort_order;
