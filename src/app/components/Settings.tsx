import React, { useState, useEffect } from 'react';
import {
  usersApi,
  depotsApi,
  depotRoutesApi,
  packagesApi,
  depotPricingApi,
  seasonApi,
  backupApi,
} from '../utils/api';

interface SettingsProps {
  userRole: 'owner' | 'booking_clerk' | 'depot_manager';
}

export default function Settings({ userRole }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('users');

  // Only allow admin (owner) to access settings
  if (userRole !== 'owner') {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-700">You don't have permission to access Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage system configuration and preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
          User Management
        </TabButton>
        <TabButton active={activeTab === 'depots'} onClick={() => setActiveTab('depots')}>
          Depots
        </TabButton>
        <TabButton active={activeTab === 'routes'} onClick={() => setActiveTab('routes')}>
          Depot Routes
        </TabButton>
        <TabButton active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')}>
          Packages & Pricing
        </TabButton>
        <TabButton active={activeTab === 'season'} onClick={() => setActiveTab('season')}>
          Season
        </TabButton>
        <TabButton active={activeTab === 'backup'} onClick={() => setActiveTab('backup')}>
          Backup & Restore
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'depots' && <DepotManagement />}
      {activeTab === 'routes' && <DepotRoutes />}
      {activeTab === 'pricing' && <PackagesPricing />}
      {activeTab === 'season' && <SeasonManagement />}
      {activeTab === 'backup' && <BackupRestore />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${active
        ? 'border-orange-500 text-orange-600'
        : 'border-transparent text-gray-600 hover:text-gray-900'
        }`}
    >
      {children}
    </button>
  );
}

// ============ User Management ============
function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [depots, setDepots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'booking_clerk' as 'booking_clerk' | 'depot_manager',
    assignedDepot: '',
    status: 'active',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, depotsRes] = await Promise.all([
        usersApi.getAll(),
        depotsApi.getAll(),
      ]);
      setUsers(usersRes.users || []);
      setDepots(depotsRes.depots || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // When editing, don't send password if it's empty
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        await usersApi.update(editingUser.id, updateData);
      } else {
        // When creating, password is required
        if (!formData.password) {
          alert('Password is required for new users');
          return;
        }
        await usersApi.create(formData);
      }
      setShowForm(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'booking_clerk', assignedDepot: '', status: 'active' });
      loadData();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Failed to save user');
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't populate password when editing
      role: user.role === 'owner' ? 'booking_clerk' : user.role, // Don't allow editing to owner
      assignedDepot: user.assignedDepot || '',
      status: user.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await usersApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-900">Users</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'booking_clerk', assignedDepot: '', status: 'active' });
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Add User
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">{editingUser ? 'Edit User' : 'New User'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required={!editingUser}
                  placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="booking_clerk">Booking Clerk</option>
                  <option value="depot_manager">Depot Manager</option>
                </select>
              </div>
              {formData.role === 'depot_manager' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Depot *</label>
                  <select
                    value={formData.assignedDepot}
                    onChange={(e) => setFormData({ ...formData, assignedDepot: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a depot</option>
                    {depots.map(depot => (
                      <option key={depot.id} value={depot.name}>{depot.number}. {depot.name} ({depot.type?.replace('_', ' ')})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                {editingUser ? 'Update' : 'Create'} User
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Depot</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">{user.name}</td>
                <td className="px-6 py-4">{user.email}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                    {user.role?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.assignedDepot
                    ? depots.find(d => d.id === user.assignedDepot)?.name || user.assignedDepot
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No users found. Click "Add User" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ Depot Management ============
function DepotManagement() {
  const [depots, setDepots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepot, setEditingDepot] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'origin' as 'origin' | 'managed' | 'direct_pickup',
    address: '',
    contactPerson: '',
    contactPhone: '',
  });

  useEffect(() => {
    loadDepots();
  }, []);

  const loadDepots = async () => {
    try {
      const response = await depotsApi.getAll();
      setDepots(response.depots || []);
    } catch (error) {
      console.error('Error loading depots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDepot) {
        await depotsApi.update(editingDepot.id, formData);
      } else {
        await depotsApi.create(formData);
      }
      setShowForm(false);
      setEditingDepot(null);
      setFormData({ name: '', type: 'origin', address: '', contactPerson: '', contactPhone: '' });
      loadDepots();
    } catch (error) {
      console.error('Error saving depot:', error);
      alert('Failed to save depot');
    }
  };

  const handleEdit = (depot: any) => {
    setEditingDepot(depot);
    setFormData({
      name: depot.name,
      type: depot.type,
      address: depot.location || '',
      contactPerson: depot.contact_person || '',
      contactPhone: depot.contact_phone || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this depot?')) return;
    try {
      await depotsApi.delete(id);
      loadDepots();
    } catch (error) {
      console.error('Error deleting depot:', error);
      alert('Failed to delete depot');
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-900">Depots</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingDepot(null);
            setFormData({ name: '', type: 'origin', address: '', contactPerson: '', contactPhone: '' });
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Add Depot
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">{editingDepot ? 'Edit Depot' : 'New Depot'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Depot Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Devgad"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="origin">Origin Depot</option>
                  <option value="managed">Managed Depot</option>
                  <option value="direct_pickup">Direct Pickup by Customer</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                {editingDepot ? 'Update' : 'Create'} Depot
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingDepot(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {depots.map((depot) => (
              <tr key={depot.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{depot.number}</td>
                <td className="px-6 py-4 font-medium">{depot.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${depot.type === 'origin' ? 'bg-purple-100 text-purple-700' :
                    depot.type === 'managed' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                    {depot.type?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {depot.contact_person && <div>{depot.contact_person}</div>}
                  {depot.contact_phone && <div className="text-gray-500">{depot.contact_phone}</div>}
                  {!depot.contact_person && !depot.contact_phone && '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(depot)}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(depot.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {depots.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No depots found. Click "Add Depot" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ Depot Routes ============
function DepotRoutes() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [depots, setDepots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [formData, setFormData] = useState({
    originDepotId: '',
    forwardingDepotIds: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [routesRes, depotsRes] = await Promise.all([
        depotRoutesApi.getAll(),
        depotsApi.getAll(),
      ]);
      setRoutes(routesRes.routes || []);
      setDepots(depotsRes.depots || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoute) {
        await depotRoutesApi.update(editingRoute.id, formData);
      } else {
        await depotRoutesApi.create(formData);
      }

      // Auto-enable forwarding for the origin depot when routes are configured
      if (formData.originDepotId && formData.forwardingDepotIds.length > 0) {
        await depotsApi.update(formData.originDepotId, { forwarding_enabled: true });
      }

      setShowForm(false);
      setEditingRoute(null);
      setFormData({ originDepotId: '', forwardingDepotIds: [] });
      loadData();
    } catch (error) {
      console.error('Error saving route:', error);
      alert('Failed to save route');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    try {
      await depotRoutesApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting route:', error);
      alert('Failed to delete route');
    }
  };

  const managedDepots = depots.filter(d => d.type === 'managed');

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Info:</strong> Depot Routes allow managed depots to forward packages to other depots.
          When configured, packages meant for forwarded depots will appear in the origin depot manager's dashboard.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-900">Depot Routes</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingRoute(null);
            setFormData({ originDepotId: '', forwardingDepotIds: [] });
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Add Route
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">{editingRoute ? 'Edit Route' : 'New Route'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origin Depot (Managed) *</label>
              <select
                value={formData.originDepotId}
                onChange={(e) => setFormData({ ...formData, originDepotId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="">Select a managed depot</option>
                {managedDepots.map(depot => (
                  <option key={depot.id} value={depot.id}>{depot.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Forwarding Depots *</label>
              <div className="border border-gray-300 rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                {depots.filter(d => d.id !== formData.originDepotId).map(depot => (
                  <label key={depot.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.forwardingDepotIds.includes(depot.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, forwardingDepotIds: [...formData.forwardingDepotIds, depot.id] });
                        } else {
                          setFormData({ ...formData, forwardingDepotIds: formData.forwardingDepotIds.filter(id => id !== depot.id) });
                        }
                      }}
                      className="w-4 h-4 text-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm">{depot.name} ({depot.type?.replace('_', ' ')})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                {editingRoute ? 'Update' : 'Create'} Route
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRoute(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {routes.map((route) => {
          const originDepot = depots.find(d => d.id === route.originDepotId);
          const forwardingDepots = depots.filter(d => route.forwardingDepotIds?.includes(d.id));

          return (
            <div key={route.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{originDepot?.name || 'Unknown'}</h3>
                  <p className="text-sm text-gray-500">Origin Depot</p>
                </div>
                <button
                  onClick={() => handleDelete(route.id)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Forwards to:</p>
                <div className="flex flex-wrap gap-2">
                  {forwardingDepots.map(depot => (
                    <span key={depot.id} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                      {depot.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {routes.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No depot routes configured. Click "Add Route" to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Packages & Pricing ============
function PackagesPricing() {
  const [packages, setPackages] = useState<any[]>([]);
  const [depots, setDepots] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [packageFormData, setPackageFormData] = useState({
    name: '',
    basePrice: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [packagesRes, depotsRes, pricingRes] = await Promise.all([
        packagesApi.getAll(),
        depotsApi.getAll(),
        depotPricingApi.getAll(),
      ]);
      setPackages(packagesRes.packages || []);
      setDepots(depotsRes.depots || []);
      setPricing(pricingRes.pricing || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        await packagesApi.update(editingPackage.id, packageFormData);
      } else {
        await packagesApi.create(packageFormData);
      }
      setShowPackageForm(false);
      setEditingPackage(null);
      setPackageFormData({ name: '', basePrice: 0 });
      loadData();
    } catch (error) {
      console.error('Error saving package:', error);
      alert('Failed to save package');
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      await packagesApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting package:', error);
      alert('Failed to delete package');
    }
  };

  const handlePriceUpdate = async (packageId: string, depotId: string, price: string) => {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) return;

    try {
      await depotPricingApi.update(packageId, depotId, priceNum);
      loadData();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price');
    }
  };

  const getDepotPrice = (packageId: string, depotId: string) => {
    const depotPrice = pricing.find(p => p.packageId === packageId && p.depotId === depotId);
    if (depotPrice) return depotPrice.price;

    const pkg = packages.find(p => p.id === packageId);
    return pkg?.basePrice || 0;
  };

  const handleMovePackage = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= packages.length) return;

    const pkg1 = packages[index];
    const pkg2 = packages[targetIndex];

    try {
      await packagesApi.swapOrder(pkg1.id, pkg1.sortOrder, pkg2.id, pkg2.sortOrder);
      loadData();
    } catch (error) {
      console.error('Error reordering packages:', error);
      alert('Failed to reorder packages');
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-900">Packages & Pricing</h2>
        <button
          onClick={() => {
            setShowPackageForm(true);
            setEditingPackage(null);
            setPackageFormData({ name: '', basePrice: 0 });
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Add Package Size
        </button>
      </div>

      {showPackageForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">{editingPackage ? 'Edit Package' : 'New Package'}</h3>
          <form onSubmit={handlePackageSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Package Size Name *</label>
                <input
                  type="text"
                  value={packageFormData.name}
                  onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 1 Dz"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base Price (₹) *</label>
                <input
                  type="number"
                  value={packageFormData.basePrice}
                  onChange={(e) => setPackageFormData({ ...packageFormData, basePrice: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 50"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                {editingPackage ? 'Update' : 'Create'} Package
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPackageForm(false);
                  setEditingPackage(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pricing Overview Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm" style={{ width: 0, minWidth: '100%' }}>
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-900">Pricing Overview</h3>
          <p className="text-sm text-gray-600 mt-1">Base prices can be overridden per depot. Use horizontal scroll to view all depots.</p>
        </div>

        <div style={{
          overflowX: 'auto',
          maxHeight: '70vh',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: 'white'
        }}>
          <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 40 }}>
              <tr className="bg-gray-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase" style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                  backgroundColor: '#f3f4f6',
                  minWidth: '70px',
                  borderRight: '2px solid #e5e7eb'
                }}>
                  Order
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase" style={{
                  position: 'sticky',
                  left: '70px',
                  zIndex: 30,
                  backgroundColor: '#f3f4f6',
                  minWidth: '180px',
                  borderRight: '2px solid #e5e7eb'
                }}>
                  Package Size
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase" style={{
                  position: 'sticky',
                  left: '250px',
                  zIndex: 30,
                  backgroundColor: '#f3f4f6',
                  minWidth: '130px',
                  borderRight: '2px solid #e5e7eb'
                }}>
                  Base Price
                </th>
                {depots.filter(depot => !['Devgad', 'Shirgaon'].includes(depot.name)).map(depot => (
                  <th key={depot.id} className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase whitespace-nowrap" style={{ minWidth: '130px' }}>
                    <div className="flex flex-col">
                      <span>{depot.name}</span>
                      <span className="text-[10px] text-gray-500 font-normal lowercase">{depot.type?.replace('_', ' ')}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase" style={{ minWidth: '130px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {packages.map((pkg, pkgIndex) => (
                <tr key={pkg.id} className="hover:bg-amber-50 transition-colors border-b border-gray-200">
                  <td className="px-4 py-4" style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 20,
                    backgroundColor: 'white',
                    minWidth: '70px',
                    borderRight: '2px solid #e5e7eb'
                  }}>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMovePackage(pkgIndex, 'up')}
                        disabled={pkgIndex === 0}
                        className={`w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-colors ${pkgIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-600'}`}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMovePackage(pkgIndex, 'down')}
                        disabled={pkgIndex === packages.length - 1}
                        className={`w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-colors ${pkgIndex === packages.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-600'}`}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900" style={{
                    position: 'sticky',
                    left: '70px',
                    zIndex: 20,
                    backgroundColor: 'white',
                    minWidth: '180px',
                    borderRight: '2px solid #e5e7eb'
                  }}>
                    {pkg.name}
                  </td>
                  <td className="px-6 py-4 font-bold text-orange-600" style={{
                    position: 'sticky',
                    left: '250px',
                    zIndex: 20,
                    backgroundColor: 'white',
                    minWidth: '130px',
                    borderRight: '2px solid #e5e7eb'
                  }}>
                    ₹{pkg.basePrice}
                  </td>
                  {depots.filter(depot => !['Devgad', 'Shirgaon'].includes(depot.name)).map(depot => {
                    const currentPrice = getDepotPrice(pkg.id, depot.id);
                    const isCustom = pricing.some(p => p.packageId === pkg.id && p.depotId === depot.id);

                    return (
                      <td key={depot.id} className="px-6 py-4 border-r border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">₹</span>
                          <input
                            type="number"
                            defaultValue={currentPrice}
                            onBlur={(e) => {
                              const newPrice = e.target.value;
                              if (newPrice && parseFloat(newPrice) !== currentPrice) {
                                handlePriceUpdate(pkg.id, depot.id, newPrice);
                              }
                            }}
                            className={`w-20 px-2 py-1 border rounded text-sm transition-all focus:ring-2 focus:ring-orange-500 focus:border-transparent ${isCustom
                              ? 'border-orange-500 bg-orange-50 text-orange-900 font-medium'
                              : 'border-gray-200 text-gray-600 bg-gray-50 hover:bg-white hover:border-gray-300'
                              }`}
                            placeholder={String(pkg.basePrice)}
                          />
                        </div>
                        {isCustom && (
                          <span className="text-[10px] text-orange-600 block mt-1 font-medium">Custom Price</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingPackage(pkg);
                          setPackageFormData({ name: pkg.name, basePrice: pkg.basePrice });
                          setShowPackageForm(true);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={depots.length + 3} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-4xl mb-4">📦</span>
                      <p className="text-lg font-medium text-gray-900">No packages found</p>
                      <p className="text-sm">Click "Add Package Size" above to create your first package.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ Season Management ============
function SeasonManagement() {
  const [season, setSeason] = useState<any>({ startDate: '', endDate: '', year: new Date().getFullYear() });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadSeason();
  }, []);

  const loadSeason = async () => {
    try {
      const response = await seasonApi.get();
      if (response.season && Object.keys(response.season).length > 0) {
        setSeason(response.season);
      }
    } catch (error) {
      console.error('Error loading season:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await seasonApi.update(season);
      await loadSeason(); // Reload to get the latest data
      setShowEditForm(false); // Hide form after successful save
      alert('Season updated successfully!');
    } catch (error) {
      console.error('Error updating season:', error);
      alert('Failed to update season');
    } finally {
      setIsSaving(false);
    }
  };

  const isSeasonActive = () => {
    if (!season.startDate || !season.endDate) {
      return false;
    }

    // Get current date without time
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Parse dates - add time component to avoid timezone issues
    const start = new Date(season.startDate + 'T00:00:00');
    const end = new Date(season.endDate + 'T23:59:59');

    // Check if dates are valid before using them
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('Invalid season dates:', { startDate: season.startDate, endDate: season.endDate });
      return false;
    }

    return now >= start && now <= end;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-6 ${isSeasonActive() ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
        }`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{isSeasonActive() ? '🥭' : '⏰'}</span>
          <h3 className="font-bold text-gray-900">
            Season Status: {isSeasonActive() ? 'Active' : 'Inactive'}
          </h3>
        </div>
        <p className="text-sm text-gray-700">
          {isSeasonActive()
            ? `The mango season is currently active. Bookings and trips can be created.${season.startDate && season.endDate ? ` Current season is from ${formatDate(season.startDate)} to ${formatDate(season.endDate)}.` : ''}`
            : `The season is currently inactive. No bookings or trips can be created outside the season dates.${season.startDate && season.endDate ? ` Season dates: ${formatDate(season.startDate)} to ${formatDate(season.endDate)}.` : ''}`}
        </p>

        {!showEditForm && (
          <button
            onClick={() => setShowEditForm(true)}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
          >
            Edit Season
          </button>
        )}
      </div>

      {showEditForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-900">Season Configuration</h2>
            <button
              onClick={() => setShowEditForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Season Year *</label>
                <input
                  type="number"
                  value={season.year}
                  onChange={(e) => setSeason({ ...season, year: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={season.startDate}
                  onChange={(e) => setSeason({ ...season, startDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                <input
                  type="date"
                  value={season.endDate}
                  onChange={(e) => setSeason({ ...season, endDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> After the end date, no new bookings or trips can be created until the next season is configured.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Update Season'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


// ============ Backup & Restore ============
function BackupRestore() {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupData, setBackupData] = useState<any>(null);
  const [backupPreview, setBackupPreview] = useState<any>(null);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const response = await backupApi.create();
      const backup = response.backup;

      // Download backup as JSON file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mango-transport-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('Backup created and downloaded successfully!');
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Failed to create backup. Check console for details.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        setBackupData(backup);

        // Generate preview
        const preview = backupApi.getPreview(backup);
        setBackupPreview(preview);
      } catch (error) {
        console.error('Error parsing backup file:', error);
        alert('Invalid backup file format');
        setBackupData(null);
        setBackupPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!backupData) {
      alert('Please select a backup file first');
      return;
    }

    if (!confirm('⚠️ WARNING: This will DELETE all current data and replace it with the backup data.\n\nAre you absolutely sure you want to proceed?')) {
      return;
    }

    // Second confirmation
    if (!confirm('Final confirmation: Type OK in the next prompt to proceed with restore.')) {
      return;
    }

    setIsRestoring(true);
    try {
      await backupApi.restore(backupData.data);
      alert('✅ Data restored successfully! The page will now refresh.');
      setBackupData(null);
      setBackupPreview(null);
      window.location.reload();
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('❌ Failed to restore backup. Check console for details.');
    } finally {
      setIsRestoring(false);
    }
  };

  const clearBackup = () => {
    setBackupData(null);
    setBackupPreview(null);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="font-bold text-gray-900">Backup & Restore</h2>

      {/* Create Backup */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-2">📥 Create Backup</h3>
            <p className="text-sm text-gray-600 mb-4">
              Download a complete backup of all system data including bookings, trips, receivers, packages, users, depots, contacts, credit data, and settings.
            </p>
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50"
            >
              {isCreatingBackup ? '⏳ Creating Backup...' : '💾 Download Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* Restore Backup */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-2">📤 Restore Backup</h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload a backup file to restore all data. <strong className="text-red-600">This will delete all current data!</strong>
          </p>

          <div className="space-y-4">
            <div>
              <label className="block">
                <span className="sr-only">Choose backup file</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:bg-orange-50 file:text-orange-700
                    hover:file:bg-orange-100
                    file:cursor-pointer cursor-pointer"
                />
              </label>
            </div>

            {/* Backup Preview */}
            {backupPreview && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-blue-900">📋 Backup Preview</p>
                    <p className="text-xs text-blue-700">
                      Version: {backupPreview.version} • Created: {new Date(backupPreview.timestamp).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={clearBackup}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    ✕ Clear
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-white rounded p-2">
                    <span className="text-gray-500">Bookings:</span>
                    <span className="font-bold text-gray-900 ml-1">{backupPreview.counts.bookings}</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="text-gray-500">Trips:</span>
                    <span className="font-bold text-gray-900 ml-1">{backupPreview.counts.trips}</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="text-gray-500">Receivers:</span>
                    <span className="font-bold text-gray-900 ml-1">{backupPreview.counts.receivers}</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="text-gray-500">Packages:</span>
                    <span className="font-bold text-gray-900 ml-1">{backupPreview.counts.packages}</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="text-gray-500">Contacts:</span>
                    <span className="font-bold text-gray-900 ml-1">{backupPreview.counts.contacts}</span>
                  </div>
                  <div className="bg-white rounded p-2">
                    <span className="text-gray-500">Credit Customers:</span>
                    <span className="font-bold text-gray-900 ml-1">{backupPreview.counts.credit_customers}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleRestore}
              disabled={isRestoring || !backupData}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
            >
              {isRestoring ? '⏳ Restoring...' : '⚠️ Restore Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">
          <strong>⚠️ Critical Warning:</strong> Restoring a backup will <strong>permanently delete</strong> all current bookings, trips, receivers, and packages, replacing them with data from the backup file.
          Always create a fresh backup before restoring!
        </p>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <strong>ℹ️ Note:</strong> Depots, Package Sizes, and User accounts are not overwritten during restore to preserve your system configuration.
        </p>
      </div>
    </div>
  );
}