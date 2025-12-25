import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { bookingsApi } from '../utils/api';

interface AllReceiptsProps {
  assignedDepotId?: string | null;
}

export default function AllReceipts({ assignedDepotId }: AllReceiptsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      const { bookings } = await bookingsApi.getAll();

      // Map bookings to receipt format
      let mappedReceipts = (bookings || []).map((b: any) => ({
        id: b.receipt_number || b.id,
        bookingId: b.id,
        customer: b.sender_name || b.customer_name || 'N/A',
        customerPhone: b.sender_phone || b.customer_phone || '',
        destination: b.destination_depot_name || b.destination_location || 'N/A',
        date: b.created_at,
        amount: Number(b.total_amount) || 0,
        paymentMode: b.payment_method?.replace('_', ' ')?.toUpperCase() || 'Cash',
        status: b.payment_method === 'credit' || b.payment_method === 'to_pay' ? 'pending' : 'paid',
        invoiceNumber: b.receipt_number || b.id,
        receivers: b.receivers || [],
        destination_depot_id: b.destination_depot_id,
        origin_depot_id: b.origin_depot_id
      }));

      // Filter for depot managers
      if (assignedDepotId) {
        mappedReceipts = mappedReceipts.filter((r: any) =>
          r.destination_depot_id === assignedDepotId ||
          r.origin_depot_id === assignedDepotId
        );
      }

      setReceipts(mappedReceipts);
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (receipt: any) => {
    setSelectedReceipt(receipt);
    setShowModal(true);
  };

  const handlePrint = (receipt: any) => {
    setSelectedReceipt(receipt);
    setShowModal(true);
    setTimeout(() => window.print(), 100);
  };

  const handleDownload = (receipt: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(247, 137, 30);
    doc.text('DRT MANGO TRANSPORT', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Receipt Number
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receipt: ${receipt.id}`, 15, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(receipt.date).toLocaleDateString('en-IN')}`, 15, y);
    y += 8;
    doc.text(`Destination: ${receipt.destination}`, 15, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Customer: ${receipt.customer}`, 15, y);
    doc.setFont('helvetica', 'normal');
    if (receipt.customerPhone) {
      doc.text(`  (${receipt.customerPhone})`, 15 + doc.getTextWidth(`Customer: ${receipt.customer}`), y);
    }
    y += 12;

    // Receivers & Packages
    if (receipt.receivers && receipt.receivers.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('RECEIVERS & PACKAGES', 15, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      receipt.receivers.forEach((r: any, i: number) => {
        doc.text(`${i + 1}. ${r.name} (${r.phone})`, 15, y);
        y += 5;
        r.packages?.forEach((pkg: any) => {
          doc.text(`   ${pkg.size} × ${pkg.quantity} = ₹${(pkg.quantity * pkg.price_per_unit).toFixed(0)}`, 15, y);
          y += 4;
        });
        y += 2;
      });
    }

    // Total
    y += 5;
    doc.setFontSize(12);
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, y - 2, pageWidth - 30, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 20, y + 8);
    doc.setTextColor(22, 163, 74);
    doc.text(`₹${receipt.amount.toLocaleString('en-IN')}`, pageWidth - 20, y + 8, { align: 'right' });

    doc.save(`${receipt.id}.pdf`);
  };

  const filteredReceipts = receipts.filter(receipt => {
    // If no search term, show all
    if (!searchTerm.trim()) {
      const matchesFilter = filterStatus === 'all' || receipt.status === filterStatus;
      return matchesFilter;
    }

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (receipt.customer || '').toLowerCase().includes(searchLower) ||
      (receipt.bookingId || '').toLowerCase().includes(searchLower) ||
      (receipt.id || '').toLowerCase().includes(searchLower) ||
      (receipt.destination || '').toLowerCase().includes(searchLower);
    const matchesFilter = filterStatus === 'all' || receipt.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
  const paidAmount = filteredReceipts.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
  const pendingAmount = filteredReceipts.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);

  if (isLoading) return <div className="p-8">Loading receipts...</div>;

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
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${receipt.status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                      }`}>
                      {receipt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(receipt)}
                        className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handlePrint(receipt)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Print
                      </button>
                      <button
                        onClick={() => handleDownload(receipt)}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                      >
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

      {/* View Modal */}
      {showModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:bg-white print:relative">
          <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto print:rounded-none print:max-w-full print:mx-0">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <h2 className="text-xl font-bold text-gray-900">Receipt Details</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-orange-500">DRT MANGO TRANSPORT</h3>
              <p className="text-lg font-medium mt-2">{selectedReceipt.id}</p>
              <p className="text-sm text-gray-600">{new Date(selectedReceipt.date).toLocaleDateString('en-IN')}</p>
            </div>

            <div className="space-y-3 border-t border-b py-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Destination:</span>
                <span className="font-medium">{selectedReceipt.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{selectedReceipt.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Mode:</span>
                <span className="font-medium">{selectedReceipt.paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${selectedReceipt.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                  {selectedReceipt.status.toUpperCase()}
                </span>
              </div>
            </div>

            {selectedReceipt.receivers && selectedReceipt.receivers.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Receivers & Packages:</h4>
                {selectedReceipt.receivers.map((r: any, i: number) => (
                  <div key={i} className="ml-2 mb-2">
                    <p className="font-medium">{r.name} ({r.phone})</p>
                    {r.packages?.map((pkg: any, j: number) => (
                      <p key={j} className="text-sm text-gray-600 ml-4">
                        {pkg.size} × {pkg.quantity} = ₹{(pkg.quantity * pkg.price_per_unit).toFixed(0)}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 bg-yellow-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">TOTAL:</span>
                <span className="text-2xl font-bold text-green-600">₹{selectedReceipt.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Print
              </button>
              <button
                onClick={() => handleDownload(selectedReceipt)}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
