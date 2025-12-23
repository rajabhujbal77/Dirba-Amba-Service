import React, { useState } from 'react';

export default function Reports() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [reportType, setReportType] = useState('bookings');

  const bookingSummary = {
    totalBookings: 245,
    confirmedBookings: 198,
    pendingBookings: 32,
    cancelledBookings: 15,
    totalRevenue: 3245000,
    totalQuantity: 125000,
  };

  const tripSummary = {
    totalTrips: 52,
    completedTrips: 48,
    activeTrips: 3,
    cancelledTrips: 1,
    onTimeDelivery: 92.3,
  };

  const topCustomers = [
    { name: 'Ramesh Traders', bookings: 45, revenue: 450000 },
    { name: 'Aarav Exports', bookings: 38, revenue: 420000 },
    { name: 'Krishna Fruits', bookings: 32, revenue: 385000 },
    { name: 'Mangesh Suppliers', bookings: 28, revenue: 310000 },
    { name: 'Priya Fruits', bookings: 25, revenue: 280000 },
  ];

  const topRoutes = [
    { route: 'Ratnagiri → Mumbai', trips: 28, revenue: 980000 },
    { route: 'Devgad → Pune', trips: 18, revenue: 620000 },
    { route: 'Ratnagiri → Delhi', trips: 12, revenue: 850000 },
    { route: 'Vengurla → Bangalore', trips: 10, revenue: 720000 },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600">Analytics and business insights</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              id="reportType"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="bookings">Bookings Report</option>
              <option value="trips">Trips Report</option>
              <option value="revenue">Revenue Report</option>
              <option value="customers">Customer Report</option>
            </select>
          </div>
          <div>
            <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
              Generate Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Booking Summary */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Booking Summary</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Bookings</span>
              <span className="font-bold text-gray-900">{bookingSummary.totalBookings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Confirmed</span>
              <span className="font-bold text-green-600">{bookingSummary.confirmedBookings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pending</span>
              <span className="font-bold text-yellow-600">{bookingSummary.pendingBookings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cancelled</span>
              <span className="font-bold text-red-600">{bookingSummary.cancelledBookings}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-bold text-orange-600">
                  ₹{(bookingSummary.totalRevenue / 100000).toFixed(2)}L
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Quantity</span>
                <span className="font-bold text-gray-900">
                  {(bookingSummary.totalQuantity / 1000).toFixed(0)} tons
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Summary */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Trip Summary</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Trips</span>
              <span className="font-bold text-gray-900">{tripSummary.totalTrips}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Completed</span>
              <span className="font-bold text-green-600">{tripSummary.completedTrips}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active</span>
              <span className="font-bold text-blue-600">{tripSummary.activeTrips}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cancelled</span>
              <span className="font-bold text-red-600">{tripSummary.cancelledTrips}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">On-Time Delivery Rate</span>
                <span className="font-bold text-orange-600">{tripSummary.onTimeDelivery}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Top Customers</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {topCustomers.map((customer, index) => (
              <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-orange-600">{index + 1}</span>
                    </div>
                    <span className="font-medium text-gray-900">{customer.name}</span>
                  </div>
                  <span className="font-bold text-orange-600">
                    ₹{(customer.revenue / 100000).toFixed(2)}L
                  </span>
                </div>
                <div className="ml-11">
                  <span className="text-sm text-gray-600">{customer.bookings} bookings</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Routes */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Top Routes</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {topRoutes.map((route, index) => (
              <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-blue-600">{index + 1}</span>
                    </div>
                    <span className="font-medium text-gray-900">{route.route}</span>
                  </div>
                  <span className="font-bold text-orange-600">
                    ₹{(route.revenue / 100000).toFixed(2)}L
                  </span>
                </div>
                <div className="ml-11">
                  <span className="text-sm text-gray-600">{route.trips} trips</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="mt-6 flex justify-end gap-3">
        <button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
          Export as PDF
        </button>
        <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
          Export as Excel
        </button>
      </div>
    </div>
  );
}
