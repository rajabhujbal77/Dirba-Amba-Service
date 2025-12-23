import React, { useState } from 'react';

export default function AllReceipts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  const receipts = [
    {
      id: 'RCT-001',
      bookingId: 'BK-001',
      customer: 'Ramesh Traders',
      date: '2025-12-21',
      amount: 25000,
      paymentMode: 'UPI',
      status: 'paid',
      invoiceNumber: 'INV-2025-001'
    },
    {
      id: 'RCT-002',
      bookingId: 'BK-002',
      customer: 'Aarav Exports',
      date: '2025-12-21',
      amount: 37500,
      paymentMode: 'Bank Transfer',
      status: 'paid',
      invoiceNumber: 'INV-2025-002'
    },
    {
      id: 'RCT-003',
      bookingId: 'BK-003',
      customer: 'Krishna Fruits',
      date: '2025-12-20',
      amount: 50000,
      paymentMode: 'Cash',
      status: 'paid',
      invoiceNumber: 'INV-2025-003'
    },
    {
      id: 'RCT-004',
      bookingId: 'BK-004',
      customer: 'Mangesh Suppliers',
      date: '2025-12-20',
      amount: 30000,
      paymentMode: 'Credit',
      status: 'pending',
      invoiceNumber: 'INV-2025-004'
    },
    {
      id: 'RCT-005',
      bookingId: 'BK-005',
      customer: 'Priya Fruits',
      date: '2025-12-19',
      amount: 15000,
      paymentMode: 'UPI',
      status: 'paid',
      invoiceNumber: 'INV-2025-005'
    },
  ];

  const filteredReceipts = receipts.filter(receipt => {
    const matchesSearch = receipt.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         receipt.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         receipt.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || receipt.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
  const paidAmount = filteredReceipts.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const pendingAmount = filteredReceipts.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">All Receipts</h1>
        <p className="text-gray-600">View and manage all payment receipts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">₹{(totalAmount / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Paid Amount</p>
          <p className="text-2xl font-bold text-green-600">₹{(paidAmount / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Pending Amount</p>
          <p className="text-2xl font-bold text-orange-600">₹{(pendingAmount / 1000).toFixed(1)}K</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by customer, booking ID, or receipt number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt Details
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Mode
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
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{receipt.id}</p>
                      <p className="text-sm text-gray-600">{receipt.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">Booking: {receipt.bookingId}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{receipt.customer}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">
                      {new Date(receipt.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-bold text-gray-900">₹{receipt.amount.toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-900">{receipt.paymentMode}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      receipt.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {receipt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        View
                      </button>
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Print
                      </button>
                      <button className="text-sm text-green-600 hover:text-green-700 font-medium">
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReceipts.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500">No receipts found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-3">
        <button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
          Export All Receipts
        </button>
        <button className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
          Generate Receipt
        </button>
      </div>
    </div>
  );
}
