import React, { useState, useEffect } from 'react';
import { creditApi, packagesApi, depotsApi, depotPricingApi } from '../utils/api';
import { jsPDF } from 'jspdf';

interface CreditLedgerProps {
  assignedDepotId?: string | null;
}

export default function CreditLedger({ assignedDepotId }: CreditLedgerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bookings' | 'payments' | 'pricing' | 'settlement'>('bookings');
  const [creditAccounts, setCreditAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState({ totalCredit: 0, totalAdvancePaid: 0, totalNetOutstanding: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Pricing state
  const [packages, setPackages] = useState<any[]>([]);
  const [depots, setDepots] = useState<any[]>([]);
  const [standardPricing, setStandardPricing] = useState<any[]>([]);
  const [customerPricing, setCustomerPricing] = useState<any[]>([]);
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [discountSummary, setDiscountSummary] = useState<any>(null);

  // Display name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    loadCreditData();
    loadPricingData();
  }, []);

  const loadCreditData = async () => {
    try {
      const { accounts, totalCredit, totalAdvancePaid, totalNetOutstanding } = await creditApi.getCreditSummary(assignedDepotId);
      setCreditAccounts(accounts);
      setTotals({ totalCredit, totalAdvancePaid, totalNetOutstanding });
    } catch (error) {
      console.error('Error loading credit data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPricingData = async () => {
    try {
      const [packagesRes, depotsRes, pricingRes] = await Promise.all([
        packagesApi.getAll(),
        depotsApi.getAll(),
        depotPricingApi.getAll()
      ]);
      setPackages(packagesRes.packages || []);
      setDepots(depotsRes.depots || []);
      setStandardPricing(pricingRes.pricing || []);
    } catch (error) {
      console.error('Error loading pricing data:', error);
    }
  };

  const loadCustomerPricing = async (phone: string) => {
    try {
      const { pricing } = await creditApi.getCustomerPricing(phone);
      setCustomerPricing(pricing);

      // Initialize editing prices
      const editMap: Record<string, number> = {};
      pricing.forEach((p: any) => {
        editMap[`${p.packageId}_${p.depotId}`] = p.discountedPrice;
      });
      setEditingPrices(editMap);

      // Load discount summary
      const summary = await creditApi.getDiscountSummary(phone);
      setDiscountSummary(summary);
    } catch (error) {
      console.error('Error loading customer pricing:', error);
      setCustomerPricing([]);
      setEditingPrices({});
    }
  };

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerPricing(selectedCustomer);
    }
  }, [selectedCustomer]);

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
      const { payment } = await creditApi.recordPayment({
        customer_name: account.customer,
        customer_phone: account.phone,
        amount: amount,
        payment_method: paymentMethod,
        notes: paymentNotes
      });

      generatePaymentReceipt(payment, account);
      alert(`Payment of ₹${amount.toLocaleString('en-IN')} recorded! Receipt: ${payment.receipt_number}`);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      setIsLoading(true);
      await loadCreditData();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!selectedCustomer || !editedName.trim()) return;
    try {
      await creditApi.updateCustomerDisplayName(selectedCustomer, editedName.trim());
      await loadCreditData();
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating name:', error);
      alert('Failed to update name. Please try again.');
    }
  };

  const handlePriceChange = (packageId: string, depotId: string, value: string) => {
    const key = `${packageId}_${depotId}`;
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingPrices(prev => ({ ...prev, [key]: numValue }));
    } else if (value === '') {
      const newPrices = { ...editingPrices };
      delete newPrices[key];
      setEditingPrices(newPrices);
    }
  };

  const handleSavePricing = async () => {
    if (!selectedCustomer) return;
    setIsSavingPrices(true);
    try {
      const pricing = Object.entries(editingPrices).map(([key, price]) => {
        const [packageId, depotId] = key.split('_');
        return { packageId, depotId, discountedPrice: price };
      });
      await creditApi.setCustomerPricing(selectedCustomer, pricing);
      await loadCustomerPricing(selectedCustomer);
      alert('Pricing saved successfully!');
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('Failed to save pricing. Make sure the database tables are created.');
    } finally {
      setIsSavingPrices(false);
    }
  };

  const getStandardPrice = (packageId: string, depotId: string) => {
    const depotPrice = standardPricing.find(p => p.packageId === packageId && p.depotId === depotId);
    if (depotPrice) return depotPrice.price;
    const pkg = packages.find(p => p.id === packageId);
    return pkg?.basePrice || 0;
  };

  // Export customer ledger as CSV
  const exportCustomerLedgerCSV = () => {
    const account = getSelectedAccount();
    if (!account) return;

    // Build CSV rows
    const rows: string[][] = [];

    // Header info
    rows.push(['CREDIT LEDGER STATEMENT']);
    rows.push(['Customer', account.customer]);
    rows.push(['Phone', account.phone]);
    rows.push(['Generated', new Date().toLocaleString('en-IN')]);
    rows.push([]);

    // Summary
    rows.push(['SUMMARY']);
    rows.push(['Total Credit', account.totalCredit]);
    rows.push(['Advance Paid', account.advancePaid]);
    rows.push(['Net Outstanding', account.netOutstanding]);
    rows.push([]);

    // Bookings
    rows.push(['BOOKINGS']);
    rows.push(['Date', 'Receipt No', 'Destination', 'Amount']);
    (account.bookings || []).forEach((b: any) => {
      rows.push([
        new Date(b.date).toLocaleDateString('en-IN'),
        b.receiptNumber || b.id,
        b.destination,
        b.amount
      ]);
    });
    rows.push([]);

    // Payments
    rows.push(['ADVANCE PAYMENTS']);
    rows.push(['Date', 'Receipt No', 'Method', 'Amount']);
    (account.payments || []).forEach((p: any) => {
      rows.push([
        new Date(p.date).toLocaleDateString('en-IN'),
        p.receiptNumber || '-',
        p.method || 'cash',
        p.amount
      ]);
    });

    // Convert to CSV string with UTF-8 BOM for Excel compatibility
    const csvContent = rows.map(row =>
      row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Add UTF-8 BOM for Excel to recognize encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Credit_Ledger_${account.customer.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const generatePaymentReceipt = (payment: any, account: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(247, 137, 30);
    doc.text('DRT MANGO TRANSPORT', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('ADVANCE PAYMENT RECEIPT', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt No: ${payment.receipt_number}`, 15, y);
    y += 8;
    doc.text(`Date: ${new Date(payment.payment_date).toLocaleDateString('en-IN')}`, 15, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text(`Customer: ${account.customer}`, 15, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`Phone: ${account.phone}`, 15, y);
    y += 12;

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

    doc.setTextColor(22, 163, 74);
    doc.setFontSize(14);
    doc.text(`THIS PAYMENT: ₹${Number(payment.amount).toLocaleString('en-IN')}`, pageWidth / 2, y, { align: 'center' });

    doc.save(`${payment.receipt_number}.pdf`);
  };

  // Build transactions from selected account
  const transactions = selectedCustomer
    ? [
      ...(getSelectedAccount()?.bookings || []).map((b: any) => ({
        id: b.id, type: 'debit', amount: b.amount,
        description: `Booking ${b.receiptNumber || b.id}`,
        date: b.date, destination: b.destination
      })),
      ...(getSelectedAccount()?.payments || []).map((p: any) => ({
        id: p.id, type: 'credit', amount: p.amount,
        description: `Payment ${p.receiptNumber || ''}`,
        date: p.date, method: p.method
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const filteredAccounts = creditAccounts.filter(account =>
    (account.customer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedAccount = getSelectedAccount();
  const customerDepots = selectedAccount?.depots || [];
  const relevantDepots = depots.filter(d => customerDepots.includes(d.id));

  if (isLoading) return <div className="p-8">Loading credit data...</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Credit Ledger</h1>
        <p className="text-gray-600">Manage customer credit accounts, pricing, and payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Credit Issued</p>
          <p className="text-2xl font-bold text-gray-900">₹{(totals.totalCredit / 100000).toFixed(2)}L</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Advance Paid</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{totals.totalAdvancePaid >= 100000 ? (totals.totalAdvancePaid / 100000).toFixed(2) + 'L' : totals.totalAdvancePaid.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Net Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">
            ₹{totals.totalNetOutstanding >= 100000 ? (totals.totalNetOutstanding / 100000).toFixed(2) + 'L' : totals.totalNetOutstanding.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credit Accounts List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900 mb-3">Credit Accounts</h2>
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {filteredAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-4 cursor-pointer transition-colors ${selectedCustomer === account.id ? 'bg-orange-50 border-l-4 border-orange-500' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    setSelectedCustomer(account.id);
                    setActiveTab('bookings');
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{account.customer}</p>
                      <p className="text-sm text-orange-600 font-medium">📱 {account.phone}</p>
                      {account.nameVariations?.length > 1 && (
                        <p className="text-xs text-gray-400 mt-1">
                          Also: {account.nameVariations.filter((n: string) => n !== account.customer).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${account.netOutstanding === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                      {account.netOutstanding === 0 ? 'Clear' : '₹' + account.netOutstanding.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{account.bookingCount} bookings</span>
                    <span>{account.depots?.length || 0} depots</span>
                  </div>
                </div>
              ))}
              {filteredAccounts.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No credit accounts found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="lg:col-span-2">
          {selectedAccount ? (
            <div className="bg-white rounded-xl border border-gray-200">
              {/* Customer Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-lg font-bold"
                        autoFocus
                      />
                      <button onClick={handleSaveDisplayName} className="px-3 py-1 bg-green-500 text-white rounded text-sm">Save</button>
                      <button onClick={() => setIsEditingName(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{selectedAccount.customer}</h2>
                      <button
                        onClick={() => { setIsEditingName(true); setEditedName(selectedAccount.customer); }}
                        className="text-sm text-orange-600 hover:text-orange-700"
                      >✏️ Edit</button>
                    </div>
                  )}
                  <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-orange-600 font-medium">📱 {selectedAccount.phone}</p>
                  <button
                    onClick={exportCustomerLedgerCSV}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1"
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                {(['bookings', 'payments', 'pricing', 'settlement'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === tab
                      ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    {tab === 'bookings' && '📦 Bookings'}
                    {tab === 'payments' && '💰 Payments'}
                    {tab === 'pricing' && '⚡ Set Pricing'}
                    {tab === 'settlement' && '📊 Settlement'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6 max-h-[500px] overflow-y-auto">
                {/* Bookings Tab */}
                {activeTab === 'bookings' && (
                  <div className="space-y-3">
                    {selectedAccount.bookings?.map((b: any) => (
                      <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{b.receiptNumber}</p>
                          <p className="text-xs text-gray-500">{new Date(b.date).toLocaleDateString('en-IN')} • {b.destination}</p>
                        </div>
                        <p className="font-bold text-orange-600">₹{b.amount.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                    {!selectedAccount.bookings?.length && (
                      <p className="text-gray-500 text-center py-8">No bookings found</p>
                    )}
                  </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                  <div>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full mb-4 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                    >
                      + Record New Payment
                    </button>
                    <div className="space-y-3">
                      {selectedAccount.payments?.map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{p.receiptNumber || 'Payment'}</p>
                            <p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('en-IN')} • {p.method}</p>
                          </div>
                          <p className="font-bold text-green-600">+₹{p.amount.toLocaleString('en-IN')}</p>
                        </div>
                      ))}
                      {!selectedAccount.payments?.length && (
                        <p className="text-gray-500 text-center py-8">No payments recorded yet</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Pricing Tab */}
                {activeTab === 'pricing' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Set discounted prices</strong> for this customer. Only depots where they have shipped are shown.
                      </p>
                    </div>

                    {relevantDepots.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No shipping history found for this customer.</p>
                    ) : (
                      <>
                        <div className="overflow-y-auto max-h-[400px]">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-100">Depot</th>
                                {packages.map(pkg => (
                                  <th key={pkg.id} className="px-3 py-3 text-center font-semibold text-gray-700 bg-gray-100">
                                    <div>{pkg.name}</div>
                                    <div className="text-xs font-normal text-gray-500">Base: ₹{pkg.basePrice}</div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {relevantDepots.map(depot => (
                                <tr key={depot.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                    {depot.name}
                                  </td>
                                  {packages.map(pkg => {
                                    const key = `${pkg.id}_${depot.id}`;
                                    const standardPrice = getStandardPrice(pkg.id, depot.id);
                                    const currentValue = editingPrices[key];
                                    const hasDiscount = currentValue !== undefined && currentValue < standardPrice;

                                    return (
                                      <td key={pkg.id} className="px-3 py-3 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                          <div className="flex items-center gap-1">
                                            <span className="text-gray-400 text-xs">₹</span>
                                            <input
                                              type="number"
                                              placeholder={String(standardPrice)}
                                              value={currentValue ?? ''}
                                              onChange={(e) => handlePriceChange(pkg.id, depot.id, e.target.value)}
                                              className={`w-16 px-2 py-1 border rounded text-sm text-center ${hasDiscount
                                                ? 'border-orange-500 bg-orange-50 text-orange-900 font-medium'
                                                : 'border-gray-200 bg-gray-50'
                                                }`}
                                            />
                                          </div>
                                          {hasDiscount && (
                                            <span className="text-xs text-green-600">
                                              -₹{(standardPrice - currentValue).toFixed(0)}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleSavePricing}
                            disabled={isSavingPrices}
                            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50"
                          >
                            {isSavingPrices ? 'Saving...' : 'Save Pricing'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Settlement Tab */}
                {activeTab === 'settlement' && (
                  <div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Total Credit</p>
                        <p className="text-xl font-bold text-gray-900">₹{selectedAccount.totalCredit.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-600">Advance Paid</p>
                        <p className="text-xl font-bold text-green-600">₹{selectedAccount.advancePaid.toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    {discountSummary && discountSummary.totalSavings > 0 && (
                      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <h3 className="font-bold text-orange-800 mb-2">💰 Discount Applied</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p className="text-gray-600">Original Total:</p>
                          <p className="text-right">₹{discountSummary.originalTotal.toLocaleString('en-IN')}</p>
                          <p className="text-gray-600">Discounted Total:</p>
                          <p className="text-right font-medium">₹{discountSummary.discountedTotal.toLocaleString('en-IN')}</p>
                          <p className="font-bold text-green-700">Total Savings:</p>
                          <p className="text-right font-bold text-green-700">₹{discountSummary.totalSavings.toLocaleString('en-IN')} ({discountSummary.savingsPercent}%)</p>
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-orange-100 rounded-lg border-2 border-orange-500">
                      <p className="text-sm text-orange-800">Net Outstanding</p>
                      <p className="text-3xl font-bold text-orange-600">₹{selectedAccount.netOutstanding.toLocaleString('en-IN')}</p>
                    </div>

                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full mt-4 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                    >
                      Record Payment
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-4">👈</p>
              <p className="text-gray-500">Select a customer to view details and manage pricing</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Record Advance Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>

            <div className="mb-4 bg-gray-50 rounded-lg p-3">
              <p className="text-sm"><strong>Customer:</strong> {getSelectedAccount()?.customer}</p>
              <p className="text-sm"><strong>Outstanding:</strong> ₹{(getSelectedAccount()?.netOutstanding || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                placeholder="e.g., Season 2024 partial"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >Cancel</button>
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
