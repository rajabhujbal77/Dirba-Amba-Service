import React, { useState, useEffect } from 'react';
import { bookingsApi, tripsApi } from '../utils/api';

interface DashboardProps {
  userRole: 'owner' | 'booking_clerk' | 'depot_manager';
}

export default function Dashboard({ userRole }: DashboardProps) {
  const [stats, setStats] = useState([
    { label: "Today's Bookings", value: '0', icon: '📝' },
    { label: "Today's Revenue", value: '₹0', icon: '💵' },
    { label: 'Total Revenue', value: '₹0', icon: '💰' },
    { label: 'Total Trips', value: '0', icon: '🚚' },
  ]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bookingsRes, tripsRes] = await Promise.all([
        bookingsApi.getAll(),
        tripsApi.getAll()
      ]);

      const bookings = bookingsRes.bookings || [];
      const trips = tripsRes.trips || [];

      // Get today's date (start of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      // Filter today's bookings
      const todaysBookings = bookings.filter((b: any) => {
        const bookingDate = new Date(b.created_at);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === todayTime;
      });

      // Calculate Stats
      const todaysBookingsCount = todaysBookings.length;
      const totalTrips = trips.length;

      // Today's Revenue
      const todaysRevenue = todaysBookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
      const formattedTodaysRevenue = todaysRevenue > 100000
        ? `₹${(todaysRevenue / 100000).toFixed(1)}L`
        : `₹${todaysRevenue.toLocaleString('en-IN')}`;

      // Total Revenue (all bookings)
      const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
      const formattedTotalRevenue = totalRevenue > 100000
        ? `₹${(totalRevenue / 100000).toFixed(1)}L`
        : `₹${totalRevenue.toLocaleString('en-IN')}`;

      setStats([
        { label: "Today's Bookings", value: String(todaysBookingsCount), icon: '📝' },
        { label: "Today's Revenue", value: formattedTodaysRevenue, icon: '💵' },
        { label: 'Total Revenue', value: formattedTotalRevenue, icon: '💰' },
        { label: 'Total Trips', value: String(totalTrips), icon: '🚚' },
      ]);

      // Recent Bookings (Top 5)
      setRecentBookings(bookings.slice(0, 5).map((b: any) => {
        // Calculate total packages from receivers
        const totalPackages = b.receivers?.reduce((sum: number, r: any) => {
          return sum + (r.packages?.reduce((pSum: number, p: any) => pSum + (p.quantity || 0), 0) || 0);
        }, 0) || 0;

        return {
          id: b.id || b.receipt_number,
          customer: b.sender_name || b.customer_name || 'N/A',
          origin: b.origin_depot_name || b.origin_location || 'N/A',
          destination: b.destination_depot_name || b.destination_location || 'N/A',
          quantity: totalPackages > 0 ? `${totalPackages} pkg` : (b.quantity || '0'),
          status: b.status,
          total: b.total_amount || 0
        };
      }));

      // Active Trips (Top 5)
      setActiveTrips(trips.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').slice(0, 5).map((t: any) => ({
        id: t.id,
        route: `${t.origin_depot?.name || 'Origin'} → ${t.destination_depot?.name || 'Dest'}`,
        driver: t.driver_name,
        vehicle: t.vehicle_number,
        status: t.status,
        bookings: 0 // Need a join or count to get actual bookings count per trip
      })));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your logistics overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              {/* Change indicator removed for now as we don't have historical data comparison yet */}
            </div>
            <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Recent Bookings</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentBookings.length === 0 ? (
              <div className="p-6 text-gray-500 text-center">No bookings found.</div>
            ) : (
              recentBookings.map((booking) => (
                <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{booking.customer}</p>
                      <p className="text-sm text-gray-600">{booking.id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${booking.status === 'booked' ? 'bg-blue-100 text-blue-700' :
                      booking.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                      {booking.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {booking.origin} → {booking.destination} • {booking.quantity}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Trips */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Active Trips</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {activeTrips.length === 0 ? (
              <div className="p-6 text-gray-500 text-center">No active trips.</div>
            ) : (
              activeTrips.map((trip) => (
                <div key={trip.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{trip.route}</p>
                      <p className="text-sm text-gray-600">{trip.id}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${trip.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                      }`}>
                      {trip.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    Driver: {trip.driver}
                  </p>
                  <p className="text-sm text-gray-600">
                    {trip.vehicle}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
