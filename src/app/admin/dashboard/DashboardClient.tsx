'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Calendar, FileText, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

export default function DashboardClient() {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  const router = useRouter();

  const fetchWallet = async (polling = false) => {
    if (polling) setIsPolling(true);
    else setIsLoading(true);
    
    try {
      const res = await fetch(`/api/wallet?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch wallet', err);
    } finally {
      setIsLoading(false);
      setIsPolling(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(() => fetchWallet(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    
    setIsSubmitting(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, date, remark })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setMessage('Funds added successfully!');
        setAmount('');
        setRemark('');
        fetchWallet(); // Refresh data
      } else {
        setMessage('Failed to add funds. Did you update the Google Apps Script?');
      }
    } catch (err) {
      setMessage('An error occurred while adding funds.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportTransactions = () => {
    if (!history || history.length === 0) {
      alert("No transactions to export.");
      return;
    }

    const csvData = history.map(row => ({
      Date: row.date,
      Amount: row.amount,
      Remark: row.remark
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `admin_wallet_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600/20 p-3.5 rounded-2xl border border-emerald-500/30">
              <Wallet className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-slate-400 mt-1.5 text-sm font-medium">Manage Wallet and Funds</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => fetchWallet(false)} className="p-2 bg-slate-900 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">
               <RefreshCw className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
              <ArrowLeft className="w-4 h-4" /> User Panel
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Add Funds Form */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
              
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" /> Add Funds to Wallet
              </h2>
              
              <form onSubmit={handleAddFunds} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl py-2.5 px-4 text-emerald-300 font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="e.g. 5000"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar className="w-3 h-3"/> Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl py-2.5 px-4 text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><FileText className="w-3 h-3"/> Remark</label>
                  <input
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl py-2.5 px-4 text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="e.g. Added via UPI"
                  />
                </div>

                {message && (
                  <div className={`p-3 rounded-xl text-sm font-medium ${message.includes('success') ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30' : 'bg-red-950/40 text-red-400 border border-red-500/30'}`}>
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Amount'}
                </button>
              </form>
            </div>
          </div>

          {/* History and Stats */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Stats Card */}
            <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm font-bold text-emerald-400/80 uppercase tracking-wider mb-1">Total Wallet Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter flex items-center gap-3">
                    {isLoading && balance === null ? '...' : `₹${balance?.toLocaleString() || '0'}`}
                    {(isLoading || isPolling) && balance !== null && <Loader2 className="w-6 h-6 animate-spin text-emerald-500/50" />}
                  </span>
                </div>
              </div>
              <div className="bg-emerald-500/10 p-4 rounded-full">
                 <Wallet className="w-12 h-12 text-emerald-400" />
              </div>
            </div>

            {/* History Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800/60 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">Transaction History</h3>
                <button
                  onClick={exportTransactions}
                  disabled={history.length === 0}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-700/50">
                      <th className="py-3 px-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Date</th>
                      <th className="py-3 px-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Amount</th>
                      <th className="py-3 px-5 font-bold text-slate-400 text-xs uppercase tracking-wider">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {isLoading ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Loading history...</td></tr>
                    ) : history.length > 0 ? (
                      history.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-5 text-sm text-slate-300 font-medium">{row.date}</td>
                          <td className="py-3 px-5 text-sm font-bold text-emerald-400">₹{Number(row.amount).toLocaleString()}</td>
                          <td className="py-3 px-5 text-sm text-slate-400">{row.remark || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-500">No transactions found. Add funds to see them here.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
