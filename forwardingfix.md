# Forwarding Trip Bug Fixes

**Date:** 2026-01-15  
**Issue:** Depot manager forwarding trip bugs

---

## Summary of Bugs Fixed

1. **Receipts still visible after forwarding trip creation**
2. **Driver's memo blank for forwarding trips**
3. **Revenue incorrectly showing for depot managers**

---

## Files Changed

### 1. `src/app/components/TripCreation.tsx`

**Change 1:** Added `trip_id` to Booking interface (line 21)
```diff
+  trip_id?: string;
```

**Change 2:** Updated filter comments (lines 119-128)
```diff
-        // AND not already assigned to a forwarding trip (trip_id is null)
+        // AND not already added to a forwarding trip (status != 'in_transit_forwarding')
+        // Note: These bookings already have trip_id from origin trip, so we check status instead
         const forwardingBookings = (bookingsRes.bookings || []).filter((b: Booking) =>
           ['in_transit', 'reached_depot'].includes(b.status) &&
-          destinationIds.includes(b.destination_depot_id) &&
-          !b.trip_id
+          destinationIds.includes(b.destination_depot_id)
+          // Note: status check already excludes 'in_transit_forwarding'
         );
```

---

### 2. `src/app/components/TripsDeliveries.tsx`

**Change 1:** Updated bookings filter to include forwarding destinations (lines 99-110)
```diff
-      // Depot managers Deliveries tab: Only show bookings where THIS depot is the final destination
-      // NOT bookings passing through for forwarding
+      // Depot managers Deliveries tab: Show bookings where:
+      // 1. This depot is the final destination OR origin
+      // 2. OR bookings destined for forwarding destinations (for trips they created)
+      // This ensures driver's memo can access all bookings for forwarding trips
       const filteredBookings = userRole === 'depot_manager' && assignedDepotId
         ? allBookings.filter((b: any) =>
           (b.destination_depot_id === assignedDepotId ||
-            b.origin_depot_id === assignedDepotId) &&
+            b.origin_depot_id === assignedDepotId ||
+            forwardingDestinationIds.includes(b.destination_depot_id)) &&
           b.status !== 'booked'
         )
         : allBookings;
```

**Change 2:** Hide Revenue for depot managers (lines 556-567)
```diff
-                  <div>
-                    <p className="text-xs text-gray-500 mb-1">Revenue</p>
-                    <p className="text-sm font-medium text-green-600">
-                      ₹{bookings
-                        .filter(b => b.status === 'in_transit' || b.status === 'delivered')
-                        .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
-                        .toLocaleString('en-IN')}
-                    </p>
-                  </div>
+                  {/* Only show Revenue for owners/admins - depot managers don't generate revenue */}
+                  {userRole === 'owner' && (
+                    <div>
+                      <p className="text-xs text-gray-500 mb-1">Revenue</p>
+                      <p className="text-sm font-medium text-green-600">
+                        ₹{bookings
+                          .filter(b => b.trip_id === trip.id)
+                          .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
+                          .toLocaleString('en-IN')}
+                      </p>
+                    </div>
+                  )}
```

**Change 3:** Updated downloadDriverMemo to fetch bookings from API (lines 268-289)
```diff
-    // Get bookings for THIS trip, sorted by destination depot order number
-    // Create depot order map: depot name -> order number (index + 1)
+    // Get bookings for THIS trip directly from API to ensure we get all bookings
+    // (local state may be filtered for depot managers and miss forwarding trip bookings)
     const depotOrderMap: Record<string, number> = {};
     depots.forEach((depot, index) => {
       depotOrderMap[depot.name] = index + 1;
     });

-    const tripBookings = bookings
-      .filter(b => b.trip_id === trip.id)
-      .sort((a, b) => { ... });
+    let tripBookingsData: Booking[] = [];
+    try {
+      const res = await tripsApi.getBookingsForTrip(trip.id);
+      tripBookingsData = res.bookings || [];
+    } catch (err) {
+      console.error('Error fetching trip bookings for memo:', err);
+      tripBookingsData = bookings.filter(b => b.trip_id === trip.id);
+    }
+
+    const tripBookings = tripBookingsData.sort((a: any, b: any) => { ... });
```

---

### 3. `src/app/utils/api.ts`

**Change:** Enhanced `getBookingsForTrip` to use junction table fallback (lines 564-607)
```diff
   async getBookingsForTrip(tripId: string) {
+    // First, try direct trip_id query
     const { data, error } = await supabase
       .from('bookings_complete')
       .select('*')
       .eq('trip_id', tripId)
       .order('created_at', { ascending: false });

     if (error) throw error;
-    return { bookings: data || [] };
+    
+    // If we found bookings, return them
+    if (data && data.length > 0) {
+      return { bookings: data };
+    }
+    
+    // Fallback: Check trip_bookings junction table
+    console.log(`[getBookingsForTrip] No bookings found via trip_id, checking junction table`);
+    const { data: junctionData, error: junctionError } = await supabase
+      .from('trip_bookings')
+      .select('booking_id')
+      .eq('trip_id', tripId);
+    
+    if (junctionError || !junctionData?.length) {
+      return { bookings: [] };
+    }
+    
+    // Get full booking data using the booking IDs
+    const bookingIds = junctionData.map((j: any) => j.booking_id);
+    const { data: bookingsData } = await supabase
+      .from('bookings_complete')
+      .select('*')
+      .in('id', bookingIds)
+      .order('created_at', { ascending: false });
+    
+    return { bookings: bookingsData || [] };
   },
```

---

## Git Commit Message (suggested)

```
fix: forwarding trip bugs for depot managers

- Hide receipts after forwarding trip creation (status-based filter)
- Fix driver's memo to fetch bookings via junction table fallback
- Hide Revenue section for depot managers (no revenue generation)
- Fix Revenue calculation to use trip-specific bookings for owners
```

---

## Fix Update (2026-01-22)

**Issue:** Receipts still visible after creating forwarding trips (original fix incomplete)

### Root Cause Analysis

1. **RLS Policy Blocking Status Update:** Depot managers couldn't update bookings from other depots, so status wasn't changing to `'in_transit_forwarding'`
2. **Junction Table Not Populated:** The `trip_bookings` insert was blocked by overly aggressive duplicate prevention
3. **Duplicate Prevention Bug:** Checking ALL `trip_bookings` entries, not just forwarding trips from the same depot

### Additional Changes Made

#### 1. `src/app/components/TripCreation.tsx` (lines 118-136)

Added fallback filter using junction table:
```diff
+        // Fetch booking IDs already in forwarding trips from this depot
+        const alreadyForwardedRes = await tripsApi.getBookingIdsInForwardingTrips(assignedDepotId);
+        const alreadyForwardedSet = new Set(alreadyForwardedRes.bookingIds || []);
+
         const forwardingBookings = (bookingsRes.bookings || []).filter((b: Booking) =>
           ['in_transit', 'reached_depot'].includes(b.status) &&
-          destinationIds.includes(b.destination_depot_id)
+          destinationIds.includes(b.destination_depot_id) &&
+          !alreadyForwardedSet.has(b.id)
         );
```

#### 2. `src/app/utils/api.ts` - New function `getBookingIdsInForwardingTrips`

```typescript
async getBookingIdsInForwardingTrips(depotId: string) {
  // Get all forwarding trips from this depot
  const { data: forwardingTrips } = await supabase
    .from('trips')
    .select('id')
    .eq('origin_depot_id', depotId);

  if (!forwardingTrips?.length) return { bookingIds: [] };

  // Get all booking IDs in these forwarding trips from junction table
  const { data: junctionData } = await supabase
    .from('trip_bookings')
    .select('booking_id')
    .in('trip_id', forwardingTrips.map(t => t.id));

  return { bookingIds: junctionData?.map(j => j.booking_id) || [] };
}
```

#### 3. `src/app/utils/api.ts` - Fixed duplicate prevention in `tripsApi.create`

```diff
-      // First, check for existing entries to prevent duplicates
-      const { data: existingEntries } = await supabase
-        .from('trip_bookings')
-        .select('booking_id')
-        .in('booking_id', bookingIds);
+      // For forwarding trips: only check duplicates within forwarding trips from this depot
+      // (bookings can legitimately be in both original trip AND forwarding trip)
+      if (tripData.isForwarding && tripData.originId) {
+        // Get all forwarding trips from this depot
+        const { data: forwardingTrips } = await supabase
+          .from('trips')
+          .select('id')
+          .eq('origin_depot_id', tripData.originId);
+
+        // Check which bookings are already in forwarding trips from this depot
+        const { data: existingEntries } = await supabase
+          .from('trip_bookings')
+          .select('booking_id')
+          .in('trip_id', forwardingTripIds)
+          .in('booking_id', bookingIds);
+        // ... skip only those already in forwarding trips
+      }
```

---

## DB Verification Queries

```sql
-- Check trip_bookings entries for forwarding trips
SELECT tb.trip_id, tb.booking_id, t.trip_number, b.status
FROM trip_bookings tb
JOIN trips t ON t.id = tb.trip_id
JOIN bookings b ON b.id = tb.booking_id
WHERE t.origin_depot_id = '8e71e999-ae68-4c0e-bd12-fdeb5170b585'
ORDER BY t.created_at DESC;

-- Verify no duplicates exist within forwarding trips
SELECT booking_id, COUNT(*) as count
FROM trip_bookings tb
JOIN trips t ON t.id = tb.trip_id
WHERE t.origin_depot_id = '8e71e999-ae68-4c0e-bd12-fdeb5170b585'
GROUP BY booking_id
HAVING COUNT(*) > 1;
```

---

## Testing Notes

- Login as depot manager with forwarding routes (e.g., sadashiv@mango.com)
- Create a new forwarding trip
- Verify receipts disappear after trip creation
- Verify driver's memo contains booking details
- Verify Revenue is hidden for depot manager view

