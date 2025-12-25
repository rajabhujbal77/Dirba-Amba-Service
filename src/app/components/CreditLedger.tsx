import React, { useState, useEffect } from 'react';
import { creditApi } from '../utils/api';
import { jsPDF } from 'jspdf';

export default function CreditLedger() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [creditAccounts, setCreditAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState({ totalCredit: 0, totalAdvancePaid: 0, totalNetOutstanding: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCreditData();
  }, []);

  const loadCreditData = async () => {
    try {
      const { accounts, totalCredit, totalAdvancePaid, totalNetOutstanding } = await creditApi.getCreditSummary();
      setCreditAccounts(accounts);
      setTotals({ totalCredit, totalAdvancePaid, totalNetOutstanding });
    } catch (error) {
      console.error('Error loading credit data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedAccount = () => {
    return creditAccounts.find(a => a.id === selectedCustomer);
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const account = getSelectedAccount();
    if (!account) return;

    setIsProcessing(true);
    try {
      // Record advance payment
      const { payment } = await creditApi.recordPayment({
        customer_name: account.customer,
        customer_phone: account.phone,
        amount: amount,
        payment_method: paymentMethod,
        notes: paymentNotes
      });

      // Generate and download receipt
      generatePaymentReceipt(payment, account);

      alert(`Payment of ₹${amount.toLocaleString('en-IN')} recorded! Receipt: ${payment.receipt_number}`);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');

      // Refresh data
      setIsLoading(true);
      await loadCreditData();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePaymentReceipt = (payment: any, account: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(247, 137, 30);
    doc.text('DRT MANGO TRANSPORT', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('ADVANCE PAYMENT RECEIPT', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Receipt details
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt No: ${payment.receipt_number}`, 15, y);
    y += 8;
    doc.text(`Date: ${new Date(payment.payment_date).toLocaleDateString('en-IN')}`, 15, y);
    y += 12;

    // Customer
    doc.setFont('helvetica', 'bold');
    doc.text(`Customer: ${account.customer}`, 15, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`Phone: ${account.phone}`, 15, y);
    y += 12;

    // Credit Summary Box
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, y, pageWidth - 30, 45, 3, 3, 'F');
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Credit Summary', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Credit:`, 25, y);
    doc.text(`₹${account.totalCredit.toLocaleString('en-IN')}`, pageWidth - 25, y, { align: 'right' });
    y += 8;
    doc.text(`Advance Paid (including this):`, 25, y);
    const newAdvance = account.advancePaid + Number(payment.amount);
    doc.text(`₹${newAdvance.toLocaleString('en-IN')}`, pageWidth - 25, y, { align: 'right' });
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`Net Outstanding:`, 25, y);
    const netOutstanding = Math.max(0, account.totalCredit - newAdvance);
    doc.text(`₹${netOutstanding.toLocaleString('en-IN')}`, pageWidth - 25, y, { align: 'right' });
    y += 15;

    // This Payment
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(14);
    doc.text(`THIS PAYMENT: ₹${Number(payment.amount).toLocaleString('en-IN')}`, pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Payment Method: ${payment.payment_method?.toUpperCase() || 'CASH'}`, pageWidth / 2, y, { align: 'center' });

    doc.save(`${payment.receipt_number}.pdf`);
  };

  // Build transactions from selected account's bookings and payments
  const transactions = selectedCustomer
    ? [
      // Bookings as debit
      ...(getSelectedAccount()?.bookings || []).map((b: any) => ({
        id: b.id,
        type: 'debit',
        amount: b.amount,
        description: `Booking ${b.receiptNumber || b.id}`,
        date: b.date,
        destination: b.destination
      })),
      // Payments as credit
      ...(getSelectedAccount()?.payments || []).map((p: any) => ({
        id: p.id,
        type: 'credit',
        amount: p.amount,
        description: `Payment ${p.receiptNumber || ''}`,
        date: p.date,
        method: p.method
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const filteredAccounts = creditAccounts.filter(account =>
    (account.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCredit = totals.totalCredit;
  const totalAdvancePaid = totals.totalAdvancePaid;
  const totalNetOutstanding = totals.totalNetOutstanding;

  if (isLoading) return <div className="p-8">Loading credit data...</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Credit Ledger</h1>
        <p className="text-gray-600">Manage customer credit accounts and payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Credit Issued</p>
          <p className="text-2xl font-bold text-gray-900">₹{(totalCredit / 100000).toFixed(2)}L</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Advance Paid</p>
          <p className="text-2xl font-bold text-green-600">₹{totalAdvancePaid >= 100000 ? (totalAdvancePaid / 100000).toFixed(2) + 'L' : totalAdvancePaid.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Net Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">₹{totalNetOutstanding >= 100000 ? (totalNetOutstanding / 100000).toFixed(2) + 'L' : totalNetOutstanding.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credit Accounts List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Credit Accounts</h2>
                <button className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                  Add New Account
                </button>
              </div>
              <input
                type="text"
                placeholder="Search by customer name or account ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-6 cursor-pointer transition-colors ${selectedCustomer === account.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                    }`}
                  onClick={() => setSelectedCustomer(account.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{account.customer}</p>
                      <p className="text-sm text-gray-600">{account.id}</p>
                      <p className="text-xs text-gray-500">{account.phone}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${account.outstanding === 0
                      ? 'bg-green-100 text-green-700'
                      : account.outstanding > account.creditLimit * 0.8
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                      }`}>
                      {account.netOutstanding === 0 ? 'Clear' : 'Outstanding'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Total Credit</p>
                      <p className="font-medium text-gray-900">₹{(account.totalCredit || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Advance Paid</p>
                      <p className="font-medium text-green-600">₹{(account.advancePaid || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Net Outstanding</p>
                      <p className="font-medium text-orange-600">₹{(account.netOutstanding || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Bookings</p>
                      <p className="font-medium text-gray-900">{account.bookingCount || 0}</p>
                    </div>
                  </div>

                  {/* Payment Progress Bar */}
                  {account.totalCredit > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Payment Progress</span>
                        <span>{Math.round(((account.advancePaid || 0) / account.totalCredit) * 100)}% paid</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${((account.advancePaid || 0) / account.totalCredit) > 0.8
                            ? 'bg-green-500'
                            : ((account.advancePaid || 0) / account.totalCredit) > 0.5
                              ? 'bg-yellow-500'
                              : 'bg-orange-500'
                            }`}
                          style={{ width: `${Math.min(((account.advancePaid || 0) / account.totalCredit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{account.bookingCount || 0} bookings</span>
                    {account.lastPayment && (
                      <span>Last: {new Date(account.lastPayment).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short'
                      })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">
                {selectedCustomer ? 'Account Transactions' : 'Recent Transactions'}
              </h2>
              {selectedCustomer && (
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-sm text-orange-600 hover:text-orange-700 mt-2"
                >
                  ← View all transactions
                </button>
              )}
            </div>

            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-200">
              {transactions.length > 0 ? transactions.map((transaction: any) => (
                <div key={transaction.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-xs text-gray-600">{transaction.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(transaction.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${transaction.type === 'credit' ? 'text-green-600' : 'text-orange-600'}`}>
                        {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-sm">Select a customer to view transactions</p>
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                >
                  Record Payment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Record Advance Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-600">
                Customer: <strong>{getSelectedAccount()?.customer}</strong>
              </p>
              <div className="mt-2 bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span>Total Credit:</span>
                  <span className="font-medium">₹{(getSelectedAccount()?.totalCredit || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Advance Paid:</span>
                  <span className="font-medium text-green-600">₹{(getSelectedAccount()?.advancePaid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t mt-2 pt-2">
                  <span>Net Outstanding:</span>
                  <span className="text-orange-600">₹{(getSelectedAccount()?.netOutstanding || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g., Season 2024 partial payment"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!paymentAmount || isProcessing}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
