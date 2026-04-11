import React, { useState, useEffect, Suspense } from 'react';
import { depotsApi } from './utils/api';
import { useOnlineStore } from './stores';

// Lazy load all page components for code splitting
// This significantly reduces the initial bundle size
const LoginPage = React.lazy(() => import('./components/LoginPage'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const NewBooking = React.lazy(() => import('./components/NewBooking'));
const TripCreation = React.lazy(() => import('./components/TripCreation'));
const TripsDeliveries = React.lazy(() => import('./components/TripsDeliveries'));
const Reports = React.lazy(() => import('./components/Reports'));
const DepotReports = React.lazy(() => import('./components/DepotReports'));
const AllReceipts = React.lazy(() => import('./components/AllReceipts'));
const CreditLedger = React.lazy(() => import('./components/CreditLedger'));
const Settings = React.lazy(() => import('./components/Settings'));

// Keep these as static imports since they're always needed
import OfflineIndicator from './components/OfflineIndicator';
import ConflictResolver from './components/ConflictResolver';
import { startSyncEngine, stopSyncEngine } from './utils/syncEngine';

// User role type
type UserRole = 'owner' | 'booking_clerk' | 'depot_manager';

// Pages allowed when offline (only booking)
const OFFLINE_ALLOWED_PAGES = ['dashboard', 'new_booking'];

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [assignedDepotId, setAssignedDepotId] = useState<string | null>(null);
  const [depotInfo, setDepotInfo] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isOnline = useOnlineStore((state) => state.isOnline);

  // Initialize sync engine on mount
  useEffect(() => {
    startSyncEngine();
    return () => {
      stopSyncEngine();
    };
  }, []);

  // When going offline, redirect to an allowed page if current page is not allowed
  useEffect(() => {
    if (!isOnline && !OFFLINE_ALLOWED_PAGES.includes(currentPage)) {
      setCurrentPage('new_booking');
    }
  }, [isOnline, currentPage]);

  // Close sidebar on page change (for mobile)
  const handlePageChange = (page: string) => {
    // Block navigation to non-allowed pages when offline
    if (!isOnline && !OFFLINE_ALLOWED_PAGES.includes(page)) {
      return;
    }
    setCurrentPage(page);
    setSidebarOpen(false); // Auto-close sidebar on navigation
  };

  const handleLogin = async (role: UserRole, id: string, depotId?: string | null) => {
    setIsLoggedIn(true);
    setUserRole(role);
    setUserId(id);
    setAssignedDepotId(depotId || null);

    console.log('handleLogin called:', { role, id, depotId }); // Debug log

    // Fetch depot info for depot managers, reset for other roles
    if (role === 'depot_manager' && depotId) {
      console.log('Fetching depot info for:', depotId); // Debug log
      try {
        const info = await depotsApi.getById(depotId);
        console.log('Depot info fetched:', info); // Debug log
        setDepotInfo(info);
      } catch (error) {
        // Gracefully handle offline/network errors — depot info is non-critical
        console.error('Error fetching depot info (may be offline):', error);
        setDepotInfo(null);
      }
    } else {
      // Reset depot info for non-depot_manager roles to prevent stale state
      setDepotInfo(null);
    }

    // If offline, go directly to New Booking (only allowed page)
    if (!navigator.onLine && (role === 'owner' || role === 'booking_clerk')) {
      setCurrentPage('new_booking');
    } else {
      setCurrentPage('dashboard');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
    setSidebarOpen(false);
    // Reset all user-related state to prevent stale data issues
    setUserRole(null);
    setUserId(null);
    setAssignedDepotId(null);
    setDepotInfo(null);
  };

  if (!isLoggedIn) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage onLogin={handleLogin} />
      </Suspense>
    );
  }

  /**
   * Helper: check if a nav item is disabled (offline + not an allowed page).
   */
  const isNavDisabled = (page: string) => !isOnline && !OFFLINE_ALLOWED_PAGES.includes(page);

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
          <img src="/Logo.svg" alt="Logo" className="w-10 h-10 object-contain" />
          <span className="font-bold text-gray-900">Dirba Amba Service</span>
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
              <img src="/Logo.svg" alt="Dirba Amba Service Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="font-bold text-gray-900">Dirba Amba Service</h1>
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
                disabled={false}
              />

              {/* Booking Clerk & Admin have access */}
              {(userRole === 'owner' || userRole === 'booking_clerk') && (
                <NavItem
                  icon="📝"
                  label="New Booking"
                  active={currentPage === 'new_booking'}
                  onClick={() => handlePageChange('new_booking')}
                  disabled={false}
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
                    disabled={isNavDisabled('trip_creation')}
                  />
                )}

              {/* All users have access */}
              <NavItem
                icon="📦"
                label="Trips & Deliveries"
                active={currentPage === 'trips_deliveries'}
                onClick={() => handlePageChange('trips_deliveries')}
                disabled={isNavDisabled('trips_deliveries')}
              />

              {/* Only Admin & Depot Manager (financial access) */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="📈"
                  label="Reports"
                  active={currentPage === 'reports'}
                  onClick={() => handlePageChange('reports')}
                  disabled={isNavDisabled('reports')}
                />
              )}

              {/* Only Admin & Depot Manager */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="🧾"
                  label="All Receipts"
                  active={currentPage === 'receipts'}
                  onClick={() => handlePageChange('receipts')}
                  disabled={isNavDisabled('receipts')}
                />
              )}

              {/* Only Admin has access to Credit Ledger */}
              {userRole === 'owner' && (
                <NavItem
                  icon="💳"
                  label="Credit Ledger"
                  active={currentPage === 'credit_ledger'}
                  onClick={() => handlePageChange('credit_ledger')}
                  disabled={isNavDisabled('credit_ledger')}
                />
              )}

              {/* Only Admin has access to Settings */}
              {userRole === 'owner' && (
                <NavItem
                  icon="⚙️"
                  label="Settings"
                  active={currentPage === 'settings'}
                  onClick={() => handlePageChange('settings')}
                  disabled={isNavDisabled('settings')}
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
          <Suspense fallback={<PageLoader />}>
            {currentPage === 'dashboard' && userRole && <Dashboard userRole={userRole} assignedDepotId={assignedDepotId} />}
            {currentPage === 'new_booking' && (userRole === 'owner' || userRole === 'booking_clerk') && <NewBooking onNavigate={handlePageChange} userRole={userRole} />}
            {currentPage === 'trip_creation' && (userRole === 'owner' || userRole === 'booking_clerk' ||
              (userRole === 'depot_manager' && depotInfo?.forwarding_enabled)) && <TripCreation userRole={userRole} assignedDepotId={assignedDepotId} />}
            {currentPage === 'trips_deliveries' && userRole && <TripsDeliveries userRole={userRole} assignedDepotId={assignedDepotId} />}
            {currentPage === 'reports' && userRole === 'owner' && <Reports assignedDepotId={assignedDepotId} />}
            {currentPage === 'reports' && userRole === 'depot_manager' && assignedDepotId && <DepotReports assignedDepotId={assignedDepotId} />}
            {currentPage === 'receipts' && (userRole === 'owner' || userRole === 'depot_manager') && <AllReceipts assignedDepotId={assignedDepotId} />}
            {currentPage === 'credit_ledger' && userRole === 'owner' && <CreditLedger assignedDepotId={assignedDepotId} />}
            {currentPage === 'settings' && userRole === 'owner' && <Settings userRole={userRole} />}
          </Suspense>
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
  disabled?: boolean;
}

function NavItem({ icon, label, active, onClick, disabled = false }: NavItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors touch-target ${
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : active
            ? 'bg-orange-50 text-orange-600'
            : 'text-gray-600 hover:bg-gray-50'
      }`}
      title={disabled ? 'Not available offline' : undefined}
    >
      <span className={disabled ? 'opacity-40' : ''}>{icon}</span>
      <span className="font-medium">{label}</span>
      {disabled && (
        <span className="ml-auto text-xs text-gray-300">🔒</span>
      )}
    </button>
  );
}
