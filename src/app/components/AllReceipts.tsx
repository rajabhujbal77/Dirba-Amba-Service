import React, { useState, useEffect } from 'react';
// jsPDF is dynamically imported when needed to reduce bundle size
import { bookingsApi, depotsApi } from '../utils/api';

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

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({
    sender_name: '',
    sender_phone: '',
    payment_method: 'cash',
    receivers: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handlePrint = async (receipt: any) => {
    // Generate PDF and open for printing (same format as download)
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ format: 'a5', unit: 'mm', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 12;

    // Fetch depot details
    let depotDetails: any = null;
    if (receipt.destination_depot_id) {
      try {
        depotDetails = await depotsApi.getById(receipt.destination_depot_id);
      } catch (error) {
        console.log('Could not fetch depot details:', error);
      }
    }

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DIRBA AMBA SERVICE', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('AT POST JAMSANDE, TAL.DEVGAD, DIST. SINDHUDURG | MOB: 9422584166, 9422435348', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt No: ${receipt.id}`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(receipt.date).toLocaleDateString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
    y += 7;

    // Destination
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Destination: ${receipt.destination || 'N/A'}`, margin, y);
    y += 5;

    if (depotDetails?.location) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const addressLines = doc.splitTextToSize(depotDetails.location, pageWidth - (2 * margin));
      addressLines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 4;
      });
      doc.setTextColor(0, 0, 0);
    }

    if (depotDetails?.contact_person || depotDetails?.contact_phone) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contactInfo = [depotDetails?.contact_person, depotDetails?.contact_phone].filter(Boolean).join(' - ');
      doc.text(`Contact: ${contactInfo}`, margin, y);
      y += 4;
      doc.setTextColor(0, 0, 0);
    }
    y += 3;

    // Sender
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sender: ${receipt.customer || 'N/A'} (${receipt.customerPhone || 'N/A'})`, margin, y);
    y += 8;

    // Table
    const tableMargin = margin;
    const tableWidth = pageWidth - (2 * tableMargin);
    const colWidths = { srNo: 12, receiver: 55, packageSize: 40, qty: 20, amount: tableWidth - 12 - 55 - 40 - 20 };
    const rowHeight = 7;
    const maxY = pageHeight - 35;

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

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    let rowIndex = 0;
    let grandTotal = 0;

    if (receipt.receivers && receipt.receivers.length > 0) {
      receipt.receivers.forEach((r: any) => {
        if (r.packages && r.packages.length > 0) {
          r.packages.forEach((pkg: any, pkgIndex: number) => {
            if (y > maxY) { doc.addPage(); y = 15; }
            rowIndex++;
            const amount = pkg.quantity * pkg.price_per_unit;
            grandTotal += amount;

            if (rowIndex % 2 === 0) {
              doc.setFillColor(248, 248, 248);
              doc.rect(tableMargin, y, tableWidth, rowHeight, 'F');
            }

            doc.setDrawColor(220, 220, 220);
            const currentRowHeight = pkgIndex === 0 ? rowHeight + 3 : rowHeight;
            doc.rect(tableMargin, y, tableWidth, currentRowHeight, 'S');

            doc.setFontSize(9);
            xPos = tableMargin + 3;
            doc.text(`${rowIndex}`, xPos, y + 5);
            xPos += colWidths.srNo;

            if (pkgIndex === 0) {
              doc.setFont('helvetica', 'bold');
              doc.text(`${r.name || 'N/A'}`.substring(0, 22), xPos, y + 4);
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

    if (grandTotal === 0) grandTotal = receipt.amount || 0;

    // Total row
    doc.setFillColor(51, 51, 51);
    doc.rect(tableMargin, y, tableWidth, rowHeight + 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Payment: ${receipt.paymentMode || 'CASH'}`, tableMargin + 3, y + 6);
    const totalXPos = tableMargin + colWidths.srNo + colWidths.receiver + colWidths.packageSize + colWidths.qty + 3;
    doc.text(`TOTAL: ₹${grandTotal.toLocaleString('en-IN')}`, totalXPos, y + 6);
    y += rowHeight + 8;
    doc.setTextColor(0, 0, 0);

    // Footer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for choosing Dirba Amba Service!', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    const signLineWidth = 45;
    const signLineX = pageWidth - margin - signLineWidth;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.4);
    doc.line(signLineX, y, signLineX + signLineWidth, y);
    y += 4;
    doc.setFontSize(8);
    doc.text('Authorized Signature', signLineX + signLineWidth / 2, y, { align: 'center' });

    // Open PDF in new window for printing
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleEdit = (receipt: any) => {
    // Find the full booking data from receipts to get receivers
    const fullReceipt = receipts.find(r => r.bookingId === receipt.bookingId);
    setEditingReceipt(fullReceipt);
    setEditForm({
      sender_name: fullReceipt?.customer || '',
      sender_phone: fullReceipt?.customerPhone || '',
      payment_method: fullReceipt?.paymentMode?.toLowerCase()?.replace(' ', '_') || 'cash',
      receivers: (fullReceipt?.receivers || []).map((r: any) => ({
        name: r.name,
        phone: r.phone,
        address: r.address || '',
        packages: (r.packages || []).map((p: any) => ({
          packageId: p.package_id || '',
          size: p.size,
          quantity: p.quantity,
          price_per_unit: p.price_per_unit || p.price || 0
        }))
      }))
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingReceipt) return;

    setIsSaving(true);
    setEditError(null);

    try {
      // Calculate new total
      let newTotal = 0;
      editForm.receivers.forEach((r: any) => {
        r.packages.forEach((p: any) => {
          newTotal += (Number(p.quantity) || 0) * (Number(p.price_per_unit) || 0);
        });
      });

      await bookingsApi.editDeliveredReceipt(editingReceipt.bookingId, {
        sender_name: editForm.sender_name,
        sender_phone: editForm.sender_phone,
        payment_method: editForm.payment_method,
        total_amount: newTotal,
        receivers: editForm.receivers
      });

      // Refresh receipts list
      await loadReceipts();
      setShowEditModal(false);
      setEditingReceipt(null);
      alert('Receipt updated successfully!');
    } catch (error: any) {
      console.error('Error saving edit:', error);
      setEditError(error.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateEditTotal = () => {
    let total = 0;
    editForm.receivers.forEach((r: any) => {
      r.packages.forEach((p: any) => {
        total += (Number(p.quantity) || 0) * (Number(p.price_per_unit) || 0);
      });
    });
    return total;
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

    // Fetch depot details to get address and contact info
    let depotDetails: any = null;
    if (receipt.destination_depot_id) {
      try {
        depotDetails = await depotsApi.getById(receipt.destination_depot_id);
      } catch (error) {
        console.log('Could not fetch depot details:', error);
      }
    }

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
    y += 5;

    // Show depot address if available
    if (depotDetails?.location) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      // Split long addresses into multiple lines if needed
      const addressLines = doc.splitTextToSize(depotDetails.location, pageWidth - (2 * margin));
      addressLines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 4;
      });
      doc.setTextColor(0, 0, 0);
    }

    // Show depot contact person and phone if available
    if (depotDetails?.contact_person || depotDetails?.contact_phone) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const contactInfo = [
        depotDetails?.contact_person,
        depotDetails?.contact_phone
      ].filter(Boolean).join(' - ');
      doc.text(`Contact: ${contactInfo}`, margin, y);
      y += 4;
      doc.setTextColor(0, 0, 0);
    }
    y += 3;

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
                      {receipt.booking_status === 'delivered' && (
                        <button
                          onClick={() => handleEdit(receipt)}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Edit
                        </button>
                      )}
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

            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
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
              {receipt.booking_status === 'delivered' && (
                <button
                  onClick={() => handleEdit(receipt)}
                  className="flex-1 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg font-medium"
                >
                  Edit
                </button>
              )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="print-content bg-white rounded-xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
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

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handlePrint(selectedReceipt)}
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

      {/* Edit Modal */}
      {showEditModal && editingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Receipt</h2>
                <p className="text-sm text-gray-500">{editingReceipt.id}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {editError}
              </div>
            )}

            {/* Warning for payment method changes */}
            {editForm.payment_method === 'credit' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                ⚠️ This is a credit booking. Changes will affect the customer's ledger balance.
              </div>
            )}

            {/* Sender Info */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-gray-900">Sender Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={editForm.sender_name}
                    onChange={(e) => setEditForm({ ...editForm, sender_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Phone</label>
                  <input
                    type="tel"
                    value={editForm.sender_phone}
                    onChange={(e) => setEditForm({ ...editForm, sender_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={editForm.payment_method}
                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="to_pay">To Pay</option>
              </select>
            </div>

            {/* Receivers & Packages */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Receivers & Packages</h3>
              {editForm.receivers.map((receiver: any, rIndex: number) => (
                <div key={rIndex} className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Receiver Name</label>
                      <input
                        type="text"
                        value={receiver.name}
                        onChange={(e) => {
                          const newReceivers = [...editForm.receivers];
                          newReceivers[rIndex].name = e.target.value;
                          setEditForm({ ...editForm, receivers: newReceivers });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Receiver Phone</label>
                      <input
                        type="tel"
                        value={receiver.phone}
                        onChange={(e) => {
                          const newReceivers = [...editForm.receivers];
                          newReceivers[rIndex].phone = e.target.value;
                          setEditForm({ ...editForm, receivers: newReceivers });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Packages */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-600">Packages</label>
                    {receiver.packages.map((pkg: any, pIndex: number) => (
                      <div key={pIndex} className="flex gap-2 items-center bg-white p-2 rounded border border-gray-200">
                        <input
                          type="text"
                          value={pkg.size}
                          onChange={(e) => {
                            const newReceivers = [...editForm.receivers];
                            newReceivers[rIndex].packages[pIndex].size = e.target.value;
                            setEditForm({ ...editForm, receivers: newReceivers });
                          }}
                          placeholder="Size"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          value={pkg.quantity}
                          onChange={(e) => {
                            const newReceivers = [...editForm.receivers];
                            newReceivers[rIndex].packages[pIndex].quantity = parseInt(e.target.value) || 0;
                            setEditForm({ ...editForm, receivers: newReceivers });
                          }}
                          placeholder="Qty"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-gray-500">×</span>
                        <input
                          type="number"
                          value={pkg.price_per_unit}
                          onChange={(e) => {
                            const newReceivers = [...editForm.receivers];
                            newReceivers[rIndex].packages[pIndex].price_per_unit = parseFloat(e.target.value) || 0;
                            setEditForm({ ...editForm, receivers: newReceivers });
                          }}
                          placeholder="Price"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-gray-600 font-medium">
                          = ₹{((pkg.quantity || 0) * (pkg.price_per_unit || 0)).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">New Total:</span>
                <span className="text-2xl font-bold text-purple-600">
                  ₹{calculateEditTotal().toLocaleString('en-IN')}
                </span>
              </div>
              {calculateEditTotal() !== editingReceipt.amount && (
                <p className="text-sm text-gray-600 mt-1">
                  Original: ₹{editingReceipt.amount.toLocaleString('en-IN')}
                  (Change: {calculateEditTotal() > editingReceipt.amount ? '+' : ''}
                  ₹{(calculateEditTotal() - editingReceipt.amount).toLocaleString('en-IN')})
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
