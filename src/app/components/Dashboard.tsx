import React from 'react';

interface DashboardProps {
  userRole: 'owner' | 'booking_clerk' | 'depot_manager';
}

export default function Dashboard({ userRole }: DashboardProps) {
  const stats = [
    { label: 'Total Bookings', value: '245', change: '+12%', icon: '📝' },
    { label: 'Active Trips', value: '18', change: '+3', icon: '🚚' },
    { label: 'Pending Deliveries', value: '42', change: '-5', icon: '📦' },
    { label: 'Revenue This Month', value: '₹3.2L', change: '+18%', icon: '💰' },
  ];

  const recentBookings = [
    { id: 'BK-001', customer: 'Ramesh Traders', origin: 'Ratnagiri', destination: 'Mumbai', quantity: '500 kg', status: 'confirmed' },
    { id: 'BK-002', customer: 'Aarav Exports', origin: 'Devgad', destination: 'Pune', quantity: '750 kg', status: 'pending' },
    { id: 'BK-003', customer: 'Krishna Fruits', origin: 'Ratnagiri', destination: 'Delhi', quantity: '1000 kg', status: 'confirmed' },
    { id: 'BK-004', customer: 'Mangesh Suppliers', origin: 'Vengurla', destination: 'Bangalore', quantity: '600 kg', status: 'in_transit' },
  ];

  const activeTrips = [
    { id: 'TR-101', route: 'Ratnagiri → Mumbai', driver: 'Suresh Kumar', vehicle: 'MH-12-AB-1234', bookings: 8, status: 'in_progress' },
    { id: 'TR-102', route: 'Devgad → Pune', driver: 'Amit Patil', vehicle: 'MH-14-CD-5678', bookings: 5, status: 'loading' },
    { id: 'TR-103', route: 'Ratnagiri → Delhi', driver: 'Rajesh Singh', vehicle: 'DL-01-EF-9012', bookings: 12, status: 'in_progress' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your logistics overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-sm font-medium ${
                stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
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
            {recentBookings.map((booking) => (
              <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{booking.customer}</p>
                    <p className="text-sm text-gray-600">{booking.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {booking.origin} → {booking.destination} • {booking.quantity}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Trips */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Active Trips</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {activeTrips.map((trip) => (
              <div key={trip.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{trip.route}</p>
                    <p className="text-sm text-gray-600">{trip.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    trip.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {trip.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Driver: {trip.driver}
                </p>
                <p className="text-sm text-gray-600">
                  {trip.vehicle} • {trip.bookings} bookings
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
