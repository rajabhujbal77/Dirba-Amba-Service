import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Types matching the DB Schema (Simplified)
export type BookingStatus = 'booked' | 'loading' | 'in_transit' | 'reached_depot' | 'out_for_delivery' | 'delivered';
export type TripStatus = 'planned' | 'loading' | 'in_transit' | 'completed' | 'cancelled';

// Authentication
export const authApi = {
  async signUp(email: string, password: string, name: string, role: string, assignedDepotId?: string) {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw authError;

    // 2. Create profile
    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id, // Link to auth user
        email,
        full_name: name,
        role,
        assigned_depot_id: assignedDepotId || null,
        password // Storing for prototype compatibility
      });
      if (profileError) console.error('Error creating profile:', profileError);
    }
    return authData;
  },

  async signIn(email: string, password: string) {
    // Try authenticating with Supabase Auth first (silently)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.session) {
        // Fetch user profile to get role and assigned depot
        const profile = await this.getUserProfile(email);
        return {
          ...data,
          user: {
            ...data.user,
            role: profile?.role || 'owner',
            assigned_depot_id: profile?.assigned_depot_id || null
          }
        };
      }
    } catch (authError) {
      // Silently ignore Supabase Auth errors - will fall back to profiles table
    }

    // Fallback: Check manual profiles table (for users created without Supabase Auth)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (profileError || !profiles) throw new Error('Invalid login credentials');

    // Return mock session structure with role and assigned depot
    return {
      user: {
        id: profiles.id,
        email: profiles.email,
        role: profiles.role,
        assigned_depot_id: profiles.assigned_depot_id || null
      },
      session: { access_token: 'mock-token', user: profiles }
    };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getUserProfile(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) return null;
    return data;
  }
};

// Bookings
export const bookingsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('bookings_complete')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { bookings: data };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return { booking: data };
  },

  async create(bookingData: any) {
    try {
      // Try atomic creation first (requires migration to be applied)
      const atomicResult = await this.createAtomic(bookingData);
      if (atomicResult) {
        console.log('[BookingsAPI] Booking created atomically');
        return atomicResult;
      }
    } catch (atomicError: any) {
      // If RPC doesn't exist (404, PGRST202, or function not found), fall back silently
      const isRpcNotFound =
        atomicError.code === 'PGRST202' ||
        atomicError.code === '42883' || // PostgreSQL function not found
        atomicError.message?.includes('404') ||
        atomicError.message?.includes('not found') ||
        atomicError.message?.includes('does not exist');

      if (!isRpcNotFound) {
        console.warn('[BookingsAPI] Atomic creation failed, using fallback:', atomicError.message);
      }
    }

    // Fallback: Sequential inserts (original method)
    return this.createSequential(bookingData);
  },

  // Atomic creation using database function
  async createAtomic(bookingData: any) {
    const { data, error } = await supabase.rpc('create_booking_atomic', {
      p_booking: {
        origin_depot_id: bookingData.origin_depot_id,
        destination_depot_id: bookingData.destination_depot_id,
        payment_method: bookingData.payment_method,
        delivery_type: bookingData.delivery_type,
        delivery_charges: bookingData.delivery_charges || 0,
        sender_name: bookingData.sender_name,
        sender_phone: bookingData.sender_phone,
        subtotal: bookingData.subtotal || 0,
        total_amount: bookingData.total_amount || 0,
        status: bookingData.current_status || 'booked',
        custom_instructions: bookingData.special_instructions
      },
      p_receivers: (bookingData.receivers || []).map((r: any, i: number) => ({
        name: r.name,
        phone: r.phone,
        address: r.address || null,
        order: i + 1,
        packages: (r.packages || []).map((p: any) => ({
          packageId: p.packageId,
          size: p.size,
          quantity: p.quantity,
          price: p.price,
          description: p.description
        }))
      }))
    });

    if (error) throw error;

    return {
      booking: {
        id: data.id,
        receipt_number: data.receipt_number
      }
    };
  },

  // Sequential creation (fallback)
  async createSequential(bookingData: any) {
    try {
      // 1. Insert main booking record (receipt_number auto-generated by trigger)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          // receipt_number and id are auto-generated by trigger
          origin_depot_id: bookingData.origin_depot_id,
          destination_depot_id: bookingData.destination_depot_id,
          payment_method: bookingData.payment_method,
          delivery_type: bookingData.delivery_type,
          delivery_charges: bookingData.delivery_charges,
          sender_name: bookingData.sender_name,
          sender_phone: bookingData.sender_phone,
          subtotal: bookingData.subtotal,
          total_amount: bookingData.total_amount,
          status: bookingData.current_status || 'booked',
          custom_instructions: bookingData.special_instructions
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // 2. Insert receivers
      const receivers = bookingData.receivers || [];
      for (let i = 0; i < receivers.length; i++) {
        const receiver = receivers[i];

        const { data: receiverData, error: receiverError } = await supabase
          .from('booking_receivers')
          .insert({
            booking_id: booking.id,
            receiver_name: receiver.name,
            receiver_phone: receiver.phone,
            delivery_address: receiver.address || null,
            receiver_order: i + 1
          })
          .select()
          .single();

        if (receiverError) throw receiverError;

        // 3. Insert packages for this receiver
        const packages = receiver.packages || [];
        for (const pkg of packages) {
          // Ensure package_id is null for custom packages or invalid values
          let validPackageId = null;
          if (pkg.packageId && pkg.packageId !== 'custom' && pkg.packageId.length > 10) {
            validPackageId = pkg.packageId;
          }

          const packageData = {
            receiver_id: receiverData.id,
            package_id: validPackageId,
            package_size: pkg.size || 'Custom',
            quantity: parseInt(String(pkg.quantity)) || 1,
            price_per_unit: parseFloat(String(pkg.price)) || 0,
            description: pkg.description || null
          };

          console.log('Inserting package:', packageData);

          const { error: packageError } = await supabase
            .from('receiver_packages')
            .insert(packageData);

          if (packageError) {
            console.error('Package insert error:', packageError, 'Data:', packageData);
            throw packageError;
          }
        }
      }

      return { booking };
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { booking: data };
  },

  async updateStatus(id: string, status: string) {
    // Build update payload
    const updatePayload: any = { status };

    // If marking as delivered, also set delivered_at timestamp
    if (status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { booking: data };
  },

  /**
   * Edit a delivered receipt. Only allows editing after delivery to prevent
   * mid-transit data inconsistencies. Updates booking and related receivers/packages.
   * Credit ledger auto-syncs on next load since it aggregates from bookings.
   */
  async editDeliveredReceipt(id: string, updates: {
    sender_name?: string;
    sender_phone?: string;
    payment_method?: string;
    total_amount?: number;
    subtotal?: number;
    receivers?: any[];
  }) {
    // 1. Verify booking exists and is delivered
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, receipt_number')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existingBooking) throw new Error('Booking not found');
    if (existingBooking.status !== 'delivered') {
      throw new Error('Only delivered receipts can be edited');
    }

    // 2. Build booking update payload (only non-undefined fields)
    const bookingUpdates: any = {};
    if (updates.sender_name !== undefined) bookingUpdates.sender_name = updates.sender_name;
    if (updates.sender_phone !== undefined) bookingUpdates.sender_phone = updates.sender_phone;
    if (updates.payment_method !== undefined) bookingUpdates.payment_method = updates.payment_method;
    if (updates.total_amount !== undefined) bookingUpdates.total_amount = updates.total_amount;
    if (updates.subtotal !== undefined) bookingUpdates.subtotal = updates.subtotal;

    // 3. Update booking record
    if (Object.keys(bookingUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update(bookingUpdates)
        .eq('id', id);

      if (updateError) throw updateError;
    }

    // 4. Update receivers and packages if provided
    if (updates.receivers && updates.receivers.length > 0) {
      // Delete existing receivers (cascades to packages)
      const { error: deleteError } = await supabase
        .from('booking_receivers')
        .delete()
        .eq('booking_id', id);

      if (deleteError) {
        console.error('Error deleting old receivers:', deleteError);
        throw deleteError;
      }

      // Insert new receivers and packages
      for (let i = 0; i < updates.receivers.length; i++) {
        const receiver = updates.receivers[i];

        const { data: receiverData, error: receiverError } = await supabase
          .from('booking_receivers')
          .insert({
            booking_id: id,
            receiver_name: receiver.name,
            receiver_phone: receiver.phone,
            delivery_address: receiver.address || null,
            receiver_order: i + 1
          })
          .select()
          .single();

        if (receiverError) throw receiverError;

        // Insert packages for this receiver
        const packages = receiver.packages || [];
        for (const pkg of packages) {
          let validPackageId = null;
          if (pkg.packageId && pkg.packageId !== 'custom' && pkg.packageId.length > 10) {
            validPackageId = pkg.packageId;
          }

          const { error: packageError } = await supabase
            .from('receiver_packages')
            .insert({
              receiver_id: receiverData.id,
              package_id: validPackageId,
              package_size: pkg.size || 'Custom',
              quantity: parseInt(String(pkg.quantity)) || 1,
              price_per_unit: parseFloat(String(pkg.price_per_unit || pkg.price)) || 0,
              description: pkg.description || null
            });

          if (packageError) throw packageError;
        }
      }
    }

    // 5. Return the updated booking
    const { data: updatedBooking, error: refetchError } = await supabase
      .from('bookings_complete')
      .select('*')
      .eq('id', id)
      .single();

    if (refetchError) throw refetchError;

    console.log('[BookingsAPI] Receipt edited successfully:', existingBooking.receipt_number);
    return { booking: updatedBooking };
  },
};

// Trips
export const tripsApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Trips getAll error:', error.code, error.message, error.details, error.hint);
      throw error;
    }
    return { trips: data || [] };
  },

  async create(tripData: any, bookingIds?: string[]) {
    const id = `TR-${Date.now().toString().slice(-8)}`;

    // Build insert object with only non-null values
    // Valid status values: 'planned', 'loading', 'in_transit', 'completed', 'cancelled'
    const insertData: any = {
      id,
      driver_name: tripData.driver,
      vehicle_number: tripData.vehicle,
      status: 'in_transit'
    };

    // Add optional fields only if they have values
    if (tripData.driverPhone) insertData.driver_phone = tripData.driverPhone;
    if (tripData.tripCost) insertData.trip_cost = tripData.tripCost;
    if (tripData.originId) insertData.origin_depot_id = tripData.originId;
    if (tripData.destinationId) insertData.destination_depot_id = tripData.destinationId;
    if (tripData.departure) insertData.departure_time = tripData.departure;
    if (tripData.eta) insertData.arrival_time = tripData.eta;

    const { data, error } = await supabase
      .from('trips')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Trip creation error - Code:', error.code);
      console.error('Trip creation error - Message:', error.message);
      console.error('Trip creation error - Details:', error.details);
      console.error('Trip creation error - Hint:', error.hint);
      console.error('Trip creation error - Insert data:', JSON.stringify(insertData, null, 2));
      throw error;
    }

    // Link bookings to this trip if bookingIds provided
    if (bookingIds && bookingIds.length > 0) {
      // Use different status for forwarding trips to prevent duplicates
      const newStatus = tripData.isForwarding ? 'in_transit_forwarding' : 'in_transit';

      // Update bookings with trip_id and status
      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          trip_id: data.id,
          status: newStatus,
          current_location_depot_id: tripData.destinationId || null
        })
        .in('id', bookingIds);

      if (bookingUpdateError) {
        console.error('Error linking bookings to trip:', bookingUpdateError);
        // Don't throw - trip was created successfully
      }

      // Also populate trip_bookings junction table for querying
      const tripBookingsRows = bookingIds.map(bookingId => ({
        trip_id: data.id,
        booking_id: bookingId
      }));

      const { error: junctionError } = await supabase
        .from('trip_bookings')
        .insert(tripBookingsRows);

      if (junctionError) {
        console.error('Error inserting trip_bookings:', junctionError);
        // Don't throw - bookings are already linked via trip_id
      }
    }

    return { trip: data };
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { trip: data };
  },

  // Get all trips with their booking delivery progress
  async getAllWithProgress() {
    // Get all trips
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (tripsError) throw tripsError;
    if (!trips || trips.length === 0) return { trips: [] };

    // Get booking counts per trip
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('trip_id, status')
      .not('trip_id', 'is', null);

    if (bookingsError) {
      console.error('Error fetching booking counts:', bookingsError);
      // Return trips without progress data
      return { trips: trips.map(t => ({ ...t, total_bookings: 0, delivered_bookings: 0 })) };
    }

    // Calculate progress per trip
    const tripProgress: Record<string, { total: number; delivered: number }> = {};
    (bookings || []).forEach((b: any) => {
      if (!tripProgress[b.trip_id]) {
        tripProgress[b.trip_id] = { total: 0, delivered: 0 };
      }
      tripProgress[b.trip_id].total++;
      if (b.status === 'delivered') {
        tripProgress[b.trip_id].delivered++;
      }
    });

    // Merge progress into trips
    const tripsWithProgress = trips.map(trip => ({
      ...trip,
      total_bookings: tripProgress[trip.id]?.total || 0,
      delivered_bookings: tripProgress[trip.id]?.delivered || 0
    }));

    return { trips: tripsWithProgress };
  },

  // Get all bookings for a specific trip
  async getBookingsForTrip(tripId: string) {
    // First, try direct trip_id query
    const { data, error } = await supabase
      .from('bookings_complete')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // If we found bookings, return them
    if (data && data.length > 0) {
      return { bookings: data };
    }

    // Fallback: Check trip_bookings junction table (for forwarding trips where trip_id update may fail)
    console.log(`[getBookingsForTrip] No bookings found via trip_id, checking junction table for trip: ${tripId}`);
    const { data: junctionData, error: junctionError } = await supabase
      .from('trip_bookings')
      .select('booking_id')
      .eq('trip_id', tripId);

    if (junctionError) {
      console.error('Error fetching from trip_bookings:', junctionError);
      return { bookings: [] };
    }

    if (!junctionData || junctionData.length === 0) {
      return { bookings: [] };
    }

    // Get full booking data using the booking IDs from junction table
    const bookingIds = junctionData.map((j: any) => j.booking_id);
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings_complete')
      .select('*')
      .in('id', bookingIds)
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('Error fetching bookings by IDs:', bookingsError);
      return { bookings: [] };
    }

    return { bookings: bookingsData || [] };
  },

  /**
   * Check if all managed depot deliveries for a trip are complete and auto-mark trip as completed.
   * - Only counts bookings going to 'managed' type depots
   * - Excludes 'pickup' delivery type bookings (tracked offline, not in scope)
   * - If all qualifying bookings are delivered, marks trip as 'completed'
   */
  async checkAndAutoComplete(tripId: string) {
    try {
      // Get all bookings for this trip with their destination depot info
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          delivery_type,
          destination_depot_id,
          depots!bookings_destination_depot_id_fkey (
            id,
            type
          )
        `)
        .eq('trip_id', tripId);

      if (bookingsError) {
        console.error('Error checking trip bookings:', bookingsError);
        return { autoCompleted: false };
      }

      if (!bookings || bookings.length === 0) {
        return { autoCompleted: false };
      }

      // Filter to only managed depot deliveries (excluding pickups)
      // Pickups are tracked offline and not counted for auto-completion
      const managedDeliveries = bookings.filter((b: any) => {
        const depot = b.depots;
        const isManagedDepot = depot?.type === 'managed';
        const isNotPickup = b.delivery_type !== 'pickup';
        return isManagedDepot && isNotPickup;
      });

      // If no managed deliveries exist for this trip, nothing to auto-complete
      if (managedDeliveries.length === 0) {
        console.log(`[AutoComplete] Trip ${tripId}: No managed depot deliveries found`);
        return { autoCompleted: false };
      }

      // Check if all managed deliveries are complete
      const allDelivered = managedDeliveries.every((b: any) => b.status === 'delivered');
      const deliveredCount = managedDeliveries.filter((b: any) => b.status === 'delivered').length;

      console.log(`[AutoComplete] Trip ${tripId}: ${deliveredCount}/${managedDeliveries.length} managed deliveries complete`);

      if (allDelivered) {
        // All managed depot deliveries are complete - mark trip as completed
        const { error: updateError } = await supabase
          .from('trips')
          .update({ status: 'completed' })
          .eq('id', tripId);

        if (updateError) {
          console.error('Error auto-completing trip:', updateError);
          return { autoCompleted: false };
        }

        console.log(`[AutoComplete] Trip ${tripId} auto-completed!`);
        return { autoCompleted: true };
      }

      return { autoCompleted: false };
    } catch (error) {
      console.error('Error in checkAndAutoComplete:', error);
      return { autoCompleted: false };
    }
  },
};

// Users
export const usersApi = {
  async getAll() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    const users = data.map(u => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      assignedDepot: u.assigned_depot_id,
      status: u.status
    }));
    return { users };
  },

  async create(userData: any) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        email: userData.email,
        full_name: userData.name,
        role: userData.role,
        password: userData.password,
        assigned_depot_id: userData.assignedDepotId
      })
      .select()
      .single();
    if (error) throw error;
    return { user: data };
  },

  async update(id: string, updates: any) {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.full_name = updates.name;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.assignedDepot) dbUpdates.assigned_depot_id = updates.assignedDepot;

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select();
    if (error) throw error;
    return { user: data };
  },

  async delete(id: string) {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
};

// Depots
export const depotsApi = {
  async getAll() {
    const { data, error } = await supabase.from('depots').select('*').order('number');
    if (error) throw error;
    return { depots: data };
  },

  async getById(depotId: string) {
    try {
      const cleanDepotId = depotId.trim();

      // Fetch all depots and find the matching one
      const { depots } = await this.getAll();

      if (!depots) return null;

      // Match by id (UUID) or number (integer)
      // Depots table has: id (UUID PK), number (integer), name (text)
      const depot = depots.find((d: any) =>
        String(d.id) === cleanDepotId ||
        String(d.number) === cleanDepotId
      );

      console.log('Depot found for ID', cleanDepotId, ':', depot);
      return depot || null;
    } catch (err) {
      console.error('Error in getById:', err);
      throw err;
    }
  },

  async create(depotData: any) {
    const { data, error } = await supabase
      .from('depots')
      .insert({
        name: depotData.name,
        type: depotData.type,
        location: depotData.address,
        contact_person: depotData.contactPerson,
        contact_phone: depotData.contactPhone
      })
      .select()
      .single();
    if (error) throw error;
    return { depot: data };
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('depots')
      .update({
        name: updates.name,
        type: updates.type,
        location: updates.address,
        contact_person: updates.contactPerson,
        contact_phone: updates.contactPhone
      })
      .eq('id', id)
      .select();
    if (error) throw error;
    return { depot: data };
  },

  async delete(id: string) {
    const { error } = await supabase.from('depots').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
};

// Packages
export const packagesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const packages = data.map(p => ({
      id: p.id,
      name: p.name,
      basePrice: p.base_price,
      sortOrder: p.sort_order || 0
    }));
    return { packages };
  },

  async create(pkgData: any) {
    // Get max sort_order to append at end
    const { data: existing } = await supabase
      .from('packages')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxOrder = existing?.[0]?.sort_order || 0;

    const { data, error } = await supabase
      .from('packages')
      .insert({
        name: pkgData.name,
        base_price: pkgData.basePrice,
        sort_order: maxOrder + 1
      })
      .select()
      .single();
    if (error) throw error;
    return { package: data };
  },

  async update(id: string, updates: any) {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.basePrice !== undefined) updateData.base_price = updates.basePrice;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

    const { data, error } = await supabase
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    return { success: true };
  },

  async delete(id: string) {
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  // Swap sort order between two packages
  async swapOrder(id1: string, order1: number, id2: string, order2: number) {
    // Update both packages' sort_order
    const { error: error1 } = await supabase
      .from('packages')
      .update({ sort_order: order2 })
      .eq('id', id1);

    if (error1) throw error1;

    const { error: error2 } = await supabase
      .from('packages')
      .update({ sort_order: order1 })
      .eq('id', id2);

    if (error2) throw error2;

    return { success: true };
  }
};

// Depot Routes
export const depotRoutesApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('depot_routes')
      .select(`
      *,
      origin_depot: origin_depot_id(name),
        forwarding_depot: forwarding_depot_id(name)
          `);
    if (error) throw error;

    // Transform flat rows into grouping expected by Settings UI
    // Group rows by origin_depot_id
    const groupedMap = new Map();

    data.forEach(row => {
      if (!groupedMap.has(row.origin_depot_id)) {
        groupedMap.set(row.origin_depot_id, {
          id: row.origin_depot_id, // Use origin ID as Group ID
          originDepotId: row.origin_depot_id,
          originDepotName: row.origin_depot?.name, // Helper for debug
          forwardingDepotIds: []
        });
      }
      groupedMap.get(row.origin_depot_id).forwardingDepotIds.push(row.forwarding_depot_id);
    });

    return { routes: Array.from(groupedMap.values()) };
  },

  async getByDepotId(depotId: string) {
    const { data, error } = await supabase
      .from('depot_routes')
      .select(`
          *,
          origin_depot: origin_depot_id(name),
            forwarding_depot: forwarding_depot_id(name)
      `)
      .eq('origin_depot_id', depotId);
    if (error) throw error;

    // Return list of forwarding depot IDs for this depot
    const forwardingDepotIds = data.map(row => row.forwarding_depot_id);
    return {
      depotId,
      forwardingDepotIds,
      routes: data
    };
  },

  async create(data: any) {
    // data = { originDepotId: '...', forwardingDepotIds: ['...', '...'] }
    const inserts = data.forwardingDepotIds.map((fId: string) => ({
      origin_depot_id: data.originDepotId,
      forwarding_depot_id: fId
    }));

    if (inserts.length > 0) {
      const { error } = await supabase.from('depot_routes').insert(inserts);
      if (error) throw error;
    }
    return { success: true };
  },

  async update(id: string, data: any) {
    // id here is the originDepotId (from our grouping)

    // 1. Delete existing routes for this origin
    await supabase.from('depot_routes').delete().eq('origin_depot_id', id);

    // 2. Insert new list
    const inserts = data.forwardingDepotIds.map((fId: string) => ({
      origin_depot_id: id,
      forwarding_depot_id: fId
    }));

    if (inserts.length > 0) {
      const { error } = await supabase.from('depot_routes').insert(inserts);
      if (error) throw error;
    }
    return { success: true };
  },

  async delete(id: string) {
    // id is originDepotId
    const { error } = await supabase.from('depot_routes').delete().eq('origin_depot_id', id);
    if (error) throw error;
    return { success: true };
  }
};

// Depot Pricing (Overrides)
export const depotPricingApi = {
  async getAll() {
    // Need a table for this: depot_package_prices
    const { data, error } = await supabase.from('depot_package_prices').select('*');
    if (error) {
      // If table doesn't exist yet (migration lag), return empty
      console.warn("depot_package_prices fetch failed", error);
      return { pricing: [] };
    }

    const pricing = data.map(p => ({
      id: p.id,
      depotId: p.depot_id,
      packageId: p.package_id,
      price: p.price
    }));
    return { pricing };
  },

  async update(packageId: string, depotId: string, price: number) {
    // Upsert
    const { error } = await supabase.from('depot_package_prices').upsert({
      package_id: packageId,
      depot_id: depotId,
      price: price
    }, { onConflict: 'depot_id, package_id' });

    if (error) throw error;
  }
};

// Season (Simple Settings)
export const seasonApi = {
  async get() {
    const { data } = await supabase.from('season_settings').select('*').limit(1).maybeSingle();
    return { season: data ? { startDate: data.start_date, endDate: data.end_date, year: 2025 } : null };
  },
  async update(data: any) {
    // Upsert logic. We need a fixed ID or singleton approach
    // First check if one exists
    const { data: existing } = await supabase.from('season_settings').select('id').limit(1).maybeSingle();

    if (existing) {
      await supabase.from('season_settings').update({
        start_date: data.startDate,
        end_date: data.endDate
      }).eq('id', existing.id);
    } else {
      await supabase.from('season_settings').insert({
        start_date: data.startDate,
        end_date: data.endDate
      });
    }
  }
};

// Receipts
export const receiptsApi = {
  ...bookingsApi,
  async getNextReceiptNumber() {
    const { data, error } = await supabase.rpc('get_next_receipt_number');
    if (error) throw error;
    return { receiptNumber: data };
  }
};

// Credit Ledger - Aggregates credit bookings and advance payments
export const creditApi = {
  // Get all credit bookings (payment_method = 'credit' only) with optional depot filter
  async getCreditBookings(depotId?: string | null) {
    let query = supabase
      .from('bookings_complete')
      .select('*')
      .eq('payment_method', 'credit')
      .order('created_at', { ascending: false });

    if (depotId) {
      query = query.or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { bookings: data || [] };
  },

  // Get all advance payments
  async getPayments(customerName?: string, customerPhone?: string) {
    let query = supabase
      .from('credit_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (customerPhone) {
      query = query.eq('customer_phone', customerPhone);
    } else if (customerName) {
      query = query.eq('customer_name', customerName);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { payments: data || [] };
  },

  // Record a new advance payment
  async recordPayment(payment: {
    customer_name: string;
    customer_phone: string;
    amount: number;
    payment_method?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('credit_payments')
      .insert({
        customer_name: payment.customer_name,
        customer_phone: payment.customer_phone,
        amount: payment.amount,
        payment_method: payment.payment_method || 'cash',
        notes: payment.notes || ''
      })
      .select()
      .single();

    if (error) throw error;
    return { payment: data };
  },

  // Get credit summary aggregated by PHONE NUMBER (not name) with optional depot filter
  async getCreditSummary(depotId?: string | null) {
    // Fetch credit bookings with depot filter (only 'credit' payment method)
    let bookingsQuery = supabase
      .from('bookings_complete')
      .select('*')
      .eq('payment_method', 'credit')
      .order('created_at', { ascending: false });

    if (depotId) {
      bookingsQuery = bookingsQuery.or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`);
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) throw bookingsError;

    // Fetch all advance payments
    const { data: payments, error: paymentsError } = await supabase
      .from('credit_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    // Fetch credit customer display names (if table exists)
    const { data: creditCustomers } = await supabase
      .from('credit_customers')
      .select('phone, display_name');
    const displayNameMap = new Map((creditCustomers || []).map((c: any) => [c.phone, c.display_name]));

    // If payments table doesn't exist yet, just use empty array
    const allPayments = paymentsError ? [] : (payments || []);
    const allBookings = bookings || [];

    // Aggregate by PHONE NUMBER (not name) - this handles spelling variations
    const accountsMap = new Map<string, any>();

    // Process bookings - group by phone
    allBookings.forEach((b: any) => {
      const phone = (b.sender_phone || '').trim();
      if (!phone) return; // Skip bookings without phone

      const key = phone;
      const name = (b.sender_name || 'Unknown').trim();

      if (!accountsMap.has(key)) {
        // Use display name from credit_customers if available, otherwise use first seen name
        const displayName = displayNameMap.get(phone) || name;
        accountsMap.set(key, {
          id: phone, // Use phone as ID
          customer: displayName,
          phone: phone,
          nameVariations: new Set([name]), // Track all name spellings
          totalCredit: 0,
          advancePaid: 0,
          netOutstanding: 0,
          lastPayment: null,
          bookings: [],
          payments: [],
          bookingCount: 0,
          depots: new Set<string>(), // Track depots this customer shipped to
          packageBreakdown: new Map<string, { depot: string; depotId: string; size: string; packageId: string; quantity: number; amount: number }>()
        });
      }

      const account = accountsMap.get(key);
      const amount = Number(b.total_amount) || 0;

      // Track name variations
      account.nameVariations.add(name);

      // Track destination depot
      if (b.destination_depot_id) {
        account.depots.add(b.destination_depot_id);
      }

      // Track package breakdown for discount calculation
      if (Array.isArray(b.package_details)) {
        b.package_details.forEach((pkg: any) => {
          const pkgKey = `${b.destination_depot_id}_${pkg.package_id || pkg.size}`;
          if (!account.packageBreakdown.has(pkgKey)) {
            account.packageBreakdown.set(pkgKey, {
              depot: b.destination_depot_name || 'Unknown',
              depotId: b.destination_depot_id,
              size: pkg.size || pkg.name || 'Unknown',
              packageId: pkg.package_id || '',
              quantity: 0,
              amount: 0
            });
          }
          const breakdown = account.packageBreakdown.get(pkgKey);
          breakdown.quantity += Number(pkg.quantity) || 0;
          breakdown.amount += (Number(pkg.quantity) || 0) * (Number(pkg.price) || 0);
        });
      }

      account.totalCredit += amount;
      account.bookingCount += 1;
      account.bookings.push({
        id: b.id || b.receipt_number,
        receiptNumber: b.receipt_number,
        amount: amount,
        date: b.created_at,
        status: b.status,
        origin: b.origin_depot_name || 'N/A',
        destination: b.destination_depot_name || 'N/A',
        destinationDepotId: b.destination_depot_id,
        packages: b.package_details || []
      });
    });

    // Process payments - match by phone number
    allPayments.forEach((p: any) => {
      const phone = (p.customer_phone || '').trim();
      if (!phone) return;

      if (accountsMap.has(phone)) {
        const account = accountsMap.get(phone);
        const amount = Number(p.amount) || 0;

        account.advancePaid += amount;
        account.payments.push({
          id: p.id,
          receiptNumber: p.receipt_number,
          amount: amount,
          date: p.payment_date,
          method: p.payment_method,
          notes: p.notes
        });

        if (!account.lastPayment || new Date(p.payment_date) > new Date(account.lastPayment)) {
          account.lastPayment = p.payment_date;
        }
      }
    });

    // Calculate net outstanding and convert Sets/Maps to arrays for each account
    accountsMap.forEach((account) => {
      account.netOutstanding = Math.max(0, account.totalCredit - account.advancePaid);
      account.nameVariations = Array.from(account.nameVariations);
      account.depots = Array.from(account.depots);
      account.packageBreakdown = Array.from(account.packageBreakdown.values());
    });

    // Calculate totals
    const totalCredit = allBookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
    const totalAdvancePaid = allPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalNetOutstanding = Math.max(0, totalCredit - totalAdvancePaid);

    return {
      accounts: Array.from(accountsMap.values()),
      totalCredit,
      totalAdvancePaid,
      totalNetOutstanding
    };
  },

  // Get or create credit customer record
  async getCustomerByPhone(phone: string) {
    const { data, error } = await supabase
      .from('credit_customers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error && !error.message.includes('does not exist')) throw error;
    return { customer: data };
  },

  // Update customer display name
  async updateCustomerDisplayName(phone: string, displayName: string) {
    const { data, error } = await supabase
      .from('credit_customers')
      .upsert({
        phone: phone,
        display_name: displayName
      }, { onConflict: 'phone' })
      .select()
      .single();

    if (error) throw error;
    return { customer: data };
  },

  // Get customer-specific pricing
  async getCustomerPricing(phone: string) {
    const { data, error } = await supabase
      .from('credit_customer_pricing')
      .select('*')
      .eq('customer_phone', phone);

    if (error && !error.message.includes('does not exist')) throw error;

    return {
      pricing: (data || []).map((p: any) => ({
        packageId: p.package_id,
        depotId: p.depot_id,
        discountedPrice: p.discounted_price
      }))
    };
  },

  // Set customer-specific pricing (upsert multiple prices)
  async setCustomerPricing(phone: string, pricing: { packageId: string; depotId: string; discountedPrice: number }[]) {
    // Delete existing pricing for this customer
    await supabase
      .from('credit_customer_pricing')
      .delete()
      .eq('customer_phone', phone);

    // Insert new pricing
    if (pricing.length > 0) {
      const inserts = pricing.map(p => ({
        customer_phone: phone,
        package_id: p.packageId,
        depot_id: p.depotId,
        discounted_price: p.discountedPrice
      }));

      const { error } = await supabase
        .from('credit_customer_pricing')
        .insert(inserts);

      if (error) throw error;
    }

    return { success: true };
  },

  // Calculate discount summary for a customer
  async getDiscountSummary(phone: string) {
    // Get customer's bookings
    const { data: bookings } = await supabase
      .from('bookings_complete')
      .select('*')
      .eq('payment_method', 'credit')
      .eq('sender_phone', phone);

    // Get customer's custom pricing
    const { pricing } = await this.getCustomerPricing(phone);
    const pricingMap = new Map(pricing.map((p: any) => [`${p.packageId}_${p.depotId}`, p.discountedPrice]));

    let originalTotal = 0;
    let discountedTotal = 0;

    (bookings || []).forEach((b: any) => {
      if (Array.isArray(b.package_details)) {
        b.package_details.forEach((pkg: any) => {
          const quantity = Number(pkg.quantity) || 0;
          const originalPrice = Number(pkg.price) || 0;
          const originalAmount = quantity * originalPrice;
          originalTotal += originalAmount;

          // Check for custom pricing
          const pricingKey = `${pkg.package_id}_${b.destination_depot_id}`;
          const customPrice = pricingMap.get(pricingKey);

          if (customPrice !== undefined) {
            discountedTotal += quantity * customPrice;
          } else {
            discountedTotal += originalAmount; // No discount
          }
        });
      }
    });

    const totalSavings = originalTotal - discountedTotal;
    const savingsPercent = originalTotal > 0 ? (totalSavings / originalTotal) * 100 : 0;

    return {
      originalTotal,
      discountedTotal,
      totalSavings,
      savingsPercent: Math.round(savingsPercent * 10) / 10
    };
  }
};


// Backup & Restore API
export const backupApi = {
  // Create a full backup of all data
  async create() {
    try {
      // Fetch all tables in parallel
      const [
        bookingsRes,
        receiversRes,
        packagesRes,
        tripsRes,
        depotsRes,
        depotRoutesRes,
        depotPricesRes,
        usersRes,
        seasonRes,
        contactsRes,
        creditPaymentsRes,
        creditCustomersRes,
        creditPricingRes,
        packageSizesRes
      ] = await Promise.all([
        supabase.from('bookings').select('*'),
        supabase.from('receivers').select('*'),
        supabase.from('packages').select('*'),
        supabase.from('trips').select('*'),
        supabase.from('depots').select('*'),
        supabase.from('depot_routes').select('*'),
        supabase.from('depot_package_prices').select('*'),
        supabase.from('users').select('id, email, role, name, assigned_depot_id, created_at'),
        supabase.from('season_settings').select('*'),
        supabase.from('contacts').select('*'),
        supabase.from('credit_payments').select('*'),
        supabase.from('credit_customers').select('*'),
        supabase.from('credit_customer_pricing').select('*'),
        supabase.from('package_sizes').select('*')
      ]);

      // Also fetch the receipt counter
      const { data: counterData } = await supabase.from('receipt_counter').select('*');

      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          bookings: bookingsRes.data || [],
          receivers: receiversRes.data || [],
          packages: packagesRes.data || [],
          trips: tripsRes.data || [],
          depots: depotsRes.data || [],
          depot_routes: depotRoutesRes.data || [],
          depot_package_prices: depotPricesRes.data || [],
          users: usersRes.data || [],
          season_settings: seasonRes.data || [],
          contacts: contactsRes.data || [],
          credit_payments: creditPaymentsRes.data || [],
          credit_customers: creditCustomersRes.data || [],
          credit_customer_pricing: creditPricingRes.data || [],
          package_sizes: packageSizesRes.data || [],
          receipt_counter: counterData || []
        }
      };

      return { backup };
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  },

  // Restore data from a backup
  async restore(data: any) {
    if (!data) {
      throw new Error('No backup data provided');
    }

    try {
      // Delete existing data in reverse dependency order
      // (children first, then parents)
      await supabase.from('packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('receivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('trips').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('depot_routes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('depot_package_prices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('credit_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('credit_customers').delete().neq('phone', '');
      await supabase.from('credit_customer_pricing').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('season_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('receipt_counter').delete().neq('id', 0);

      // Note: We don't delete depots, package_sizes, or users as these are configuration
      // that should be managed separately. If you need to restore these, uncomment below:
      // await supabase.from('depots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // await supabase.from('package_sizes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Insert data in dependency order (parents first, then children)
      // Season settings
      if (data.season_settings?.length > 0) {
        await supabase.from('season_settings').insert(data.season_settings);
      }

      // Receipt counter
      if (data.receipt_counter?.length > 0) {
        await supabase.from('receipt_counter').insert(data.receipt_counter);
      }

      // Contacts
      if (data.contacts?.length > 0) {
        await supabase.from('contacts').insert(data.contacts);
      }

      // Credit customers
      if (data.credit_customers?.length > 0) {
        await supabase.from('credit_customers').insert(data.credit_customers);
      }

      // Credit customer pricing
      if (data.credit_customer_pricing?.length > 0) {
        await supabase.from('credit_customer_pricing').insert(data.credit_customer_pricing);
      }

      // Credit payments
      if (data.credit_payments?.length > 0) {
        await supabase.from('credit_payments').insert(data.credit_payments);
      }

      // Depot routes
      if (data.depot_routes?.length > 0) {
        await supabase.from('depot_routes').insert(data.depot_routes);
      }

      // Depot package prices
      if (data.depot_package_prices?.length > 0) {
        await supabase.from('depot_package_prices').insert(data.depot_package_prices);
      }

      // Trips (before bookings since bookings reference trips)
      if (data.trips?.length > 0) {
        await supabase.from('trips').insert(data.trips);
      }

      // Bookings
      if (data.bookings?.length > 0) {
        await supabase.from('bookings').insert(data.bookings);
      }

      // Receivers (after bookings)
      if (data.receivers?.length > 0) {
        await supabase.from('receivers').insert(data.receivers);
      }

      // Packages (after receivers)
      if (data.packages?.length > 0) {
        await supabase.from('packages').insert(data.packages);
      }

      return { success: true };
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  },

  // Get a preview of the backup data (counts)
  getPreview(backup: any) {
    if (!backup?.data) return null;

    const data = backup.data;
    return {
      version: backup.version,
      timestamp: backup.timestamp,
      counts: {
        bookings: data.bookings?.length || 0,
        receivers: data.receivers?.length || 0,
        packages: data.packages?.length || 0,
        trips: data.trips?.length || 0,
        depots: data.depots?.length || 0,
        users: data.users?.length || 0,
        contacts: data.contacts?.length || 0,
        credit_payments: data.credit_payments?.length || 0,
        credit_customers: data.credit_customers?.length || 0
      }
    };
  }
};

// Contacts API for autocomplete
export const contactsApi = {
  // Search contacts by name or phone
  async search(query: string, limit: number = 10) {
    if (!query || query.length < 2) return { contacts: [] };

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching contacts:', error);
      return { contacts: [] };
    }

    return { contacts: data || [] };
  },

  // Get all contacts (for initial load if needed)
  async getAll(limit: number = 50) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching contacts:', error);
      return { contacts: [] };
    }

    return { contacts: data || [] };
  },

  // Create or update a contact (upsert)
  async upsert(name: string, phone: string) {
    if (!name || !phone) return null;

    const { data, error } = await supabase
      .rpc('upsert_contact', { p_name: name, p_phone: phone });

    if (error) {
      console.error('Error upserting contact:', error);
      // Fallback to direct insert/update
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('contacts')
        .upsert(
          { name, phone, usage_count: 1, last_used_at: new Date().toISOString() },
          { onConflict: 'phone' }
        )
        .select()
        .single();

      if (fallbackError) {
        console.error('Fallback upsert failed:', fallbackError);
        return null;
      }
      return fallbackData;
    }

    return data;
  }
};

// Reports API - Analytics and aggregations
export const reportsApi = {
  // Get booking summary with optional date range and depot filter
  async getBookingSummary(fromDate?: string, toDate?: string, depotId?: string | null) {
    let query = supabase
      .from('bookings_complete')
      .select('*');

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }
    if (depotId) {
      query = query.or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const bookings = data || [];

    // Count by status
    const totalBookings = bookings.length;
    const bookedCount = bookings.filter(b => b.status === 'booked').length;
    const inTransitCount = bookings.filter(b => ['in_transit', 'in_transit_origin', 'in_transit_forwarding'].includes(b.status)).length;
    const deliveredCount = bookings.filter(b => b.status === 'delivered').length;
    const pendingCount = bookedCount + inTransitCount; // Not yet delivered

    // Revenue calculation
    const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    // Package count
    const totalPackages = bookings.reduce((sum, b) => {
      if (Array.isArray(b.package_details)) {
        return sum + b.package_details.reduce((pSum: number, pkg: any) => pSum + (Number(pkg.quantity) || 0), 0);
      }
      return sum;
    }, 0);

    // Revenue by payment method
    const revenueByMethod = {
      cash: bookings.filter(b => b.payment_method === 'cash').reduce((s, b) => s + (Number(b.total_amount) || 0), 0),
      online: bookings.filter(b => b.payment_method === 'online').reduce((s, b) => s + (Number(b.total_amount) || 0), 0),
      to_pay: bookings.filter(b => b.payment_method === 'to_pay').reduce((s, b) => s + (Number(b.total_amount) || 0), 0),
      credit: bookings.filter(b => b.payment_method === 'credit').reduce((s, b) => s + (Number(b.total_amount) || 0), 0),
    };

    return {
      totalBookings,
      bookedCount,
      inTransitCount,
      deliveredCount,
      pendingCount,
      totalRevenue,
      totalPackages,
      revenueByMethod
    };
  },

  // Get trip summary with optional depot filter
  async getTripSummary(fromDate?: string, toDate?: string, depotId?: string | null) {
    let query = supabase
      .from('trips')
      .select('*');

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }
    if (depotId) {
      query = query.or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const trips = data || [];

    const totalTrips = trips.length;
    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const activeTrips = trips.filter(t => t.status === 'active' || t.status === 'in_transit').length;
    const totalTripCost = trips.reduce((sum, t) => sum + (Number(t.trip_cost) || 0), 0);

    return {
      totalTrips,
      completedTrips,
      activeTrips,
      pendingTrips: totalTrips - completedTrips - activeTrips,
      totalTripCost
    };
  },

  // Get top customers by revenue with optional depot filter
  async getTopCustomers(limit: number = 5, fromDate?: string, toDate?: string, depotId?: string | null) {
    let query = supabase
      .from('bookings_complete')
      .select('sender_name, sender_phone, total_amount');

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }
    if (depotId) {
      query = query.or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const bookings = data || [];

    // Aggregate by sender
    const customerMap = new Map<string, { name: string; phone: string; bookings: number; revenue: number }>();

    bookings.forEach(b => {
      const key = (b.sender_name || 'Unknown').toLowerCase().trim();
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: b.sender_name || 'Unknown',
          phone: b.sender_phone || 'N/A',
          bookings: 0,
          revenue: 0
        });
      }
      const customer = customerMap.get(key)!;
      customer.bookings += 1;
      customer.revenue += Number(b.total_amount) || 0;
    });

    // Sort by revenue and take top N
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return { customers: topCustomers };
  },

  // Get top routes by revenue with optional depot filter
  async getTopRoutes(limit: number = 5, fromDate?: string, toDate?: string, depotId?: string | null) {
    let query = supabase
      .from('bookings_complete')
      .select('origin_depot_name, destination_depot_name, total_amount');

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }
    if (depotId) {
      query = query.or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const bookings = data || [];

    // Aggregate by route
    const routeMap = new Map<string, { route: string; trips: number; revenue: number }>();

    bookings.forEach(b => {
      const origin = b.origin_depot_name || 'Unknown';
      const destination = b.destination_depot_name || 'Unknown';
      const key = `${origin} → ${destination} `;

      if (!routeMap.has(key)) {
        routeMap.set(key, { route: key, trips: 0, revenue: 0 });
      }
      const route = routeMap.get(key)!;
      route.trips += 1;
      route.revenue += Number(b.total_amount) || 0;
    });

    // Sort by revenue and take top N
    const topRoutes = Array.from(routeMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return { routes: topRoutes };
  },

  // Get package collection report by origin depot
  async getOriginDepotReport(fromDate?: string, toDate?: string) {
    let query = supabase
      .from('bookings_complete')
      .select('*');

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }

    const { data, error } = await query;
    if (error) throw error;

    const bookings = data || [];

    // Aggregate by origin depot
    const depotMap = new Map<string, {
      depotId: string;
      depotName: string;
      totalPackages: number;
      totalRevenue: number;
      sizeBreakdown: Map<string, number>;
    }>();

    bookings.forEach((b: any) => {
      const depotId = b.origin_depot_id || 'unknown';
      const depotName = b.origin_depot_name || 'Unknown Depot';

      if (!depotMap.has(depotId)) {
        depotMap.set(depotId, {
          depotId,
          depotName,
          totalPackages: 0,
          totalRevenue: 0,
          sizeBreakdown: new Map()
        });
      }

      const depot = depotMap.get(depotId)!;
      depot.totalRevenue += Number(b.total_amount) || 0;

      // Process package details for count and size breakdown
      if (Array.isArray(b.package_details)) {
        b.package_details.forEach((pkg: any) => {
          const qty = Number(pkg.quantity) || 0;
          const size = pkg.size || pkg.name || 'Unknown';

          depot.totalPackages += qty;

          const currentCount = depot.sizeBreakdown.get(size) || 0;
          depot.sizeBreakdown.set(size, currentCount + qty);
        });
      }
    });

    // Convert to array and sort by total packages desc
    const depotReports = Array.from(depotMap.values())
      .map(d => ({
        depotId: d.depotId,
        depotName: d.depotName,
        totalPackages: d.totalPackages,
        totalRevenue: d.totalRevenue,
        sizeBreakdown: Object.fromEntries(d.sizeBreakdown)
      }))
      .sort((a, b) => b.totalPackages - a.totalPackages);

    // Calculate totals
    const grandTotalPackages = depotReports.reduce((sum, d) => sum + d.totalPackages, 0);
    const grandTotalRevenue = depotReports.reduce((sum, d) => sum + d.totalRevenue, 0);

    // Get all unique package sizes
    const allSizes = new Set<string>();
    depotReports.forEach(d => {
      Object.keys(d.sizeBreakdown).forEach(size => allSizes.add(size));
    });

    return {
      depots: depotReports,
      grandTotalPackages,
      grandTotalRevenue,
      allSizes: Array.from(allSizes).sort()
    };
  },

  // Get package forwarding report by destination depot
  async getForwardingDepotReport(fromDate?: string, toDate?: string) {
    let query = supabase
      .from('bookings_complete')
      .select('*');

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }

    const { data, error } = await query;
    if (error) throw error;

    const bookings = data || [];

    // Aggregate by destination depot (forwarding depot)
    const depotMap = new Map<string, {
      depotId: string;
      depotName: string;
      totalPackages: number;
      totalRevenue: number;
      sizeBreakdown: Map<string, number>;
    }>();

    bookings.forEach((b: any) => {
      const depotId = b.destination_depot_id || 'unknown';
      const depotName = b.destination_depot_name || 'Unknown Depot';

      if (!depotMap.has(depotId)) {
        depotMap.set(depotId, {
          depotId,
          depotName,
          totalPackages: 0,
          totalRevenue: 0,
          sizeBreakdown: new Map()
        });
      }

      const depot = depotMap.get(depotId)!;
      depot.totalRevenue += Number(b.total_amount) || 0;

      // Process package details for count and size breakdown
      if (Array.isArray(b.package_details)) {
        b.package_details.forEach((pkg: any) => {
          const qty = Number(pkg.quantity) || 0;
          const size = pkg.size || pkg.name || 'Unknown';

          depot.totalPackages += qty;

          const currentCount = depot.sizeBreakdown.get(size) || 0;
          depot.sizeBreakdown.set(size, currentCount + qty);
        });
      }
    });

    // Convert to array and sort by total packages desc
    const depotReports = Array.from(depotMap.values())
      .map(d => ({
        depotId: d.depotId,
        depotName: d.depotName,
        totalPackages: d.totalPackages,
        totalRevenue: d.totalRevenue,
        sizeBreakdown: Object.fromEntries(d.sizeBreakdown)
      }))
      .sort((a, b) => b.totalPackages - a.totalPackages);

    // Calculate totals
    const grandTotalPackages = depotReports.reduce((sum, d) => sum + d.totalPackages, 0);
    const grandTotalRevenue = depotReports.reduce((sum, d) => sum + d.totalRevenue, 0);

    // Get all unique package sizes
    const allSizes = new Set<string>();
    depotReports.forEach(d => {
      Object.keys(d.sizeBreakdown).forEach(size => allSizes.add(size));
    });

    return {
      depots: depotReports,
      grandTotalPackages,
      grandTotalRevenue,
      allSizes: Array.from(allSizes).sort()
    };
  }
};

// Depot Manager Reports API - Simplified reports without revenue analytics
export const depotReportsApi = {
  // Payment Report - To-Pay collections for depot
  async getPaymentReport(depotId: string, fromDate?: string, toDate?: string) {
    // Fetch all To-Pay bookings for this depot
    const { data, error } = await supabase
      .from('bookings_complete')
      .select('*')
      .eq('payment_method', 'to_pay')
      .or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter for collected payments:
    // 1. Has to_pay_collected_at (new implementation)
    // 2. OR is delivered but missing to_pay_collected_at (legacy bookings)
    let payments = (data || []).filter(p =>
      p.to_pay_collected_at != null || p.status === 'delivered'
    );

    // Apply date filtering on collection date (or delivered date for legacy)
    if (fromDate) {
      payments = payments.filter(p => {
        const dateToCheck = p.to_pay_collected_at || p.updated_at;
        return dateToCheck >= fromDate;
      });
    }
    if (toDate) {
      const toDateEnd = toDate + 'T23:59:59';
      payments = payments.filter(p => {
        const dateToCheck = p.to_pay_collected_at || p.updated_at;
        return dateToCheck <= toDateEnd;
      });
    }

    // Sort by collection date (or updated date for legacy)
    payments.sort((a, b) => {
      const dateA = new Date(a.to_pay_collected_at || a.updated_at).getTime();
      const dateB = new Date(b.to_pay_collected_at || b.updated_at).getTime();
      return dateB - dateA;
    });

    // Calculate totals by payment method
    const cashTotal = payments
      .filter(p => p.to_pay_collected_method === 'cash')
      .reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

    const onlineTotal = payments
      .filter(p => p.to_pay_collected_method === 'online')
      .reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

    return {
      payments: payments.map(p => ({
        date: p.to_pay_collected_at || p.updated_at, // Fallback to updated_at for legacy
        receipt_number: p.receipt_number,
        customer_name: p.sender_name,
        amount: Number(p.total_amount) || 0,
        payment_method: p.to_pay_collected_method || 'cash', // Default to cash for legacy
        destination: p.destination_depot_name
      })),
      summary: {
        total: cashTotal + onlineTotal,
        cash: cashTotal,
        online: onlineTotal,
        count: payments.length
      }
    };
  },

  // Delivery Report - All deliveries for depot (no revenue)
  async getDeliveryReport(depotId: string, fromDate?: string, toDate?: string) {
    let query = supabase
      .from('bookings_complete')
      .select('*')
      .or(`origin_depot_id.eq.${depotId},destination_depot_id.eq.${depotId}`)
      .neq('status', 'booked'); // Only bookings in trips

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate + 'T23:59:59');
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const bookings = data || [];

    // Calculate statistics
    const delivered = bookings.filter(b => b.status === 'delivered');
    const pending = bookings.filter(b => b.status !== 'delivered');

    // Count packages
    const totalPackages = bookings.reduce((sum, b) => {
      if (Array.isArray(b.package_details)) {
        return sum + b.package_details.reduce((pSum: number, pkg: any) =>
          pSum + (Number(pkg.quantity) || 0), 0);
      }
      return sum;
    }, 0);

    return {
      deliveries: bookings.map(b => ({
        date: b.created_at,
        receipt_number: b.receipt_number,
        customer_name: b.sender_name,
        destination: b.destination_depot_name,
        packages: Array.isArray(b.package_details)
          ? b.package_details.reduce((sum: number, pkg: any) => sum + (Number(pkg.quantity) || 0), 0)
          : 0,
        status: b.status,
        delivery_instructions: b.delivery_instructions || 'Pickup',
        delivered_at: b.status === 'delivered' ? b.updated_at : null
      })),
      summary: {
        total: bookings.length,
        delivered: delivered.length,
        pending: pending.length,
        totalPackages: totalPackages
      }
    };
  }
};