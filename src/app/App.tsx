import React, { useState, useEffect } from 'react';
import { depotsApi } from './utils/api';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NewBooking from './components/NewBooking';
import TripCreation from './components/TripCreation';
import TripsDeliveries from './components/TripsDeliveries';
import Reports from './components/Reports';
import DepotReports from './components/DepotReports';
import AllReceipts from './components/AllReceipts';
import CreditLedger from './components/CreditLedger';
import Settings from './components/Settings';
import OfflineIndicator from './components/OfflineIndicator';
import ConflictResolver from './components/ConflictResolver';
import { startSyncEngine, stopSyncEngine } from './utils/syncEngine';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [assignedDepotId, setAssignedDepotId] = useState<string | null>(null);
  const [depotInfo, setDepotInfo] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize sync engine on mount
  useEffect(() => {
    startSyncEngine();
    return () => {
      stopSyncEngine();
    };
  }, []);

  // Close sidebar on page change (for mobile)
  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    setSidebarOpen(false); // Auto-close sidebar on navigation
  };

  const handleLogin = async (role: string, id: string, depotId?: string | null) => {
    setIsLoggedIn(true);
    setUserRole(role);
    setUserId(id);
    setAssignedDepotId(depotId || null);

    console.log('handleLogin called:', { role, id, depotId }); // Debug log

    // Fetch depot info for depot managers
    if (role === 'depot_manager' && depotId) {
      console.log('Fetching depot info for:', depotId); // Debug log
      try {
        const info = await depotsApi.getById(depotId);
        console.log('Depot info fetched:', info); // Debug log
        setDepotInfo(info);
      } catch (error) {
        console.error('Error fetching depot info:', error);
      }
    }
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
    setSidebarOpen(false);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline Status Indicator */}
      <OfflineIndicator />
      {/* Conflict Resolution Modal */}
      <ConflictResolver />

      {/* Mobile Header with Hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center overflow-hidden">
            <img src="/logo.webp" alt="Logo" className="w-full h-full object-contain p-0.5" />
          </div>
          <span className="font-bold text-gray-900">Mango Express</span>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar - Hidden on mobile, shown as overlay when open */}
        <aside className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-64 bg-white border-r border-gray-200 min-h-screen
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-6">
            {/* Close button for mobile */}
            <div className="lg:hidden flex justify-end mb-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/logo.webp" alt="Mango Express Logo" className="w-full h-full object-contain p-1" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Mango Express</h1>
                <p className="text-sm text-gray-500 capitalize">{userRole?.replace('_', ' ')}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {/* Dashboard - Available to all */}
              <NavItem
                icon="📊"
                label="Dashboard"
                active={currentPage === 'dashboard'}
                onClick={() => handlePageChange('dashboard')}
              />

              {/* Booking Clerk & Admin have access */}
              {(userRole === 'owner' || userRole === 'booking_clerk') && (
                <NavItem
                  icon="📝"
                  label="New Booking"
                  active={currentPage === 'new_booking'}
                  onClick={() => handlePageChange('new_booking')}
                />
              )}

              {/* Booking Clerk & Admin + Forwarding Depot Managers */}
              {(userRole === 'owner' || userRole === 'booking_clerk' ||
                (userRole === 'depot_manager' && depotInfo?.forwarding_enabled)) && (
                  <NavItem
                    icon="🚚"
                    label={depotInfo?.forwarding_enabled ? 'Create Forwarding Trip' : 'Create Trip'}
                    active={currentPage === 'trip_creation'}
                    onClick={() => handlePageChange('trip_creation')}
                  />
                )}

              {/* All users have access */}
              <NavItem
                icon="📦"
                label="Trips & Deliveries"
                active={currentPage === 'trips_deliveries'}
                onClick={() => handlePageChange('trips_deliveries')}
              />

              {/* Only Admin & Depot Manager (financial access) */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="📈"
                  label="Reports"
                  active={currentPage === 'reports'}
                  onClick={() => handlePageChange('reports')}
                />
              )}

              {/* Only Admin & Depot Manager */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="🧾"
                  label="All Receipts"
                  active={currentPage === 'receipts'}
                  onClick={() => handlePageChange('receipts')}
                />
              )}

              {/* Only Admin has access to Credit Ledger */}
              {userRole === 'owner' && (
                <NavItem
                  icon="💳"
                  label="Credit Ledger"
                  active={currentPage === 'credit_ledger'}
                  onClick={() => handlePageChange('credit_ledger')}
                />
              )}

              {/* Only Admin has access to Settings */}
              {userRole === 'owner' && (
                <NavItem
                  icon="⚙️"
                  label="Settings"
                  active={currentPage === 'settings'}
                  onClick={() => handlePageChange('settings')}
                />
              )}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-8 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content - Add top padding on mobile for fixed header */}
        <main className="flex-1 pt-16 lg:pt-0">
          {currentPage === 'dashboard' && <Dashboard userRole={userRole} assignedDepotId={assignedDepotId} />}
          {currentPage === 'new_booking' && (userRole === 'owner' || userRole === 'booking_clerk') && <NewBooking onNavigate={handlePageChange} />}
          {currentPage === 'trip_creation' && (userRole === 'owner' || userRole === 'booking_clerk' ||
            (userRole === 'depot_manager' && depotInfo?.forwarding_enabled)) && <TripCreation userRole={userRole} assignedDepotId={assignedDepotId} />}
          {currentPage === 'trips_deliveries' && <TripsDeliveries userRole={userRole} assignedDepotId={assignedDepotId} />}
          {currentPage === 'reports' && userRole === 'owner' && <Reports assignedDepotId={assignedDepotId} />}
          {currentPage === 'reports' && userRole === 'depot_manager' && assignedDepotId && <DepotReports assignedDepotId={assignedDepotId} />}
          {currentPage === 'receipts' && (userRole === 'owner' || userRole === 'depot_manager') && <AllReceipts assignedDepotId={assignedDepotId} />}
          {currentPage === 'credit_ledger' && userRole === 'owner' && <CreditLedger assignedDepotId={assignedDepotId} />}
          {currentPage === 'settings' && userRole === 'owner' && <Settings userRole={userRole} />}
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors touch-target ${active
        ? 'bg-orange-50 text-orange-600'
        : 'text-gray-600 hover:bg-gray-50'
        }`}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
