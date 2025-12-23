import React, { useState, useEffect } from 'react';
import { seasonApi } from '../utils/api';

export default function TripCreation() {
  const [formData, setFormData] = useState({
    tripName: '',
    route: '',
    origin: '',
    destination: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    departureDate: '',
    departureTime: '',
    estimatedArrival: '',
    vehicleCapacity: '',
  });

  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [isSeasonActive, setIsSeasonActive] = useState(true);

  useEffect(() => {
    loadSeason();
  }, []);

  const loadSeason = async () => {
    try {
      const response = await seasonApi.get();
      if (response.season && response.season.startDate && response.season.endDate) {
        setSeason(response.season);
        const now = new Date();
        const start = new Date(response.season.startDate);
        const end = new Date(response.season.endDate);
        setIsSeasonActive(now >= start && now <= end);
      }
    } catch (error) {
      console.error('Error loading season:', error);
    }
  };

  const availableBookings = [
    { id: 'BK-001', customer: 'Ramesh Traders', origin: 'Ratnagiri', destination: 'Mumbai', quantity: '500 kg', status: 'confirmed' },
    { id: 'BK-002', customer: 'Aarav Exports', origin: 'Ratnagiri', destination: 'Mumbai', quantity: '750 kg', status: 'confirmed' },
    { id: 'BK-005', customer: 'Priya Fruits', origin: 'Ratnagiri', destination: 'Mumbai', quantity: '300 kg', status: 'confirmed' },
    { id: 'BK-007', customer: 'Sai Traders', origin: 'Ratnagiri', destination: 'Mumbai', quantity: '450 kg', status: 'confirmed' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if season is active
    if (!isSeasonActive) {
      alert('Cannot create trips outside of the season dates. Please contact admin to update season settings.');
      return;
    }
    
    console.log('Trip created:', { ...formData, bookings: selectedBookings });
    alert('Trip created successfully!');
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

  const totalQuantity = availableBookings
    .filter(b => selectedBookings.includes(b.id))
    .reduce((sum, b) => sum + parseInt(b.quantity), 0);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trip Details Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="font-bold text-gray-900 mb-4">Trip Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-2">
                      Trip Name *
                    </label>
                    <input
                      id="tripName"
                      name="tripName"
                      type="text"
                      value={formData.tripName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., Ratnagiri to Mumbai - Dec 21"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="origin" className="block text-sm font-medium text-gray-700 mb-2">
                      Origin *
                    </label>
                    <input
                      id="origin"
                      name="origin"
                      type="text"
                      value={formData.origin}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., Ratnagiri"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-2">
                      Destination *
                    </label>
                    <input
                      id="destination"
                      name="destination"
                      type="text"
                      value={formData.destination}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., Mumbai"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-bold text-gray-900 mb-4">Vehicle & Driver</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Number *
                    </label>
                    <input
                      id="vehicleNumber"
                      name="vehicleNumber"
                      type="text"
                      value={formData.vehicleNumber}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., MH-12-AB-1234"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="vehicleCapacity" className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Capacity (kg) *
                    </label>
                    <input
                      id="vehicleCapacity"
                      name="vehicleCapacity"
                      type="number"
                      value={formData.vehicleCapacity}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., 5000"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="driverName" className="block text-sm font-medium text-gray-700 mb-2">
                      Driver Name *
                    </label>
                    <input
                      id="driverName"
                      name="driverName"
                      type="text"
                      value={formData.driverName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., Suresh Kumar"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="driverPhone" className="block text-sm font-medium text-gray-700 mb-2">
                      Driver Phone *
                    </label>
                    <input
                      id="driverPhone"
                      name="driverPhone"
                      type="tel"
                      value={formData.driverPhone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., +91 98765 43210"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-bold text-gray-900 mb-4">Schedule</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="departureDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Departure Date *
                    </label>
                    <input
                      id="departureDate"
                      name="departureDate"
                      type="date"
                      value={formData.departureDate}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="departureTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Departure Time *
                    </label>
                    <input
                      id="departureTime"
                      name="departureTime"
                      type="time"
                      value={formData.departureTime}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="estimatedArrival" className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Arrival
                    </label>
                    <input
                      id="estimatedArrival"
                      name="estimatedArrival"
                      type="datetime-local"
                      value={formData.estimatedArrival}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                Create Trip
              </button>
            </form>
          </div>
        </div>

        {/* Booking Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Assign Bookings</h2>
              <p className="text-sm text-gray-600 mt-1">Select bookings to include in this trip</p>
            </div>
            
            <div className="p-4 bg-orange-50 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Load</span>
                <span className="font-bold text-orange-600">{totalQuantity} kg</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-gray-700">Selected</span>
                <span className="font-bold text-gray-900">{selectedBookings.length} bookings</span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-200">
              {availableBookings.map((booking) => (
                <label
                  key={booking.id}
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedBookings.includes(booking.id)}
                    onChange={() => toggleBooking(booking.id)}
                    className="mt-1 w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{booking.customer}</p>
                    <p className="text-xs text-gray-600 mt-1">{booking.id}</p>
                    <p className="text-xs text-gray-600">{booking.origin} → {booking.destination}</p>
                    <p className="text-xs font-medium text-orange-600 mt-1">{booking.quantity}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
