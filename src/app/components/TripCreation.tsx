import React, { useState, useEffect } from 'react';
import { seasonApi, bookingsApi, depotsApi, tripsApi } from '../utils/api';

interface Booking {
  id: string;
  receipt_number: string;
  sender_name: string;
  sender_phone: string;
  destination_depot_name: string;
  destination_depot_id: string;
  origin_depot_id: string;
  origin_depot_name: string;
  total_amount: number;
  package_details: any[];
  receivers: any[];
  status: string;
  created_at: string;
}

interface Depot {
  id: string;
  name: string;
  depot_type: string;
}

export default function TripCreation() {
  const [formData, setFormData] = useState({
    driverName: '',
    driverPhone: '',
    vehicleNumber: '',
    tripCost: '',
  });

  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [availableBookings, setAvailableBookings] = useState<Booking[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [isSeasonActive, setIsSeasonActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [seasonRes, bookingsRes, depotsRes] = await Promise.all([
        seasonApi.get(),
        bookingsApi.getAll(),
        depotsApi.getAll()
      ]);

      // Season check
      if (seasonRes.season && seasonRes.season.startDate && seasonRes.season.endDate) {
        setSeason(seasonRes.season);
        const now = new Date();
        const start = new Date(seasonRes.season.startDate);
        const end = new Date(seasonRes.season.endDate);
        setIsSeasonActive(now >= start && now <= end);
      }

      // Filter bookings with status 'booked' (not yet assigned to a trip)
      const bookedOnly = (bookingsRes.bookings || []).filter(
        (b: Booking) => b.status === 'booked'
      );
      setAvailableBookings(bookedOnly);

      // Set depots
      setDepots(depotsRes.depots || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSeasonActive) {
      alert('Cannot create trips outside of the season dates. Please contact admin to update season settings.');
      return;
    }

    if (selectedBookings.length === 0) {
      alert('Please select at least one booking for this trip.');
      return;
    }

    if (!formData.driverName || !formData.driverPhone || !formData.vehicleNumber) {
      alert('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get origin depot from first selected booking
      const firstBooking = availableBookings.find(b => selectedBookings.includes(b.id));

      // Create trip - use depot IDs not names
      const tripData = {
        driver: formData.driverName,
        driverPhone: formData.driverPhone,
        vehicle: formData.vehicleNumber,
        tripCost: parseFloat(formData.tripCost) || 0,
        originId: firstBooking?.origin_depot_id || null,
        destinationId: firstBooking?.destination_depot_id || null,
        departure: new Date().toISOString(),
        eta: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
      };

      // Create trip and link selected bookings (API handles status update)
      const tripResult = await tripsApi.create(tripData, selectedBookings);

      alert(`Trip created successfully! Trip Number: ${tripResult.trip?.trip_number || tripResult.trip?.id || 'Created'}`);

      // Reset form
      setFormData({
        driverName: '',
        driverPhone: '',
        vehicleNumber: '',
        tripCost: '',
      });
      setSelectedBookings([]);

      // Reload bookings
      loadInitialData();
    } catch (error) {
      console.error('Error creating trip:', error);
      alert('Error creating trip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const toggleBooking = (bookingId: string) => {
    setSelectedBookings(prev =>
      prev.includes(bookingId)
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const selectAllBookings = () => {
    if (selectedBookings.length === availableBookings.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(availableBookings.map(b => b.id));
    }
  };

  // Helper to extract all packages from a booking (from receivers)
  const getBookingPackages = (booking: any) => {
    const packages: { size: string; quantity: number }[] = [];
    if (Array.isArray(booking.receivers)) {
      booking.receivers.forEach((receiver: any) => {
        if (Array.isArray(receiver.packages)) {
          receiver.packages.forEach((pkg: any) => {
            packages.push({
              size: pkg.size || 'Other',
              quantity: Number(pkg.quantity) || 0
            });
          });
        }
      });
    }
    return packages;
  };

  // Calculate totals
  const selectedBookingDetails = availableBookings.filter(b => selectedBookings.includes(b.id));
  const totalPackages = selectedBookingDetails.reduce((sum, b) => {
    return sum + getBookingPackages(b).reduce((pSum, pkg) => pSum + pkg.quantity, 0);
  }, 0);
  const totalAmount = selectedBookingDetails.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

  // Calculate total inventory across all depots
  const totalInventory = availableBookings.reduce((acc, booking) => {
    getBookingPackages(booking).forEach(pkg => {
      acc[pkg.size] = (acc[pkg.size] || 0) + pkg.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  // Group bookings by destination depot with package breakdown
  const inventoryByDestination = availableBookings.reduce((acc, booking) => {
    const dest = booking.destination_depot_name || 'Unknown';
    if (!acc[dest]) {
      acc[dest] = { bookings: [], packages: {} as Record<string, number> };
    }
    acc[dest].bookings.push(booking);

    // Aggregate packages from receivers
    getBookingPackages(booking).forEach(pkg => {
      acc[dest].packages[pkg.size] = (acc[dest].packages[pkg.size] || 0) + pkg.quantity;
    });
    return acc;
  }, {} as Record<string, { bookings: Booking[]; packages: Record<string, number> }>);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading trip data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Trip Creation</h1>
        <p className="text-gray-600">Create a new transport trip and assign bookings</p>
      </div>

      {/* Season Warning */}
      {!isSeasonActive && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-red-800 mb-1">Season Inactive</h3>
              <p className="text-sm text-red-700">
                Trips cannot be created outside the season dates
                {season && ` (${new Date(season.startDate).toLocaleDateString('en-IN')} - ${new Date(season.endDate).toLocaleDateString('en-IN')})`}.
                Please contact the administrator to update season settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Summary Cards */}
      <div className="mb-6">
        <h2 className="font-bold text-gray-900 mb-4">System Inventory - Pending Bookings</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {/* Total Inventory Card - First */}
          {availableBookings.length > 0 && (
            <div className="bg-orange-50 rounded-lg border-2 border-orange-300 p-4 min-w-[180px] flex-shrink-0">
              <p className="text-sm font-bold text-orange-700 mb-2">📦 Total Inventory</p>
              <p className="text-xs text-gray-600 mb-2">{availableBookings.length} total bookings</p>
              <div className="space-y-1 max-h-[140px] overflow-y-auto">
                {Object.entries(totalInventory).map(([pkgName, qty]) => (
                  <div key={pkgName} className="flex justify-between text-xs">
                    <span className="text-gray-700">{pkgName}</span>
                    <span className="font-bold text-orange-700 ml-2">{qty}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-Depot Cards */}
          {Object.entries(inventoryByDestination).map(([depot, data]) => (
            <div key={depot} className="bg-white rounded-lg border border-gray-200 p-4 min-w-[180px] flex-shrink-0">
              <p className="text-sm font-bold text-gray-900 truncate mb-2">{depot}</p>
              <p className="text-xs text-gray-500 mb-2">{data.bookings.length} bookings</p>
              <div className="space-y-1 max-h-[140px] overflow-y-auto">
                {Object.entries(data.packages).map(([pkgName, qty]) => (
                  <div key={pkgName} className="flex justify-between text-xs">
                    <span className="text-gray-600 truncate">{pkgName}</span>
                    <span className="font-bold text-orange-600 ml-2">{qty}</span>
                  </div>
                ))}
                {Object.keys(data.packages).length === 0 && (
                  <p className="text-xs text-gray-400">No packages</p>
                )}
              </div>
            </div>
          ))}
          {Object.keys(inventoryByDestination).length === 0 && (
            <div className="flex-1 bg-gray-50 rounded-lg p-6 text-center text-gray-500">
              No pending bookings available
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trip Details Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
            <h2 className="font-bold text-gray-900 mb-4">Trip Details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="driverName" className="block text-sm font-medium text-gray-700 mb-1">
                  Driver Name *
                </label>
                <input
                  id="driverName"
                  name="driverName"
                  type="text"
                  value={formData.driverName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter driver name"
                  required
                />
              </div>

              <div>
                <label htmlFor="driverPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Driver Phone *
                </label>
                <input
                  id="driverPhone"
                  name="driverPhone"
                  type="tel"
                  value={formData.driverPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="10-digit number"
                  maxLength={10}
                  required
                />
              </div>

              <div>
                <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number *
                </label>
                <input
                  id="vehicleNumber"
                  name="vehicleNumber"
                  type="text"
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., MH-12-AB-1234"
                  required
                />
              </div>

              <div>
                <label htmlFor="tripCost" className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Cost (₹)
                </label>
                <input
                  id="tripCost"
                  name="tripCost"
                  type="number"
                  value={formData.tripCost}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>

              {/* Selected Summary */}
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Selected Bookings</span>
                  <span className="font-bold text-orange-600">{selectedBookings.length}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Total Packages</span>
                  <span className="font-bold text-gray-900">{totalPackages}</span>
                </div>
                <div className="flex justify-between items-center border-t border-orange-200 pt-2">
                  <span className="text-sm font-medium text-gray-700">Total Value</span>
                  <span className="font-bold text-green-600">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || selectedBookings.length === 0 || !isSeasonActive}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating Trip...' : 'Create Trip'}
              </button>
            </form>
          </div>
        </div>

        {/* Booking Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-gray-900">Select Bookings</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {availableBookings.length} bookings available for assignment
                </p>
              </div>
              <button
                type="button"
                onClick={selectAllBookings}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {selectedBookings.length === availableBookings.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-200">
              {availableBookings.length > 0 ? availableBookings.map((booking) => (
                <label
                  key={booking.id}
                  className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedBookings.includes(booking.id) ? 'bg-orange-50' : ''
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedBookings.includes(booking.id)}
                    onChange={() => toggleBooking(booking.id)}
                    className="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{booking.sender_name}</p>
                        <p className="text-sm text-gray-600">{booking.sender_phone}</p>
                      </div>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                        {booking.receipt_number}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="text-gray-600">
                        📍 {booking.origin_depot_name || 'Origin'} → {booking.destination_depot_name || 'Destination'}
                      </span>
                      <span className="font-medium text-green-600">
                        ₹{(Number(booking.total_amount) || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {booking.package_details && Array.isArray(booking.package_details) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {booking.package_details.map((pkg: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {pkg.name || pkg.packageName}: {pkg.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              )) : (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-lg mb-2">No pending bookings</p>
                  <p className="text-sm">All bookings have been assigned to trips or delivered.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
