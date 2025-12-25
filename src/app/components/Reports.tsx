import React, { useState, useEffect } from 'react';
import { reportsApi } from '../utils/api';
import { jsPDF } from 'jspdf';

interface BookingSummary {
  totalBookings: number;
  bookedCount: number;
  inTransitCount: number;
  deliveredCount: number;
  pendingCount: number;
  totalRevenue: number;
  totalPackages: number;
  revenueByMethod: {
    cash: number;
    online: number;
    to_pay: number;
    credit: number;
  };
}

interface TripSummary {
  totalTrips: number;
  completedTrips: number;
  activeTrips: number;
  pendingTrips: number;
  totalTripCost: number;
}

interface Customer {
  name: string;
  phone: string;
  bookings: number;
  revenue: number;
}

interface Route {
  route: string;
  trips: number;
  revenue: number;
}

interface ReportsProps {
  assignedDepotId?: string | null;
}

export default function Reports({ assignedDepotId }: ReportsProps) {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [reportType, setReportType] = useState('bookings');
  const [isLoading, setIsLoading] = useState(true);

  const [bookingSummary, setBookingSummary] = useState<BookingSummary>({
    totalBookings: 0,
    bookedCount: 0,
    inTransitCount: 0,
    deliveredCount: 0,
    pendingCount: 0,
    totalRevenue: 0,
    totalPackages: 0,
    revenueByMethod: { cash: 0, online: 0, to_pay: 0, credit: 0 }
  });

  const [tripSummary, setTripSummary] = useState<TripSummary>({
    totalTrips: 0,
    completedTrips: 0,
    activeTrips: 0,
    pendingTrips: 0,
    totalTripCost: 0
  });

  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const [topRoutes, setTopRoutes] = useState<Route[]>([]);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    setIsLoading(true);
    try {
      const fromDate = dateRange.from || undefined;
      const toDate = dateRange.to || undefined;

      const [bookingRes, tripRes, customersRes, routesRes] = await Promise.all([
        reportsApi.getBookingSummary(fromDate, toDate),
        reportsApi.getTripSummary(fromDate, toDate),
        reportsApi.getTopCustomers(5, fromDate, toDate),
        reportsApi.getTopRoutes(5, fromDate, toDate)
      ]);

      setBookingSummary(bookingRes);
      setTripSummary(tripRes);
      setTopCustomers(customersRes.customers);
      setTopRoutes(routesRes.routes);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = () => {
    loadReportsData();
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DRT Mango Transport - Reports', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Date range
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateText = dateRange.from && dateRange.to
      ? `Period: ${dateRange.from} to ${dateRange.to}`
      : 'Period: All Time';
    doc.text(dateText, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Booking Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Booking Summary', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Bookings: ${bookingSummary.totalBookings}`, 14, y); y += 6;
    doc.text(`Delivered: ${bookingSummary.deliveredCount}`, 14, y); y += 6;
    doc.text(`In Transit: ${bookingSummary.inTransitCount}`, 14, y); y += 6;
    doc.text(`Booked (Pending): ${bookingSummary.bookedCount}`, 14, y); y += 6;
    doc.text(`Total Revenue: ${formatCurrency(bookingSummary.totalRevenue)}`, 14, y); y += 6;
    doc.text(`Total Packages: ${bookingSummary.totalPackages}`, 14, y); y += 12;

    // Trip Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Trip Summary', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Trips: ${tripSummary.totalTrips}`, 14, y); y += 6;
    doc.text(`Completed: ${tripSummary.completedTrips}`, 14, y); y += 6;
    doc.text(`Active: ${tripSummary.activeTrips}`, 14, y); y += 6;
    doc.text(`Total Trip Cost: ${formatCurrency(tripSummary.totalTripCost)}`, 14, y); y += 12;

    // Revenue by Payment Method
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Revenue by Payment Method', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cash: ${formatCurrency(bookingSummary.revenueByMethod.cash)}`, 14, y); y += 6;
    doc.text(`Online: ${formatCurrency(bookingSummary.revenueByMethod.online)}`, 14, y); y += 6;
    doc.text(`To Pay: ${formatCurrency(bookingSummary.revenueByMethod.to_pay)}`, 14, y); y += 6;
    doc.text(`Credit: ${formatCurrency(bookingSummary.revenueByMethod.credit)}`, 14, y); y += 12;

    // Top Customers
    if (topCustomers.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Customers', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      topCustomers.forEach((c, i) => {
        doc.text(`${i + 1}. ${c.name} - ${c.bookings} bookings - ${formatCurrency(c.revenue)}`, 14, y);
        y += 6;
      });
      y += 6;
    }

    // Top Routes
    if (topRoutes.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Routes', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      topRoutes.forEach((r, i) => {
        doc.text(`${i + 1}. ${r.route} - ${r.trips} bookings - ${formatCurrency(r.revenue)}`, 14, y);
        y += 6;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 285);

    doc.save(`DRT_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    // Create CSV content
    let csv = 'DRT Mango Transport - Reports\n\n';

    // Booking Summary
    csv += 'BOOKING SUMMARY\n';
    csv += `Total Bookings,${bookingSummary.totalBookings}\n`;
    csv += `Delivered,${bookingSummary.deliveredCount}\n`;
    csv += `In Transit,${bookingSummary.inTransitCount}\n`;
    csv += `Booked (Pending),${bookingSummary.bookedCount}\n`;
    csv += `Total Revenue,${bookingSummary.totalRevenue}\n`;
    csv += `Total Packages,${bookingSummary.totalPackages}\n\n`;

    // Trip Summary
    csv += 'TRIP SUMMARY\n';
    csv += `Total Trips,${tripSummary.totalTrips}\n`;
    csv += `Completed,${tripSummary.completedTrips}\n`;
    csv += `Active,${tripSummary.activeTrips}\n`;
    csv += `Total Trip Cost,${tripSummary.totalTripCost}\n\n`;

    // Revenue by Method
    csv += 'REVENUE BY PAYMENT METHOD\n';
    csv += `Cash,${bookingSummary.revenueByMethod.cash}\n`;
    csv += `Online,${bookingSummary.revenueByMethod.online}\n`;
    csv += `To Pay,${bookingSummary.revenueByMethod.to_pay}\n`;
    csv += `Credit,${bookingSummary.revenueByMethod.credit}\n\n`;

    // Top Customers
    csv += 'TOP CUSTOMERS\n';
    csv += 'Rank,Name,Phone,Bookings,Revenue\n';
    topCustomers.forEach((c, i) => {
      csv += `${i + 1},${c.name},${c.phone},${c.bookings},${c.revenue}\n`;
    });
    csv += '\n';

    // Top Routes
    csv += 'TOP ROUTES\n';
    csv += 'Rank,Route,Bookings,Revenue\n';
    topRoutes.forEach((r, i) => {
      csv += `${i + 1},"${r.route}",${r.trips},${r.revenue}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DRT_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

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
            <button
              onClick={handleGenerateReport}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
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
              <span className="text-gray-600">Delivered</span>
              <span className="font-bold text-green-600">{bookingSummary.deliveredCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">In Transit</span>
              <span className="font-bold text-blue-600">{bookingSummary.inTransitCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Booked (Pending)</span>
              <span className="font-bold text-yellow-600">{bookingSummary.bookedCount}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(bookingSummary.totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Packages</span>
                <span className="font-bold text-gray-900">
                  {bookingSummary.totalPackages}
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
              <span className="text-gray-600">Pending</span>
              <span className="font-bold text-yellow-600">{tripSummary.pendingTrips}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Trip Cost</span>
                <span className="font-bold text-orange-600">{formatCurrency(tripSummary.totalTripCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue by Payment Method */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Revenue by Payment Method</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Cash</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(bookingSummary.revenueByMethod.cash)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Online</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(bookingSummary.revenueByMethod.online)}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">To Pay</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(bookingSummary.revenueByMethod.to_pay)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">Credit</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(bookingSummary.revenueByMethod.credit)}</p>
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
            {topCustomers.length > 0 ? topCustomers.map((customer, index) => (
              <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-orange-600">{index + 1}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{customer.name}</span>
                      <p className="text-xs text-gray-500">{customer.phone}</p>
                    </div>
                  </div>
                  <span className="font-bold text-orange-600">
                    {formatCurrency(customer.revenue)}
                  </span>
                </div>
                <div className="ml-11">
                  <span className="text-sm text-gray-600">{customer.bookings} bookings</span>
                </div>
              </div>
            )) : (
              <div className="p-6 text-center text-gray-500">
                No customers found
              </div>
            )}
          </div>
        </div>

        {/* Top Routes */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Top Routes</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {topRoutes.length > 0 ? topRoutes.map((route, index) => (
              <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-blue-600">{index + 1}</span>
                    </div>
                    <span className="font-medium text-gray-900">{route.route}</span>
                  </div>
                  <span className="font-bold text-orange-600">
                    {formatCurrency(route.revenue)}
                  </span>
                </div>
                <div className="ml-11">
                  <span className="text-sm text-gray-600">{route.trips} bookings</span>
                </div>
              </div>
            )) : (
              <div className="p-6 text-center text-gray-500">
                No routes found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={exportToPDF}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Export as PDF
        </button>
        <button
          onClick={exportToExcel}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Export as Excel
        </button>
      </div>
    </div>
  );
}

