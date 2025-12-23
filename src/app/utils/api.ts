import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-9db23d94`;

// Create Supabase client for auth
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Helper function to make API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

// Authentication
export const authApi = {
  async signUp(email: string, password: string, name: string, role: string) {
    return apiCall('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
};

// Bookings
export const bookingsApi = {
  async getAll() {
    return apiCall('/bookings');
  },

  async getById(id: string) {
    return apiCall(`/bookings/${id}`);
  },

  async create(bookingData: any) {
    return apiCall('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  async update(id: string, updates: any) {
    return apiCall(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};

// Trips
export const tripsApi = {
  async getAll() {
    return apiCall('/trips');
  },

  async create(tripData: any) {
    return apiCall('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData),
    });
  },

  async update(id: string, updates: any) {
    return apiCall(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};

// Receipts
export const receiptsApi = {
  async getAll() {
    return apiCall('/receipts');
  },

  async create(receiptData: any) {
    return apiCall('/receipts', {
      method: 'POST',
      body: JSON.stringify(receiptData),
    });
  },
};

// Credit Ledger
export const creditApi = {
  async getAccounts() {
    return apiCall('/credit-accounts');
  },

  async saveAccount(accountData: any) {
    return apiCall('/credit-accounts', {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
  },

  async getTransactions(customerId?: string) {
    const query = customerId ? `?customerId=${customerId}` : '';
    return apiCall(`/transactions${query}`);
  },

  async createTransaction(transactionData: any) {
    return apiCall('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  },
};

// Settings
export const settingsApi = {
  async get() {
    return apiCall('/settings');
  },

  async update(settings: any) {
    return apiCall('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// Users
export const usersApi = {
  async getAll() {
    return apiCall('/users');
  },

  async create(userData: any) {
    return apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async update(id: string, updates: any) {
    return apiCall(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiCall(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// Depots
export const depotsApi = {
  async getAll() {
    return apiCall('/depots');
  },

  async create(depotData: any) {
    return apiCall('/depots', {
      method: 'POST',
      body: JSON.stringify(depotData),
    });
  },

  async update(id: string, updates: any) {
    return apiCall(`/depots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiCall(`/depots/${id}`, {
      method: 'DELETE',
    });
  },
};

// Depot Routes
export const depotRoutesApi = {
  async getAll() {
    return apiCall('/depot-routes');
  },

  async create(routeData: any) {
    return apiCall('/depot-routes', {
      method: 'POST',
      body: JSON.stringify(routeData),
    });
  },

  async update(id: string, updates: any) {
    return apiCall(`/depot-routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiCall(`/depot-routes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Packages
export const packagesApi = {
  async getAll() {
    return apiCall('/packages');
  },

  async create(packageData: any) {
    return apiCall('/packages', {
      method: 'POST',
      body: JSON.stringify(packageData),
    });
  },

  async update(id: string, updates: any) {
    return apiCall(`/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiCall(`/packages/${id}`, {
      method: 'DELETE',
    });
  },
};

// Depot Pricing
export const depotPricingApi = {
  async getAll() {
    return apiCall('/depot-pricing');
  },

  async update(packageId: string, depotId: string, price: number) {
    return apiCall('/depot-pricing', {
      method: 'PUT',
      body: JSON.stringify({ packageId, depotId, price }),
    });
  },
};

// Season
export const seasonApi = {
  async get() {
    return apiCall('/season');
  },

  async update(seasonData: any) {
    return apiCall('/season', {
      method: 'PUT',
      body: JSON.stringify(seasonData),
    });
  },
};

// Backup & Restore
export const backupApi = {
  async create() {
    return apiCall('/backup', {
      method: 'POST',
    });
  },

  async restore(data: any) {
    return apiCall('/restore', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  },
};