import React, { useState, useEffect } from 'react';
// jsPDF is dynamically imported when needed to reduce bundle size
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
        booking_status: b.status, // Track actual booking status
        invoiceNumber: b.receipt_number || b.id,
        receivers: b.receivers || [],
        destination_depot_id: b.destination_depot_id,
        origin_depot_id: b.origin_depot_id
      }));

      // Filter for depot managers - exclude bookings not yet added to trips
      if (assignedDepotId) {
        mappedReceipts = mappedReceipts.filter((r: any) =>
          (r.destination_depot_id === assignedDepotId ||
            r.origin_depot_id === assignedDepotId) &&
          r.booking_status !== 'booked' // Only show bookings in trips
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

  const handleDownload = async (receipt: any) => {
    // Dynamically import jsPDF to reduce bundle size
    const { jsPDF } = await import('jspdf');
    // A5 size landscape: 210mm x 148mm
    const doc = new jsPDF({ format: 'a5', unit: 'mm', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 12;

    // ============ HEADER ============
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DIRBA AMBA SERVICE', pageWidth / 2, y, { align: 'center' });
    y += 5;

    // Address line
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('AT POST JAMSANDE, TAL.DEVGAD, DIST. SINDHUDURG | MOB: 9422584166, 9422435348', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 6;

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Receipt Number & Date row
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt No: ${receipt.id}`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(receipt.date).toLocaleDateString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
    y += 7;

    // ============ DESTINATION ============
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Destination: ${receipt.destination || 'N/A'}`, margin, y);
    y += 6;

    // ============ SENDER ============
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sender: ${receipt.customer || 'N/A'} (${receipt.customerPhone || 'N/A'})`, margin, y);
    y += 8;

    // ============ PROFESSIONAL TABLE ============
    const tableMargin = margin;
    const tableWidth = pageWidth - (2 * tableMargin);
    const colWidths = {
      srNo: 12,
      receiver: 55,
      packageSize: 40,
      qty: 20,
      amount: tableWidth - 12 - 55 - 40 - 20
    };
    const rowHeight = 7;
    const maxY = pageHeight - 35;

    // Table Header
    doc.setFillColor(51, 51, 51);
    doc.rect(tableMargin, y, tableWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    let xPos = tableMargin + 3;
    doc.text('Sr.', xPos, y + 5);
    xPos += colWidths.srNo;
    doc.text('Receiver', xPos, y + 5);
    xPos += colWidths.receiver;
    doc.text('Package Size', xPos, y + 5);
    xPos += colWidths.packageSize;
    doc.text('Qty', xPos, y + 5);
    xPos += colWidths.qty;
    doc.text('Amount', xPos, y + 5);
    y += rowHeight;

    // Table Body
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    let rowIndex = 0;
    let grandTotal = 0;

    if (receipt.receivers && receipt.receivers.length > 0) {
      receipt.receivers.forEach((r: any) => {
        if (r.packages && r.packages.length > 0) {
          r.packages.forEach((pkg: any, pkgIndex: number) => {
            if (y > maxY) {
              doc.addPage();
              y = 15;
            }

            rowIndex++;
            const amount = pkg.quantity * pkg.price_per_unit;
            grandTotal += amount;

            // Alternating row colors
            if (rowIndex % 2 === 0) {
              doc.setFillColor(248, 248, 248);
              doc.rect(tableMargin, y, tableWidth, rowHeight, 'F');
            }

            // Row border
            doc.setDrawColor(220, 220, 220);
            const currentRowHeight = pkgIndex === 0 ? rowHeight + 3 : rowHeight; // Extra height for receiver info
            doc.rect(tableMargin, y, tableWidth, currentRowHeight, 'S');

            doc.setFontSize(9);
            xPos = tableMargin + 3;
            doc.text(`${rowIndex}`, xPos, y + 5);
            xPos += colWidths.srNo;

            // Show receiver name and phone on first package row
            if (pkgIndex === 0) {
              const receiverDisplay = `${r.name || 'N/A'}`.substring(0, 22);
              doc.setFont('helvetica', 'bold');
              doc.text(receiverDisplay, xPos, y + 4);
              // Phone number on second line
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100, 100, 100);
              doc.text(`${r.phone || ''}`, xPos, y + 8);
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(9);
            }
            xPos += colWidths.receiver;
            doc.text(pkg.size || 'N/A', xPos, y + 5);
            xPos += colWidths.packageSize;
            doc.text(`${pkg.quantity}`, xPos, y + 5);
            xPos += colWidths.qty;
            doc.text(`₹${amount.toFixed(0)}`, xPos, y + 5);
            y += currentRowHeight;
          });
        }
      });
    }

    // Use receipt amount if grandTotal is 0 (fallback)
    if (grandTotal === 0) {
      grandTotal = receipt.amount || 0;
    }

    // ============ TOTAL ROW (Part of table) ============
    doc.setFillColor(51, 51, 51);
    doc.rect(tableMargin, y, tableWidth, rowHeight + 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');

    doc.text(`Payment: ${receipt.paymentMode || 'CASH'}`, tableMargin + 3, y + 6);
    // Align total under the Amount column
    const totalXPos = tableMargin + colWidths.srNo + colWidths.receiver + colWidths.packageSize + colWidths.qty + 3;
    doc.text(`TOTAL: ₹${grandTotal.toLocaleString('en-IN')}`, totalXPos, y + 6);
    y += rowHeight + 8;
    doc.setTextColor(0, 0, 0);

    // ============ THANK YOU MESSAGE ============
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for choosing Dirba Amba Service!', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    // ============ SIGNATURE LINE ============
    const signLineWidth = 45;
    const signLineX = pageWidth - margin - signLineWidth;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.4);
    doc.line(signLineX, y, signLineX + signLineWidth, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Authorized Signature', signLineX + signLineWidth / 2, y, { align: 'center' });

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
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">All Receipts</h1>
        <p className="text-gray-600">View and manage all payment receipts</p>
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

      {/* Receipts Table - Desktop */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:block">
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

      {/* Receipts Cards - Mobile */}
      <div className="md:hidden space-y-4">
        {filteredReceipts.map((receipt) => (
          <div key={receipt.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-gray-900">{receipt.id}</p>
                <p className="text-xs text-gray-500">{new Date(receipt.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${receipt.status === 'paid'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
                }`}>
                {receipt.status}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Customer</span>
                <span className="text-sm font-medium text-gray-900">{receipt.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Amount</span>
                <span className="text-sm font-bold text-gray-900">₹{receipt.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment</span>
                <span className="text-sm text-gray-900">{receipt.paymentMode}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleView(receipt)}
                className="flex-1 py-2 text-sm text-orange-600 bg-orange-50 rounded-lg font-medium"
              >
                View
              </button>
              <button
                onClick={() => handlePrint(receipt)}
                className="flex-1 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg font-medium"
              >
                Print
              </button>
              <button
                onClick={() => handleDownload(receipt)}
                className="flex-1 py-2 text-sm text-green-600 bg-green-50 rounded-lg font-medium"
              >
                Download
              </button>
            </div>
          </div>
        ))}

        {filteredReceipts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
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
              <h3 className="text-2xl font-bold text-orange-500">DIRBA AMBA SERVICE</h3>
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
