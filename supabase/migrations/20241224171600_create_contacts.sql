-- Migration: Create contacts table for autocomplete
-- Created: 2024-12-24
-- Description: Stores name/phone pairs from bookings for autocomplete suggestions

-- ============================================================================
-- 1. CREATE CONTACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(phone) -- One phone can only have one name associated
);

-- Add indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.contacts USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_usage ON public.contacts(usage_count DESC);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.contacts FOR ALL USING (true);

-- ============================================================================
-- 2. FUNCTION TO UPSERT CONTACT
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_contact(p_name TEXT, p_phone TEXT)
RETURNS UUID AS $$
DECLARE
    contact_id UUID;
BEGIN
    -- Try to insert or update existing contact
    INSERT INTO public.contacts (name, phone, usage_count, last_used_at)
    VALUES (p_name, p_phone, 1, NOW())
    ON CONFLICT (phone) DO UPDATE SET
        name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name),
        usage_count = contacts.usage_count + 1,
        last_used_at = NOW()
    RETURNING id INTO contact_id;
    
    RETURN contact_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. EXTRACT EXISTING CONTACTS FROM BOOKINGS
-- ============================================================================

-- Insert existing senders
INSERT INTO public.contacts (name, phone, usage_count, last_used_at, created_at)
SELECT 
    sender_name,
    sender_phone,
    COUNT(*) as usage_count,
    MAX(created_at) as last_used_at,
    MIN(created_at) as created_at
FROM public.bookings
WHERE sender_name IS NOT NULL 
  AND sender_phone IS NOT NULL
  AND sender_name != ''
  AND sender_phone != ''
GROUP BY sender_name, sender_phone
ON CONFLICT (phone) DO UPDATE SET
    usage_count = contacts.usage_count + EXCLUDED.usage_count,
    last_used_at = GREATEST(contacts.last_used_at, EXCLUDED.last_used_at);

-- Insert existing receivers
INSERT INTO public.contacts (name, phone, usage_count, last_used_at, created_at)
SELECT 
    receiver_name,
    receiver_phone,
    COUNT(*) as usage_count,
    MAX(created_at) as last_used_at,
    MIN(created_at) as created_at
FROM public.booking_receivers
WHERE receiver_name IS NOT NULL 
  AND receiver_phone IS NOT NULL
  AND receiver_name != ''
  AND receiver_phone != ''
GROUP BY receiver_name, receiver_phone
ON CONFLICT (phone) DO UPDATE SET
    usage_count = contacts.usage_count + EXCLUDED.usage_count,
    last_used_at = GREATEST(contacts.last_used_at, EXCLUDED.last_used_at);

-- ============================================================================
-- 4. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.contacts IS 'Stores name/phone pairs from bookings for autocomplete suggestions';
COMMENT ON COLUMN public.contacts.usage_count IS 'Number of times this contact has been used';
COMMENT ON COLUMN public.contacts.last_used_at IS 'When this contact was last used in a booking';
COMMENT ON FUNCTION upsert_contact IS 'Creates or updates a contact, incrementing usage count';
