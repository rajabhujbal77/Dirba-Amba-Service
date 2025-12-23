import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9db23d94/health", (c) => {
  return c.json({ status: "ok" });
});

// ============ Authentication Routes ============

// Sign up endpoint
app.post("/make-server-9db23d94/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Sign up error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.error('Sign up exception:', error);
    return c.json({ error: 'Sign up failed' }, 500);
  }
});

// ============ Booking Routes ============

// Get all bookings
app.get("/make-server-9db23d94/bookings", async (c) => {
  try {
    const bookings = await kv.getByPrefix('booking:');
    return c.json({ bookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return c.json({ error: 'Failed to fetch bookings' }, 500);
  }
});

// Create a new booking
app.post("/make-server-9db23d94/bookings", async (c) => {
  try {
    const bookingData = await c.req.json();
    const bookingId = `BK-${String(Date.now()).slice(-6)}`;
    const booking = {
      id: bookingId,
      ...bookingData,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`booking:${bookingId}`, booking);
    return c.json({ booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    return c.json({ error: 'Failed to create booking' }, 500);
  }
});

// Get a specific booking
app.get("/make-server-9db23d94/bookings/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const booking = await kv.get(`booking:${id}`);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    return c.json({ booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return c.json({ error: 'Failed to fetch booking' }, 500);
  }
});

// Update booking
app.put("/make-server-9db23d94/bookings/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`booking:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`booking:${id}`, updated);
    
    return c.json({ booking: updated });
  } catch (error) {
    console.error('Error updating booking:', error);
    return c.json({ error: 'Failed to update booking' }, 500);
  }
});

// ============ Trip Routes ============

// Get all trips
app.get("/make-server-9db23d94/trips", async (c) => {
  try {
    const trips = await kv.getByPrefix('trip:');
    return c.json({ trips });
  } catch (error) {
    console.error('Error fetching trips:', error);
    return c.json({ error: 'Failed to fetch trips' }, 500);
  }
});

// Create a new trip
app.post("/make-server-9db23d94/trips", async (c) => {
  try {
    const tripData = await c.req.json();
    const tripId = `TR-${String(Date.now()).slice(-6)}`;
    const trip = {
      id: tripId,
      ...tripData,
      status: 'loading',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`trip:${tripId}`, trip);
    return c.json({ trip });
  } catch (error) {
    console.error('Error creating trip:', error);
    return c.json({ error: 'Failed to create trip' }, 500);
  }
});

// Update trip
app.put("/make-server-9db23d94/trips/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`trip:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Trip not found' }, 404);
    }
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`trip:${id}`, updated);
    
    return c.json({ trip: updated });
  } catch (error) {
    console.error('Error updating trip:', error);
    return c.json({ error: 'Failed to update trip' }, 500);
  }
});

// ============ Receipt Routes ============

// Get all receipts
app.get("/make-server-9db23d94/receipts", async (c) => {
  try {
    const receipts = await kv.getByPrefix('receipt:');
    return c.json({ receipts });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return c.json({ error: 'Failed to fetch receipts' }, 500);
  }
});

// Create receipt
app.post("/make-server-9db23d94/receipts", async (c) => {
  try {
    const receiptData = await c.req.json();
    const receiptId = `RCT-${String(Date.now()).slice(-6)}`;
    const receipt = {
      id: receiptId,
      ...receiptData,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`receipt:${receiptId}`, receipt);
    return c.json({ receipt });
  } catch (error) {
    console.error('Error creating receipt:', error);
    return c.json({ error: 'Failed to create receipt' }, 500);
  }
});

// ============ Credit Ledger Routes ============

// Get all credit accounts
app.get("/make-server-9db23d94/credit-accounts", async (c) => {
  try {
    const accounts = await kv.getByPrefix('credit:');
    return c.json({ accounts });
  } catch (error) {
    console.error('Error fetching credit accounts:', error);
    return c.json({ error: 'Failed to fetch credit accounts' }, 500);
  }
});

// Create or update credit account
app.post("/make-server-9db23d94/credit-accounts", async (c) => {
  try {
    const accountData = await c.req.json();
    const accountId = accountData.id || `CA-${String(Date.now()).slice(-6)}`;
    const account = {
      id: accountId,
      ...accountData,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`credit:${accountId}`, account);
    return c.json({ account });
  } catch (error) {
    console.error('Error saving credit account:', error);
    return c.json({ error: 'Failed to save credit account' }, 500);
  }
});

// Get transactions
app.get("/make-server-9db23d94/transactions", async (c) => {
  try {
    const customerId = c.req.query('customerId');
    let transactions;
    
    if (customerId) {
      transactions = await kv.getByPrefix(`transaction:${customerId}:`);
    } else {
      transactions = await kv.getByPrefix('transaction:');
    }
    
    return c.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return c.json({ error: 'Failed to fetch transactions' }, 500);
  }
});

// Create transaction
app.post("/make-server-9db23d94/transactions", async (c) => {
  try {
    const txnData = await c.req.json();
    const txnId = `TXN-${String(Date.now()).slice(-6)}`;
    const transaction = {
      id: txnId,
      ...txnData,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`transaction:${txnData.customerId}:${txnId}`, transaction);
    return c.json({ transaction });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return c.json({ error: 'Failed to create transaction' }, 500);
  }
});

// ============ Settings Routes ============

// Get settings
app.get("/make-server-9db23d94/settings", async (c) => {
  try {
    const settings = await kv.get('settings:company') || {};
    return c.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// Update settings
app.put("/make-server-9db23d94/settings", async (c) => {
  try {
    const settings = await c.req.json();
    await kv.set('settings:company', settings);
    return c.json({ settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// ============ User Management Routes ============

// Get all users
app.get("/make-server-9db23d94/users", async (c) => {
  try {
    const users = await kv.getByPrefix('user:');
    return c.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Create user
app.post("/make-server-9db23d94/users", async (c) => {
  try {
    const userData = await c.req.json();
    const userId = `USER-${String(Date.now()).slice(-6)}`;
    
    // If password is provided, create auth user
    if (userData.password && userData.email) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        user_metadata: { 
          name: userData.name,
          role: userData.role,
          assignedDepot: userData.assignedDepot || null,
        },
        email_confirm: true // Auto-confirm since email server isn't configured
      });

      if (authError) {
        console.error('Auth error creating user:', authError);
        return c.json({ error: authError.message }, 400);
      }
    }
    
    const user = {
      id: userId,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      assignedDepot: userData.assignedDepot || null,
      status: userData.status || 'active',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`user:${userId}`, user);
    return c.json({ user });
  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Update user
app.put("/make-server-9db23d94/users/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`user:${id}`);
    
    if (!existing) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // If password update is requested, update auth user
    if (updates.password && existing.email) {
      // Find the auth user by email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && users) {
        const authUser = users.find((u: any) => u.email === existing.email);
        if (authUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            authUser.id,
            { password: updates.password }
          );
          
          if (updateError) {
            console.error('Error updating auth password:', updateError);
          }
        }
      }
    }
    
    // Remove password from stored data
    const { password, ...dataToStore } = updates;
    
    const updated = { 
      ...existing, 
      ...dataToStore, 
      updatedAt: new Date().toISOString() 
    };
    await kv.set(`user:${id}`, updated);
    
    return c.json({ user: updated });
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Delete user
app.delete("/make-server-9db23d94/users/:id", async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`user:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// ============ Depot Management Routes ============

// Get all depots
app.get("/make-server-9db23d94/depots", async (c) => {
  try {
    const depots = await kv.getByPrefix('depot:');
    return c.json({ depots });
  } catch (error) {
    console.error('Error fetching depots:', error);
    return c.json({ error: 'Failed to fetch depots' }, 500);
  }
});

// Create depot
app.post("/make-server-9db23d94/depots", async (c) => {
  try {
    const depotData = await c.req.json();
    // Get current depot count for auto-numbering
    const allDepots = await kv.getByPrefix('depot:');
    const depotNumber = allDepots.length + 1;
    const depotId = `DEPOT-${String(depotNumber).padStart(3, '0')}`;
    
    const depot = {
      id: depotId,
      number: depotNumber,
      ...depotData,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`depot:${depotId}`, depot);
    return c.json({ depot });
  } catch (error) {
    console.error('Error creating depot:', error);
    return c.json({ error: 'Failed to create depot' }, 500);
  }
});

// Update depot
app.put("/make-server-9db23d94/depots/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`depot:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Depot not found' }, 404);
    }
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`depot:${id}`, updated);
    
    return c.json({ depot: updated });
  } catch (error) {
    console.error('Error updating depot:', error);
    return c.json({ error: 'Failed to update depot' }, 500);
  }
});

// Delete depot
app.delete("/make-server-9db23d94/depots/:id", async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`depot:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting depot:', error);
    return c.json({ error: 'Failed to delete depot' }, 500);
  }
});

// ============ Depot Routes Management ============

// Get all depot routes
app.get("/make-server-9db23d94/depot-routes", async (c) => {
  try {
    const routes = await kv.getByPrefix('route:');
    return c.json({ routes });
  } catch (error) {
    console.error('Error fetching routes:', error);
    return c.json({ error: 'Failed to fetch routes' }, 500);
  }
});

// Create depot route
app.post("/make-server-9db23d94/depot-routes", async (c) => {
  try {
    const routeData = await c.req.json();
    const routeId = `ROUTE-${String(Date.now()).slice(-6)}`;
    const route = {
      id: routeId,
      ...routeData,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`route:${routeId}`, route);
    return c.json({ route });
  } catch (error) {
    console.error('Error creating route:', error);
    return c.json({ error: 'Failed to create route' }, 500);
  }
});

// Update depot route
app.put("/make-server-9db23d94/depot-routes/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`route:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Route not found' }, 404);
    }
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`route:${id}`, updated);
    
    return c.json({ route: updated });
  } catch (error) {
    console.error('Error updating route:', error);
    return c.json({ error: 'Failed to update route' }, 500);
  }
});

// Delete depot route
app.delete("/make-server-9db23d94/depot-routes/:id", async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`route:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting route:', error);
    return c.json({ error: 'Failed to delete route' }, 500);
  }
});

// ============ Package & Pricing Management ============

// Get all packages
app.get("/make-server-9db23d94/packages", async (c) => {
  try {
    const packages = await kv.getByPrefix('package:');
    return c.json({ packages });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return c.json({ error: 'Failed to fetch packages' }, 500);
  }
});

// Create package
app.post("/make-server-9db23d94/packages", async (c) => {
  try {
    const packageData = await c.req.json();
    const packageId = `PKG-${String(Date.now()).slice(-6)}`;
    const pkg = {
      id: packageId,
      ...packageData,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`package:${packageId}`, pkg);
    return c.json({ package: pkg });
  } catch (error) {
    console.error('Error creating package:', error);
    return c.json({ error: 'Failed to create package' }, 500);
  }
});

// Update package
app.put("/make-server-9db23d94/packages/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`package:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Package not found' }, 404);
    }
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await kv.set(`package:${id}`, updated);
    
    return c.json({ package: updated });
  } catch (error) {
    console.error('Error updating package:', error);
    return c.json({ error: 'Failed to update package' }, 500);
  }
});

// Delete package
app.delete("/make-server-9db23d94/packages/:id", async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`package:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting package:', error);
    return c.json({ error: 'Failed to delete package' }, 500);
  }
});

// Get depot pricing
app.get("/make-server-9db23d94/depot-pricing", async (c) => {
  try {
    const pricing = await kv.getByPrefix('pricing:');
    return c.json({ pricing });
  } catch (error) {
    console.error('Error fetching depot pricing:', error);
    return c.json({ error: 'Failed to fetch depot pricing' }, 500);
  }
});

// Update depot pricing
app.put("/make-server-9db23d94/depot-pricing", async (c) => {
  try {
    const { packageId, depotId, price } = await c.req.json();
    const pricingKey = `pricing:${packageId}:${depotId}`;
    await kv.set(pricingKey, { packageId, depotId, price, updatedAt: new Date().toISOString() });
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating depot pricing:', error);
    return c.json({ error: 'Failed to update depot pricing' }, 500);
  }
});

// ============ Season Management ============

// Get season settings
app.get("/make-server-9db23d94/season", async (c) => {
  try {
    const season = await kv.get('season:current') || {};
    return c.json({ season });
  } catch (error) {
    console.error('Error fetching season:', error);
    return c.json({ error: 'Failed to fetch season' }, 500);
  }
});

// Update season
app.put("/make-server-9db23d94/season", async (c) => {
  try {
    const seasonData = await c.req.json();
    await kv.set('season:current', { ...seasonData, updatedAt: new Date().toISOString() });
    return c.json({ season: seasonData });
  } catch (error) {
    console.error('Error updating season:', error);
    return c.json({ error: 'Failed to update season' }, 500);
  }
});

// ============ Initialization Route ============

// Initialize system with default admin user, depots, and packages
app.post("/make-server-9db23d94/initialize", async (c) => {
  try {
    // Check if already initialized
    const existingUsers = await kv.getByPrefix('user:');
    const existingDepots = await kv.getByPrefix('depot:');
    const existingPackages = await kv.getByPrefix('package:');
    
    let initialized = {
      admin: false,
      depots: false,
      packages: false
    };

    // Create default admin user if no users exist
    if (!existingUsers || existingUsers.length === 0) {
      const adminEmail = 'admin@mangoexpress.com';
      const adminPassword = 'admin123';
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        user_metadata: { 
          name: 'Admin User',
          role: 'owner',
        },
        email_confirm: true
      });

      if (authError) {
        console.error('Error creating admin auth user:', authError);
      } else {
        // Create user record in KV store
        const userId = `USER-${String(Date.now()).slice(-6)}`;
        await kv.set(`user:${userId}`, {
          id: userId,
          name: 'Admin User',
          email: adminEmail,
          role: 'owner',
          status: 'active',
          createdAt: new Date().toISOString()
        });
        initialized.admin = true;
      }
    }

    // Create default depots if none exist
    if (!existingDepots || existingDepots.length === 0) {
      const defaultDepots = [
        { name: 'Devgad', type: 'origin' },
        { name: 'Shirgaon', type: 'origin' },
        { name: 'Akurdi', type: 'managed' },
        { name: 'Bhusari Colony', type: 'managed' },
        { name: 'Sadashiv Peth', type: 'managed' },
        { name: 'Kolhapur', type: 'direct_pickup' },
        { name: 'Karad', type: 'direct_pickup' },
        { name: 'Satara', type: 'direct_pickup' },
        { name: 'Katraj', type: 'direct_pickup' },
        { name: 'Navale Bridge', type: 'direct_pickup' },
        { name: 'Market Yard', type: 'direct_pickup' },
        { name: 'Bhopal', type: 'direct_pickup' },
        { name: 'Nagpur', type: 'direct_pickup' },
        { name: 'Ahilya Nagar', type: 'direct_pickup' },
      ];

      for (let i = 0; i < defaultDepots.length; i++) {
        const depotNumber = i + 1;
        const depotId = `DEPOT-${String(depotNumber).padStart(3, '0')}`;
        await kv.set(`depot:${depotId}`, {
          id: depotId,
          number: depotNumber,
          ...defaultDepots[i],
          createdAt: new Date().toISOString()
        });
      }
      initialized.depots = true;
    }

    // Create default packages if none exist
    if (!existingPackages || existingPackages.length === 0) {
      const defaultPackages = [
        { name: '1 Dz', basePrice: 50 },
        { name: '2 Dz', basePrice: 100 },
        { name: '5 Dz Puttha', basePrice: 200 },
        { name: '5 Dz (Pinjara)', basePrice: 200 },
        { name: 'Crate Big', basePrice: 250 },
        { name: 'Crate Small', basePrice: 125 },
        { name: 'Half Lakadi', basePrice: 100 },
      ];

      for (const pkg of defaultPackages) {
        const packageId = `PKG-${String(Date.now()).slice(-6)}-${Math.random().toString(36).substr(2, 4)}`;
        await kv.set(`package:${packageId}`, {
          id: packageId,
          ...pkg,
          createdAt: new Date().toISOString()
        });
        // Small delay to ensure unique IDs
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      initialized.packages = true;
    }

    return c.json({ 
      success: true, 
      message: 'System initialized successfully',
      initialized,
      credentials: initialized.admin ? {
        email: 'admin@mangoexpress.com',
        password: 'admin123'
      } : null
    });
  } catch (error) {
    console.error('Error initializing system:', error);
    return c.json({ error: 'Failed to initialize system' }, 500);
  }
});

// ============ Backup & Restore Routes ============

// Create backup
app.post("/make-server-9db23d94/backup", async (c) => {
  try {
    // Get all data
    const bookings = await kv.getByPrefix('booking:');
    const trips = await kv.getByPrefix('trip:');
    const receipts = await kv.getByPrefix('receipt:');
    const creditAccounts = await kv.getByPrefix('credit:');
    const transactions = await kv.getByPrefix('transaction:');
    const users = await kv.getByPrefix('user:');
    const depots = await kv.getByPrefix('depot:');
    const routes = await kv.getByPrefix('route:');
    const packages = await kv.getByPrefix('package:');
    const pricing = await kv.getByPrefix('pricing:');
    const season = await kv.get('season:current');
    const settings = await kv.get('settings:company');
    
    const backup = {
      timestamp: new Date().toISOString(),
      data: {
        bookings,
        trips,
        receipts,
        creditAccounts,
        transactions,
        users,
        depots,
        routes,
        packages,
        pricing,
        season,
        settings
      }
    };
    
    return c.json({ backup });
  } catch (error) {
    console.error('Error creating backup:', error);
    return c.json({ error: 'Failed to create backup' }, 500);
  }
});

// Restore from backup
app.post("/make-server-9db23d94/restore", async (c) => {
  try {
    const { data } = await c.req.json();
    
    // Restore all data
    for (const booking of data.bookings || []) {
      await kv.set(`booking:${booking.id}`, booking);
    }
    for (const trip of data.trips || []) {
      await kv.set(`trip:${trip.id}`, trip);
    }
    for (const receipt of data.receipts || []) {
      await kv.set(`receipt:${receipt.id}`, receipt);
    }
    for (const account of data.creditAccounts || []) {
      await kv.set(`credit:${account.id}`, account);
    }
    for (const transaction of data.transactions || []) {
      await kv.set(`transaction:${transaction.customerId}:${transaction.id}`, transaction);
    }
    for (const user of data.users || []) {
      await kv.set(`user:${user.id}`, user);
    }
    for (const depot of data.depots || []) {
      await kv.set(`depot:${depot.id}`, depot);
    }
    for (const route of data.routes || []) {
      await kv.set(`route:${route.id}`, route);
    }
    for (const pkg of data.packages || []) {
      await kv.set(`package:${pkg.id}`, pkg);
    }
    for (const price of data.pricing || []) {
      await kv.set(`pricing:${price.packageId}:${price.depotId}`, price);
    }
    if (data.season) {
      await kv.set('season:current', data.season);
    }
    if (data.settings) {
      await kv.set('settings:company', data.settings);
    }
    
    return c.json({ success: true, message: 'Data restored successfully' });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return c.json({ error: 'Failed to restore backup' }, 500);
  }
});

Deno.serve(app.fetch);