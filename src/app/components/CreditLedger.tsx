import React, { useState } from 'react';

export default function CreditLedger() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const creditAccounts = [
    {
      id: 'CA-001',
      customer: 'Ramesh Traders',
      phone: '+91 98765 12345',
      totalCredit: 125000,
      paid: 75000,
      outstanding: 50000,
      lastPayment: '2025-12-15',
      creditLimit: 150000,
      bookings: 12
    },
    {
      id: 'CA-002',
      customer: 'Aarav Exports',
      phone: '+91 98765 23456',
      totalCredit: 98000,
      paid: 98000,
      outstanding: 0,
      lastPayment: '2025-12-20',
      creditLimit: 200000,
      bookings: 8
    },
    {
      id: 'CA-003',
      customer: 'Mangesh Suppliers',
      phone: '+91 98765 34567',
      totalCredit: 180000,
      paid: 120000,
      outstanding: 60000,
      lastPayment: '2025-12-18',
      creditLimit: 250000,
      bookings: 15
    },
    {
      id: 'CA-004',
      customer: 'Sai Traders',
      phone: '+91 98765 45678',
      totalCredit: 45000,
      paid: 25000,
      outstanding: 20000,
      lastPayment: '2025-12-10',
      creditLimit: 100000,
      bookings: 5
    },
  ];

  const transactions = [
    {
      id: 'TXN-001',
      customerId: 'CA-001',
      customer: 'Ramesh Traders',
      type: 'debit',
      amount: 25000,
      description: 'Booking BK-045',
      date: '2025-12-20',
      balance: 50000
    },
    {
      id: 'TXN-002',
      customerId: 'CA-001',
      customer: 'Ramesh Traders',
      type: 'credit',
      amount: 25000,
      description: 'Payment received',
      date: '2025-12-15',
      balance: 25000
    },
    {
      id: 'TXN-003',
      customerId: 'CA-003',
      customer: 'Mangesh Suppliers',
      type: 'debit',
      amount: 30000,
      description: 'Booking BK-042',
      date: '2025-12-19',
      balance: 60000
    },
    {
      id: 'TXN-004',
      customerId: 'CA-003',
      customer: 'Mangesh Suppliers',
      type: 'credit',
      amount: 40000,
      description: 'Payment received',
      date: '2025-12-18',
      balance: 30000
    },
  ];

  const filteredAccounts = creditAccounts.filter(account =>
    account.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTransactions = selectedCustomer
    ? transactions.filter(t => t.customerId === selectedCustomer)
    : transactions;

  const totalOutstanding = creditAccounts.reduce((sum, a) => sum + a.outstanding, 0);
  const totalCredit = creditAccounts.reduce((sum, a) => sum + a.totalCredit, 0);
  const totalPaid = creditAccounts.reduce((sum, a) => sum + a.paid, 0);

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
          <p className="text-sm text-gray-600 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">₹{(totalPaid / 100000).toFixed(2)}L</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">₹{(totalOutstanding / 100000).toFixed(2)}L</p>
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
                  className={`p-6 cursor-pointer transition-colors ${
                    selectedCustomer === account.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedCustomer(account.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{account.customer}</p>
                      <p className="text-sm text-gray-600">{account.id}</p>
                      <p className="text-xs text-gray-500">{account.phone}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      account.outstanding === 0
                        ? 'bg-green-100 text-green-700'
                        : account.outstanding > account.creditLimit * 0.8
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {account.outstanding === 0 ? 'Clear' : 'Outstanding'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Total Credit</p>
                      <p className="font-medium text-gray-900">₹{account.totalCredit.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="font-medium text-green-600">₹{account.paid.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Outstanding</p>
                      <p className="font-medium text-orange-600">₹{account.outstanding.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Credit Limit</p>
                      <p className="font-medium text-gray-900">₹{account.creditLimit.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Credit Utilization Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Credit Utilization</span>
                      <span>{((account.outstanding / account.creditLimit) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (account.outstanding / account.creditLimit) > 0.8
                            ? 'bg-red-500'
                            : (account.outstanding / account.creditLimit) > 0.5
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${(account.outstanding / account.creditLimit) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{account.bookings} bookings</span>
                    <span>Last payment: {new Date(account.lastPayment).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short'
                    })}</span>
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
              {filteredTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{transaction.customer}</p>
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
                      <p className={`font-bold text-sm ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Bal: ₹{transaction.balance.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-sm">No transactions found</p>
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="p-4 border-t border-gray-200">
                <button className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium">
                  Record Payment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
