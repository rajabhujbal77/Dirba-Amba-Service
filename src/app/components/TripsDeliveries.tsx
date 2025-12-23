import React, { useState } from 'react';

interface TripsDeliveriesProps {
  userRole: 'owner' | 'booking_clerk' | 'depot_manager';
}

export default function TripsDeliveries({ userRole }: TripsDeliveriesProps) {
  const [activeTab, setActiveTab] = useState<'trips' | 'deliveries'>('trips');
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);

  const trips = [
    { 
      id: 'TR-101', 
      name: 'Ratnagiri to Mumbai - Dec 21',
      route: 'Ratnagiri → Mumbai', 
      driver: 'Suresh Kumar', 
      vehicle: 'MH-12-AB-1234', 
      bookings: 8,
      totalWeight: '2400 kg',
      status: 'in_progress',
      departure: '2025-12-21 06:00',
      eta: '2025-12-21 14:00',
      currentLocation: 'Kolad'
    },
    { 
      id: 'TR-102', 
      name: 'Devgad to Pune - Dec 21',
      route: 'Devgad → Pune', 
      driver: 'Amit Patil', 
      vehicle: 'MH-14-CD-5678', 
      bookings: 5,
      totalWeight: '1800 kg',
      status: 'loading',
      departure: '2025-12-21 08:00',
      eta: '2025-12-21 18:00',
      currentLocation: 'Devgad Depot'
    },
    { 
      id: 'TR-103', 
      name: 'Ratnagiri to Delhi - Dec 20',
      route: 'Ratnagiri → Delhi', 
      driver: 'Rajesh Singh', 
      vehicle: 'DL-01-EF-9012', 
      bookings: 12,
      totalWeight: '4200 kg',
      status: 'completed',
      departure: '2025-12-20 05:00',
      eta: '2025-12-21 11:00',
      currentLocation: 'Delhi'
    },
  ];

  const deliveries = [
    {
      id: 'BK-001',
      tripId: 'TR-101',
      customer: 'Ramesh Traders',
      destination: 'Mumbai - Dadar',
      quantity: '500 kg',
      status: 'in_transit',
      expectedDelivery: '2025-12-21 14:30',
      contactPerson: 'Ramesh Kumar',
      contactPhone: '+91 98765 12345'
    },
    {
      id: 'BK-002',
      tripId: 'TR-101',
      customer: 'Aarav Exports',
      destination: 'Mumbai - Andheri',
      quantity: '750 kg',
      status: 'in_transit',
      expectedDelivery: '2025-12-21 15:00',
      contactPerson: 'Aarav Mehta',
      contactPhone: '+91 98765 23456'
    },
    {
      id: 'BK-015',
      tripId: 'TR-103',
      customer: 'Delhi Fruits',
      destination: 'Delhi - Azadpur',
      quantity: '1200 kg',
      status: 'delivered',
      expectedDelivery: '2025-12-21 11:30',
      actualDelivery: '2025-12-21 11:15',
      contactPerson: 'Vikram Singh',
      contactPhone: '+91 98111 12345'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
      case 'in_transit':
        return 'bg-blue-100 text-blue-700';
      case 'loading':
        return 'bg-orange-100 text-orange-700';
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Trips & Deliveries</h1>
        <p className="text-gray-600">Track all trips and manage deliveries</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'trips'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All Trips
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'deliveries'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Deliveries
        </button>
      </div>

      {/* Trips View */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          {trips.map((trip) => (
            <div key={trip.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{trip.name}</h3>
                    <p className="text-sm text-gray-600">{trip.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                    {trip.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Driver</p>
                    <p className="text-sm font-medium text-gray-900">{trip.driver}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Vehicle</p>
                    <p className="text-sm font-medium text-gray-900">{trip.vehicle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Load</p>
                    <p className="text-sm font-medium text-gray-900">{trip.totalWeight}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Bookings</p>
                    <p className="text-sm font-medium text-gray-900">{trip.bookings} items</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Departure</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(trip.departure).toLocaleString('en-IN', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current Location</p>
                    <p className="text-sm font-medium text-orange-600">{trip.currentLocation}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ETA</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(trip.eta).toLocaleString('en-IN', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                    View Details
                  </button>
                  <button className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                    Update Status
                  </button>
                </div>
              </div>
            </div>
          ))}
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
                    Booking ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Delivery
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{delivery.id}</p>
                        <p className="text-xs text-gray-500">Trip: {delivery.tripId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{delivery.customer}</p>
                        <p className="text-xs text-gray-500">{delivery.contactPerson}</p>
                        <p className="text-xs text-gray-500">{delivery.contactPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{delivery.destination}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{delivery.quantity}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                        {delivery.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">
                        {new Date(delivery.expectedDelivery).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {delivery.actualDelivery && (
                        <p className="text-xs text-green-600">
                          Delivered: {new Date(delivery.actualDelivery).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {delivery.status !== 'delivered' && (
                        <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                          Mark Delivered
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
