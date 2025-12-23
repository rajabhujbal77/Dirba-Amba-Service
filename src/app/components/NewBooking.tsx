import React, { useState, useEffect } from 'react';
import { bookingsApi, seasonApi } from '../utils/api';

export default function NewBooking() {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    origin: '',
    destination: '',
    quantity: '',
    mangoVariety: 'alphonso',
    pickupDate: '',
    paymentMode: 'cash',
    rate: '',
    advancePayment: '',
    specialInstructions: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if season is active
    if (!isSeasonActive) {
      alert('Cannot create bookings outside of the season dates. Please contact admin to update season settings.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      await bookingsApi.create(formData);
      alert('Booking created successfully!');
      // Reset form
      setFormData({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        origin: '',
        destination: '',
        quantity: '',
        mangoVariety: 'alphonso',
        pickupDate: '',
        paymentMode: 'cash',
        rate: '',
        advancePayment: '',
        specialInstructions: '',
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">New Booking</h1>
        <p className="text-gray-600">Create a new mango transport booking</p>
      </div>

      {/* Season Warning */}
      {!isSeasonActive && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 max-w-4xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-red-800 mb-1">Season Inactive</h3>
              <p className="text-sm text-red-700">
                Bookings cannot be created outside the season dates 
                {season && ` (${new Date(season.startDate).toLocaleDateString('en-IN')} - ${new Date(season.endDate).toLocaleDateString('en-IN')})`}. 
                Please contact the administrator to update season settings.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer Information */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name *
                </label>
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Shipment Details */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">Shipment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="origin" className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Location *
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
                  Delivery Location *
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
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity (kg) *
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 500"
                  required
                />
              </div>
              <div>
                <label htmlFor="mangoVariety" className="block text-sm font-medium text-gray-700 mb-2">
                  Mango Variety *
                </label>
                <select
                  id="mangoVariety"
                  name="mangoVariety"
                  value={formData.mangoVariety}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="alphonso">Alphonso</option>
                  <option value="kesar">Kesar</option>
                  <option value="totapuri">Totapuri</option>
                  <option value="dasheri">Dasheri</option>
                  <option value="langra">Langra</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="pickupDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Date *
                </label>
                <input
                  id="pickupDate"
                  name="pickupDate"
                  type="date"
                  value={formData.pickupDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div>
            <h2 className="font-bold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="paymentMode" className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Mode *
                </label>
                <select
                  id="paymentMode"
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-2">
                  Rate per kg (₹) *
                </label>
                <input
                  id="rate"
                  name="rate"
                  type="number"
                  value={formData.rate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 50"
                  required
                />
              </div>
              <div>
                <label htmlFor="advancePayment" className="block text-sm font-medium text-gray-700 mb-2">
                  Advance Payment (₹)
                </label>
                <input
                  id="advancePayment"
                  name="advancePayment"
                  type="number"
                  value={formData.advancePayment}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 5000"
                />
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label htmlFor="specialInstructions" className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions
            </label>
            <textarea
              id="specialInstructions"
              name="specialInstructions"
              value={formData.specialInstructions}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Any special handling or delivery instructions..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Booking'}
            </button>
            <button
              type="button"
              onClick={() => setFormData({
                customerName: '',
                customerPhone: '',
                customerEmail: '',
                origin: '',
                destination: '',
                quantity: '',
                mangoVariety: 'alphonso',
                pickupDate: '',
                paymentMode: 'cash',
                rate: '',
                advancePayment: '',
                specialInstructions: '',
              })}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Clear Form
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}