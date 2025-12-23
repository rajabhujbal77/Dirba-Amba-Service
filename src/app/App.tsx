import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NewBooking from './components/NewBooking';
import TripCreation from './components/TripCreation';
import TripsDeliveries from './components/TripsDeliveries';
import Reports from './components/Reports';
import AllReceipts from './components/AllReceipts';
import CreditLedger from './components/CreditLedger';
import Settings from './components/Settings';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userRole, setUserRole] = useState<'owner' | 'booking_clerk' | 'depot_manager'>('owner');

  const handleLogin = (role: 'owner' | 'booking_clerk' | 'depot_manager') => {
    setIsLoggedIn(true);
    setUserRole(role);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">🥭</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Mango Express</h1>
                <p className="text-sm text-gray-500 capitalize">{userRole.replace('_', ' ')}</p>
              </div>
            </div>

            <nav className="space-y-1">
              {/* Dashboard - Available to all */}
              <NavItem
                icon="📊"
                label="Dashboard"
                active={currentPage === 'dashboard'}
                onClick={() => setCurrentPage('dashboard')}
              />
              
              {/* Booking Clerk & Admin have access */}
              {(userRole === 'owner' || userRole === 'booking_clerk') && (
                <NavItem
                  icon="📝"
                  label="New Booking"
                  active={currentPage === 'new_booking'}
                  onClick={() => setCurrentPage('new_booking')}
                />
              )}
              
              {/* Booking Clerk & Admin have access */}
              {(userRole === 'owner' || userRole === 'booking_clerk') && (
                <NavItem
                  icon="🚚"
                  label="Trip Creation"
                  active={currentPage === 'trip_creation'}
                  onClick={() => setCurrentPage('trip_creation')}
                />
              )}
              
              {/* All users have access */}
              <NavItem
                icon="📦"
                label="Trips & Deliveries"
                active={currentPage === 'trips_deliveries'}
                onClick={() => setCurrentPage('trips_deliveries')}
              />
              
              {/* Only Admin & Depot Manager (financial access) */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="📈"
                  label="Reports"
                  active={currentPage === 'reports'}
                  onClick={() => setCurrentPage('reports')}
                />
              )}
              
              {/* Only Admin & Depot Manager */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="🧾"
                  label="All Receipts"
                  active={currentPage === 'receipts'}
                  onClick={() => setCurrentPage('receipts')}
                />
              )}
              
              {/* Only Admin & Depot Manager */}
              {(userRole === 'owner' || userRole === 'depot_manager') && (
                <NavItem
                  icon="💳"
                  label="Credit Ledger"
                  active={currentPage === 'credit_ledger'}
                  onClick={() => setCurrentPage('credit_ledger')}
                />
              )}
              
              {/* Only Admin has access to Settings */}
              {userRole === 'owner' && (
                <NavItem
                  icon="⚙️"
                  label="Settings"
                  active={currentPage === 'settings'}
                  onClick={() => setCurrentPage('settings')}
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

        {/* Main Content */}
        <main className="flex-1">
          {currentPage === 'dashboard' && <Dashboard userRole={userRole} />}
          {currentPage === 'new_booking' && (userRole === 'owner' || userRole === 'booking_clerk') && <NewBooking />}
          {currentPage === 'trip_creation' && (userRole === 'owner' || userRole === 'booking_clerk') && <TripCreation />}
          {currentPage === 'trips_deliveries' && <TripsDeliveries userRole={userRole} />}
          {currentPage === 'reports' && (userRole === 'owner' || userRole === 'depot_manager') && <Reports />}
          {currentPage === 'receipts' && (userRole === 'owner' || userRole === 'depot_manager') && <AllReceipts />}
          {currentPage === 'credit_ledger' && (userRole === 'owner' || userRole === 'depot_manager') && <CreditLedger />}
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active
          ? 'bg-orange-50 text-orange-600'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}