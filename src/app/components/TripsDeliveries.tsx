import React, { useState, useEffect } from 'react';
import { tripsApi, bookingsApi, depotsApi } from '../utils/api';
import { jsPDF } from 'jspdf';

interface TripsDeliveriesProps {
  userRole: 'owner' | 'booking_clerk' | 'depot_manager';
  assignedDepotId?: string | null;
}

interface Trip {
  id: string;
  trip_number: string;
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  trip_cost: number;
  status: string;
  departure_time: string;
  arrival_time: string;
  created_at: string;
  origin_depot_id: string;
  destination_depot_id: string;
  total_bookings: number;
  delivered_bookings: number;
}

interface Booking {
  id: string;
  receipt_number: string;
  sender_name: string;
  sender_phone: string;
  destination_depot_name: string;
  origin_depot_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  receivers: any[];
}

export default function TripsDeliveries({ userRole, assignedDepotId }: TripsDeliveriesProps) {
  const [activeTab, setActiveTab] = useState<'trips' | 'deliveries'>('trips');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [depots, setDepots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tripsRes, bookingsRes, depotsRes] = await Promise.all([
        tripsApi.getAllWithProgress(),
        bookingsApi.getAll(),
        depotsApi.getAll()
      ]);

      const allTrips = tripsRes.trips || [];
      const allBookings = bookingsRes.bookings || [];

      // Filter data for depot managers based on assigned depot
      const filteredTrips = userRole === 'depot_manager' && assignedDepotId
        ? allTrips.filter((t: any) =>
          t.origin_depot_id === assignedDepotId ||
          t.destination_depot_id === assignedDepotId
        )
        : allTrips;

      const filteredBookings = userRole === 'depot_manager' && assignedDepotId
        ? allBookings.filter((b: any) =>
          b.destination_depot_id === assignedDepotId ||
          b.origin_depot_id === assignedDepotId
        )
        : allBookings;

      setTrips(filteredTrips);
      setBookings(filteredBookings);
      // Depots come ordered by their position/id - use index as order
      setDepots(depotsRes.depots || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDelivered = async (bookingId: string) => {
    try {
      await bookingsApi.updateStatus(bookingId, 'delivered');
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error marking delivered:', error);
      alert('Error marking as delivered');
    }
  };

  const handleUpdateTripStatus = async (tripId: string, newStatus: string) => {
    try {
      await tripsApi.update(tripId, { status: newStatus });
      await loadData();
    } catch (error) {
      console.error('Error updating trip status:', error);
      alert('Error updating trip status');
    }
  };

  // Download Driver's Memo PDF
  const downloadDriverMemo = (trip: Trip) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("DRIVER'S MEMO", pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('DRT Mango Transport', pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Trip Info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Trip Details', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Trip Number: ${trip.trip_number || trip.id}`, 14, y); y += 5;
    doc.text(`Driver: ${trip.driver_name} | Phone: ${trip.driver_phone || 'N/A'}`, 14, y); y += 5;
    doc.text(`Vehicle: ${trip.vehicle_number}`, 14, y); y += 5;
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, y); y += 10;

    // Get in_transit bookings sorted by destination depot order number
    // Create depot order map: depot name -> order number (index + 1)
    const depotOrderMap: Record<string, number> = {};
    depots.forEach((depot, index) => {
      depotOrderMap[depot.name] = index + 1; // 1-based order
    });

    const tripBookings = bookings
      .filter(b => b.status === 'in_transit')
      .sort((a, b) => {
        const orderA = depotOrderMap[a.destination_depot_name] || 999;
        const orderB = depotOrderMap[b.destination_depot_name] || 999;
        return orderA - orderB;
      });

    // Bookings Header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bookings (${tripBookings.length} items)`, 14, y);
    y += 8;

    // Draw line
    doc.setDrawColor(200);
    doc.line(14, y - 2, pageWidth - 14, y - 2);

    tripBookings.forEach((booking, index) => {
      // Check if we need a new page
      if (y > 260) {
        doc.addPage();
        y = 15;
      }

      // Booking card
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y, pageWidth - 28, 8, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${booking.receipt_number} - ${booking.destination_depot_name}`, 16, y + 5);
      y += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      // Sender
      doc.text(`Sender: ${booking.sender_name} | ${booking.sender_phone}`, 16, y); y += 4;
      doc.text(`From: ${booking.origin_depot_name}  To: ${booking.destination_depot_name}`, 16, y); y += 4;
      doc.text(`Amount: Rs. ${(Number(booking.total_amount) || 0).toLocaleString('en-IN')}`, 16, y); y += 5;

      // Receivers and packages
      if (Array.isArray(booking.receivers)) {
        booking.receivers.forEach((receiver: any, rIdx: number) => {
          if (y > 265) { doc.addPage(); y = 15; }
          doc.setFont('helvetica', 'bold');
          doc.text(`  Receiver ${rIdx + 1}: ${receiver.name} | ${receiver.phone}`, 16, y); y += 4;
          doc.setFont('helvetica', 'normal');
          if (receiver.address) {
            doc.text(`    Address: ${receiver.address}`, 16, y); y += 4;
          }
          // Packages
          if (Array.isArray(receiver.packages)) {
            receiver.packages.forEach((pkg: any) => {
              if (y > 265) { doc.addPage(); y = 15; }
              doc.text(`    - ${pkg.size}: ${pkg.quantity} pcs @ Rs.${pkg.price_per_unit || 0} = Rs.${pkg.total_price || 0}`, 16, y);
              y += 4;
            });
          }
        });
      }
      y += 4;
    });

    // Footer
    if (y > 260) { doc.addPage(); y = 15; }
    y += 5;
    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, y);
    doc.text('Driver Signature: _________________', pageWidth - 80, y);

    // Save
    doc.save(`DriverMemo_${trip.trip_number || trip.id}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_transit':
        return 'bg-blue-100 text-blue-700';
      case 'loading':
      case 'planned':
        return 'bg-orange-100 text-orange-700';
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'booked':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get total packages for a booking
  const getPackageCount = (booking: Booking) => {
    let count = 0;
    if (Array.isArray(booking.receivers)) {
      booking.receivers.forEach((r: any) => {
        if (Array.isArray(r.packages)) {
          r.packages.forEach((p: any) => {
            count += Number(p.quantity) || 0;
          });
        }
      });
    }
    return count;
  };

  // Filter bookings for deliveries tab (in_transit or delivered)
  const deliveryBookings = bookings.filter(b =>
    statusFilter === 'all'
      ? ['in_transit', 'delivered'].includes(b.status)
      : b.status === statusFilter
  );

  // Filter trips
  const filteredTrips = trips.filter(t =>
    statusFilter === 'all' || t.status === statusFilter
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trips and deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Trips & Deliveries</h1>
        <p className="text-gray-600">Track all trips and manage deliveries</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('trips'); setStatusFilter('all'); }}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'trips'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          All Trips ({trips.length})
        </button>
        <button
          onClick={() => { setActiveTab('deliveries'); setStatusFilter('all'); }}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'deliveries'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          Deliveries ({bookings.filter(b => ['in_transit', 'delivered'].includes(b.status)).length})
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          All
        </button>
        {activeTab === 'trips' ? (
          <>
            <button
              onClick={() => setStatusFilter('in_transit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'in_transit' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              In Transit
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Completed
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setStatusFilter('in_transit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'in_transit' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              In Transit
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'delivered' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Delivered
            </button>
          </>
        )}
      </div>

      {/* Trips View */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          {filteredTrips.length > 0 ? filteredTrips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">
                      {trip.trip_number || trip.id}
                    </h3>
                    <p className="text-sm text-gray-600">{trip.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                    {trip.status?.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Driver</p>
                    <p className="text-sm font-medium text-gray-900">{trip.driver_name}</p>
                    {trip.driver_phone && (
                      <p className="text-xs text-gray-500">{trip.driver_phone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Vehicle</p>
                    <p className="text-sm font-medium text-gray-900">{trip.vehicle_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Trip Cost</p>
                    <p className="text-sm font-medium text-red-600">
                      ₹{(Number(trip.trip_cost) || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Revenue</p>
                    <p className="text-sm font-medium text-green-600">
                      ₹{bookings
                        .filter(b => b.status === 'in_transit' || b.status === 'delivered')
                        .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
                        .toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Delivery Progress</p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.delivered_bookings || 0}/{trip.total_bookings || 0} delivered
                    </p>
                    {/* Progress bar */}
                    {trip.total_bookings > 0 && (
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${trip.delivered_bookings === trip.total_bookings
                            ? 'bg-green-500'
                            : 'bg-orange-500'
                            }`}
                          style={{ width: `${(trip.delivered_bookings / trip.total_bookings) * 100}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Departure</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(trip.departure_time)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ETA</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(trip.arrival_time)}</p>
                  </div>
                </div>

                {/* Auto-completion notice */}
                {trip.status === 'in_transit' && trip.total_bookings > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      ℹ️ This trip will auto-complete when all {trip.total_bookings} receipts are marked as delivered.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 mt-4 flex-wrap">
                  <button
                    onClick={() => downloadDriverMemo(trip)}
                    className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    📄 Download Memo
                  </button>
                  {trip.status === 'planned' && (
                    <button
                      onClick={() => handleUpdateTripStatus(trip.id, 'in_transit')}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Start Trip
                    </button>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-lg">No trips found</p>
              <p className="text-gray-400 text-sm mt-2">Create a new trip from the Trip Creation page</p>
            </div>
          )}
        </div>
      )}

      {/* Deliveries View */}
      {activeTab === 'deliveries' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt #
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sender
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Packages
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveryBookings.length > 0 ? deliveryBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="font-medium text-gray-900">{booking.receipt_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(booking.created_at)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{booking.sender_name}</p>
                      <p className="text-xs text-gray-500">{booking.sender_phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">
                        {booking.origin_depot_name} → {booking.destination_depot_name}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{getPackageCount(booking)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-green-600">
                        ₹{(Number(booking.total_amount) || 0).toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {booking.status === 'in_transit' && (
                        <button
                          onClick={() => handleMarkDelivered(booking.id)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          Mark Delivered
                        </button>
                      )}
                      {booking.status === 'delivered' && (
                        <span className="text-sm text-green-600">✓ Delivered</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No deliveries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
