'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Truck, Database, AlertCircle, RefreshCw, FileSpreadsheet, Lock, X, Edit2, Filter, Wallet, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

export default function Dashboard() {
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  // Maps orderId -> { status, instructions, firstAttempt }
  const [liveStatuses, setLiveStatuses] = useState<Record<string, any>>({});
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  
  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // Debug State
  const [debugInput, setDebugInput] = useState('');
  const [debugJson, setDebugJson] = useState<any | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);

  // Wallet
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  
  const fetchWalletBalance = async () => {
    setIsWalletLoading(true);
    try {
      const res = await fetch(`/api/wallet?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.balance);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsWalletLoading(false);
    }
  };

  const fetchSheet = async () => {
    setIsLoading(true);
    setError('');
    setIsPrivate(false);
    
    try {
      const res = await fetch(`/api/sheet?_t=${Date.now()}`);
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        if (res.status === 403 || data.error?.includes('PRIVATE')) {
          setIsPrivate(true);
        }
        throw new Error(data.error || 'Failed to fetch sheet');
      }
      
      setHeaders(data.tableHeaders);
      setSheetData(data.data);
      setCurrentPage(1); // Reset to page 1 on new fetch
      
      // Status fetching is now handled in the useEffect hook listening to sheetData changes
      fetchWalletBalance();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatchStatuses = async (orderIds: string[]) => {
    if (!orderIds.length) return;
    setIsPolling(true);
    
    // Batch into chunks of 50 (Delhivery limit usually 50)
    const chunkSize = 50;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);
      
      try {
        const res = await fetch(`/api/track?waybill=${encodeURIComponent(chunk.join(','))}`);
        const data = await res.json();
        
        const newStatuses: Record<string, any> = {};
        
        if (data.ShipmentData && Array.isArray(data.ShipmentData)) {
          data.ShipmentData.forEach((item: any) => {
            const shipment = item.Shipment;
            if (!shipment) return;
            
            const orderIdMatch = chunk.find(id => id === shipment.AWB || id === shipment.ReferenceNo);
            
            if (orderIdMatch) {
              let hasCallPlaced = false;
              let ofdCount = 0;
              let ofdDate: string | null = null;
              
              if (shipment.Status?.Instructions?.toLowerCase().includes('call placed')) hasCallPlaced = true;
              if (shipment.Scans && Array.isArray(shipment.Scans)) {
                shipment.Scans.forEach((s:any) => {
                  if (s.ScanDetail?.Instructions?.toLowerCase().includes('call placed')) hasCallPlaced = true;
                  
                  const instr = (s.ScanDetail?.Instructions || '').toLowerCase();
                  // In ScanDetail, Delhivery uses 'Scan' and 'ScanType'
                  const stat = (s.ScanDetail?.Scan || s.ScanDetail?.Status || '').toLowerCase().trim();
                  const type = (s.ScanDetail?.ScanType || s.ScanDetail?.StatusType || '').toUpperCase().trim();
                  
                  const isScanOFD = (stat === 'dispatched' && type === 'UD');

                  if (isScanOFD) {
                    ofdCount++;
                    
                    const scanDate = s.ScanDetail?.ScanDateTime || s.ScanDetail?.StatusDateTime;
                    if (scanDate) {
                      if (!ofdDate) {
                        ofdDate = scanDate;
                      } else if (new Date(scanDate) > new Date(ofdDate)) {
                        ofdDate = scanDate;
                      }
                    }
                  }
                });
              }
              
              const currentInstr = (shipment.Status?.Instructions || '').toLowerCase();
              const currentStat = (shipment.Status?.Status || '').toLowerCase().trim();
              const currentType = (shipment.Status?.StatusType || '').toUpperCase().trim();
              
              const isCurrentOFD = (currentStat === 'dispatched' && currentType === 'UD');

              if (isCurrentOFD) {
                 if (ofdCount === 0) {
                   ofdCount = 1;
                 }
                 const currentStatusDate = shipment.Status?.StatusDateTime || shipment.Status?.ScanDateTime;
                 if (currentStatusDate) {
                   ofdDate = currentStatusDate; // Current status is always the latest
                 }
              }

              newStatuses[orderIdMatch] = {
                status: shipment.Status?.Status || 'Unknown',
                statusType: shipment.Status?.StatusType || '',
                instructions: shipment.Status?.Instructions || '',
                firstAttempt: shipment.FirstAttemptDate || null,
                callPlaced: hasCallPlaced,
                ofdCount: ofdCount,
                ofdDate: ofdDate,
                rawShipment: shipment
              };
            }
          });
        }
        
        chunk.forEach(id => {
          if (!newStatuses[id]) {
            newStatuses[id] = { status: 'Not Found/Error', statusType: '', instructions: '', firstAttempt: null, callPlaced: false, ofdCount: 0, ofdDate: null };
          }
        });
        
        setLiveStatuses(prev => ({ ...prev, ...newStatuses }));
      } catch (e) {
        const errorStatuses: Record<string, any> = {};
        chunk.forEach(id => {
          errorStatuses[id] = { status: 'Error', statusType: '', instructions: '', firstAttempt: null, callPlaced: false, ofdCount: 0, ofdDate: null };
        });
        setLiveStatuses(prev => ({ ...prev, ...errorStatuses }));
      }
    }
    
    setIsPolling(false);
  };

  const fetchAllStatuses = (data: any[]) => {
    const allIds = data.map(row => row._orderId).filter(Boolean);
    fetchBatchStatuses(allIds);
  };

  // Run on mount
  useEffect(() => {
    fetchSheet();
    fetchWalletBalance();
  }, []);

  // 10 Second Polling
  useEffect(() => {
    if (sheetData.length === 0) return;
    
    // Initial fetch when sheetData is first populated
    fetchAllStatuses(sheetData);
    
    const interval = setInterval(() => {
      fetchAllStatuses(sheetData);
      fetchWalletBalance();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [sheetData]);

  const handleUpdate = async (orderId: string, updates: any) => {
    // Optimistic UI update
    setSheetData(prev => prev.map(r => r._orderId === orderId ? { ...r, ...updates } : r));
    
    try {
      const res = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...updates })
      });
      const data = await res.json();
      if (!data.success) {
        alert("Failed to update Sheet: " + (data.error || 'Unknown Error. Have you configured APPS_SCRIPT_URL?'));
      } else {
        // If discount was updated, refresh the wallet balance to reflect changes in real-time
        if (updates.discount !== undefined) {
          fetchWalletBalance();
        }
      }
    } catch (e) {
      alert("Error updating sheet.");
    }
  };

  const getStatusBadge = (s: any) => {
    if (!s || s.status === 'Not Found' || s.status === 'Error') {
      return <span className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold whitespace-nowrap"><RefreshCw className="w-3 h-3 animate-spin" /> Fetching/Error...</span>;
    }
    if (!s.status) {
       return <span className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold whitespace-nowrap"><RefreshCw className="w-3 h-3 animate-spin" /> Fetching...</span>;
    }

    const rawStatus = (s.status || '').toLowerCase().trim();
    const rawType = (s.statusType || '').toUpperCase().trim();
    
    let displayStatus = s.status;
    let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";

    if (rawStatus === 'dispatched' && rawType === 'UD') {
      displayStatus = 'OFD';
      badgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    } else if (rawStatus === 'in transit' && rawType === 'RT') {
      displayStatus = 'RTO In transit';
      badgeColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
    } else if (rawStatus === 'delivered' && rawType === 'DL') {
      displayStatus = 'Delivered';
      badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    } else if (rawStatus === 'manifested' && rawType === 'UD') {
      displayStatus = 'Ready to Pickup';
      badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    } else if (rawStatus === 'in transit' && rawType === 'UD') {
      displayStatus = 'In transit';
      badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    } else if (rawStatus === 'rto' && rawType === 'DL') {
      displayStatus = 'RTO- Returned';
      badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
    } else if (rawStatus.includes('lost') || rawStatus.includes('cancel')) {
      displayStatus = 'Lost';
      badgeColor = "bg-red-900/40 text-red-400 border-red-500/30";
    } else {
      // Fallback
      if (rawStatus.includes('out for delivery') || rawStatus.includes('delivered')) {
        badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      } else if (rawStatus.includes('transit')) {
        badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
      }
    }

    return (
      <span className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border ${badgeColor}`}>
        {displayStatus}
      </span>
    );
  };

  // Filter Data
  const displayedData = sheetData.filter(row => {
    if (filterStatus === 'ALL') return true;
    
    const statObj = liveStatuses[row._orderId];
    if (!statObj || !statObj.status) return filterStatus === 'OTHER';

    const rawStatus = (statObj.status || '').toLowerCase().trim();
    const rawType = (statObj.statusType || '').toUpperCase().trim();
    
    let mappedStatus = 'OTHER';
    if (rawStatus === 'dispatched' && rawType === 'UD') mappedStatus = 'OFD';
    else if (rawStatus === 'in transit' && rawType === 'RT') mappedStatus = 'RTO_IN_TRANSIT';
    else if (rawStatus === 'delivered' && rawType === 'DL') mappedStatus = 'DELIVERED';
    else if (rawStatus === 'manifested' && rawType === 'UD') mappedStatus = 'READY_TO_PICKUP';
    else if (rawStatus === 'in transit' && rawType === 'UD') mappedStatus = 'IN_TRANSIT';
    else if (rawStatus === 'rto' && rawType === 'DL') mappedStatus = 'RTO_RETURNED';
    else if (rawStatus.includes('lost') || rawStatus.includes('cancel')) mappedStatus = 'LOST';
    
    return mappedStatus === filterStatus;
  });

  const exportToCSV = () => {
    const exportData = displayedData.map(row => {
      const newRow: Record<string, any> = {};
      
      // Standard headers
      headers.slice(0, 8).forEach(h => {
         newRow[h] = row[h];
      });
      
      const statObj = liveStatuses[row._orderId];
      newRow['Tracking Status'] = statObj?.status || '';
      newRow['Tracking Instructions'] = statObj?.instructions || '';
      newRow['First Attempt'] = formatDate(statObj?.firstAttempt) || '';
      newRow['OFD Date'] = formatDate(statObj?.ofdDate) || '';
      newRow['AT Count'] = statObj?.ofdCount || 0;
      
      // Popup data
      const popupKeys = Object.keys(row._popupData || {});
      popupKeys.forEach(k => {
         if (k.trim() === '') return; // Skip empty header columns
         if (!newRow.hasOwnProperty(k)) {
            // Use dynamically edited values if they exist, otherwise fallback to original sheet data
            const keyLower = k.toLowerCase().trim();
            if (keyLower === 'discount') {
               newRow[k] = row.discount !== undefined ? row.discount : row._popupData[k];
            } else if (keyLower === 'remark') {
               newRow[k] = row.remark !== undefined ? row.remark : row._popupData[k];
            } else if (keyLower === 'internal status' || keyLower === 'status') {
               newRow[k] = row._internalStatus !== undefined ? row._internalStatus : row._popupData[k];
            } else {
               newRow[k] = row._popupData[k];
            }
         }
      });
      
      // Just in case these columns didn't exist in the sheet at all
      if (!newRow.hasOwnProperty('Discount')) newRow['Discount'] = row.discount || '';
      if (!newRow.hasOwnProperty('Remark')) newRow['Remark'] = row.remark || '';
      if (!newRow.hasOwnProperty('Internal Status')) newRow['Internal Status'] = row._internalStatus || '';

      return newRow;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ofd_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(displayedData.length / itemsPerPage) || 1;
  const paginatedData = displayedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleDebugSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugInput.trim()) return;
    setIsDebugLoading(true);
    setDebugJson(null);
    try {
      const res = await fetch(`/api/track?waybill=${encodeURIComponent(debugInput.trim())}`);
      const data = await res.json();
      setDebugJson(data);
    } catch (err: any) {
      setDebugJson({ error: err.message });
    } finally {
      setIsDebugLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/20 p-3.5 rounded-2xl border border-indigo-500/30">
              <FileSpreadsheet className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Logistics Command Center
              </h1>
              <p className="text-slate-400 mt-1.5 text-sm font-medium flex items-center gap-2">
                Google Sheets Sync <span className="w-1 h-1 bg-slate-600 rounded-full"></span> Live 10s Delhivery Polling
                {isPolling && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin ml-1" />}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Wallet Balance Display */}
            <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-500/30 px-4 py-2 rounded-xl">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider leading-none">Wallet Balance</p>
                <p className="text-lg font-black text-emerald-300 leading-none mt-1 flex items-center gap-1.5">
                  {walletBalance !== null ? `₹${walletBalance.toLocaleString()}` : '...'}
                  {isWalletLoading && walletBalance !== null && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400/60" />}
                </p>
              </div>
            </div>

            {/* Debug Form */}
            <form onSubmit={handleDebugSearch} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5">
              <input 
                type="text" 
                placeholder="Debug Order ID..." 
                value={debugInput}
                onChange={e => setDebugInput(e.target.value)}
                className="bg-transparent text-sm text-slate-200 focus:outline-none w-32 px-2"
              />
              <button 
                type="submit" 
                disabled={isDebugLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg disabled:opacity-50"
              >
                <Search className={`w-4 h-4 ${isDebugLoading ? 'animate-spin' : ''}`} />
              </button>
            </form>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-sm font-semibold text-slate-200 focus:outline-none"
              >
                <option className="bg-slate-900 text-slate-200" value="ALL">All Status</option>
                <option className="bg-slate-900 text-slate-200" value="OFD">OFD</option>
                <option className="bg-slate-900 text-slate-200" value="RTO_IN_TRANSIT">RTO In transit</option>
                <option className="bg-slate-900 text-slate-200" value="DELIVERED">Delivered</option>
                <option className="bg-slate-900 text-slate-200" value="READY_TO_PICKUP">Ready to Pickup</option>
                <option className="bg-slate-900 text-slate-200" value="IN_TRANSIT">In transit</option>
                <option className="bg-slate-900 text-slate-200" value="RTO_RETURNED">RTO- Returned</option>
                <option className="bg-slate-900 text-slate-200" value="LOST">Lost</option>
                <option className="bg-slate-900 text-slate-200" value="OTHER">Other</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export
              </button>
              
              <button 
                onClick={fetchSheet}
                disabled={isLoading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>
          </div>
        </header>

        {/* Private Sheet Warning */}
        {isPrivate && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-8 text-center max-w-2xl mx-auto mt-10">
            <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Lock className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-red-300 mb-2">Google Sheet is Private</h2>
            <p className="text-red-400/80 mb-6 text-sm leading-relaxed">
              We cannot read your spreadsheet because it requires a Google Login. 
              To fix this, open your Google Sheet, click the blue <b>"Share"</b> button, and change General Access to <b>"Anyone with the link"</b> (Viewer).
            </p>
            <button 
              onClick={fetchSheet}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg"
            >
              I have made it Public, Try Again
            </button>
          </div>
        )}

        {/* General Error */}
        {error && !isPrivate && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* Data Table */}
        {!error && !isLoading && sheetData.length > 0 && (
          <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-800/60 shadow-2xl relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-700/50">
                    <th className="py-2 px-3 font-bold text-indigo-400 text-xs uppercase tracking-wider bg-indigo-900/10 border-r border-slate-800/50 shadow-inner">
                      Delhivery Status
                    </th>
                    {headers.map((h, i) => {
                      const hLower = (h || '').toLowerCase();
                      if (hLower.includes('order date') || hLower.includes('product')) return null;
                      
                      return (
                        <React.Fragment key={i}>
                          <th className="py-2 px-3 font-semibold text-slate-400 text-[11px] uppercase tracking-wider whitespace-nowrap">
                            {h || `Column ${i+1}`}
                          </th>
                          {i === 0 && (
                            <>
                              <th className="py-2 px-3 font-bold text-indigo-300 text-[11px] uppercase tracking-wider bg-indigo-900/10 whitespace-nowrap">
                                Instructions
                              </th>
                              <th className="py-2 px-3 font-bold text-indigo-300 text-[11px] uppercase tracking-wider bg-indigo-900/10 whitespace-nowrap border-r border-slate-800/50">
                                First Attempt
                              </th>
                              <th className="py-2 px-3 font-bold text-indigo-300 text-[11px] uppercase tracking-wider bg-indigo-900/10 whitespace-nowrap border-r border-slate-800/50">
                                OFD Date
                              </th>
                              <th className="py-2 px-3 font-bold text-indigo-300 text-[11px] uppercase tracking-wider bg-indigo-900/10 whitespace-nowrap border-r border-slate-800/50 text-center">
                                AT Count
                              </th>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <th className="py-2 px-3 font-bold text-amber-400 text-[11px] uppercase tracking-wider bg-slate-900/40 border-l border-slate-800/50 text-center w-[100px]">
                      Discount
                    </th>
                    <th className="py-2 px-3 font-bold text-amber-400 text-[11px] uppercase tracking-wider bg-slate-900/40 border-l border-slate-800/50 text-center w-[150px]">
                      Remark
                    </th>
                    <th className="py-2 px-3 font-bold text-emerald-400 text-[11px] uppercase tracking-wider bg-emerald-900/10 border-l border-slate-800/50 text-center">
                      Internal Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                      
                      <td className="py-2 px-3 border-r border-slate-800/50 bg-slate-900/20 w-[180px]">
                        {getStatusBadge(liveStatuses[row._orderId])}
                      </td>
                      
                      {headers.map((h, i) => {
                        const hLower = (h || '').toLowerCase();
                        if (hLower.includes('order date') || hLower.includes('product')) return null;
                        
                        const callPlaced = liveStatuses[row._orderId]?.callPlaced;
                        const isCustomerCol = hLower === 'customer';
                        
                        let widthClass = "max-w-[150px]"; // Default
                        if (hLower.includes('received') || hLower.includes('cod') || hLower.includes('price')) widthClass = "max-w-[90px]";

                        return (
                          <React.Fragment key={i}>
                            <td className="py-2 px-3">
                              {i === 0 ? (
                                <button 
                                  onClick={() => setSelectedOrder(row)}
                                  className="text-indigo-400 font-bold font-mono text-sm hover:text-indigo-300 transition-colors hover:underline text-left"
                                >
                                  {row[h] || '-'}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className={`text-sm text-slate-300 truncate ${widthClass}`} title={row[h]}>
                                    {row[h] || '-'}
                                  </div>
                                  {isCustomerCol && callPlaced && (
                                    <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" title="Call placed to consignee"></div>
                                  )}
                                </div>
                              )}
                            </td>
                            {i === 0 && (
                              <>
                                <td className="py-2 px-3 bg-indigo-900/5 border-r border-slate-800/50">
                                  <div className="text-sm font-medium text-slate-300 max-w-[180px] line-clamp-2" title={liveStatuses[row._orderId]?.instructions}>
                                    {liveStatuses[row._orderId]?.instructions || '-'}
                                  </div>
                                </td>
                                <td className="py-2 px-3 bg-indigo-900/5 border-r border-slate-800/50">
                                  <div className="text-sm font-semibold text-indigo-200 whitespace-nowrap">
                                    {formatDate(liveStatuses[row._orderId]?.firstAttempt) || '-'}
                                  </div>
                                </td>
                                <td className="py-2 px-3 bg-indigo-900/5 border-r border-slate-800/50">
                                  <div className="text-sm font-semibold text-emerald-300 whitespace-nowrap">
                                    {formatDate(liveStatuses[row._orderId]?.ofdDate) || '-'}
                                  </div>
                                </td>
                                <td className="py-2 px-3 bg-indigo-900/5 border-r border-slate-800/50 text-center">
                                  <div className="text-sm font-bold text-amber-400 whitespace-nowrap">
                                    {typeof liveStatuses[row._orderId]?.ofdCount === 'number' ? liveStatuses[row._orderId].ofdCount : '-'}
                                  </div>
                                </td>
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}

                      <td className="py-2 px-3 border-l border-slate-800/50 bg-slate-900/20">
                        <input 
                          type="number"
                          value={row.discount || ''}
                          onChange={(e) => setSheetData(prev => prev.map(r => r._orderId === row._orderId ? { ...r, discount: e.target.value } : r))}
                          onBlur={(e) => handleUpdate(row._orderId, { discount: e.target.value })}
                          placeholder="Amount"
                          className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg text-sm text-slate-300 p-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </td>

                      <td className="py-2 px-3 border-l border-slate-800/50 bg-slate-900/20">
                        <input 
                          type="text"
                          value={row.remark || ''}
                          onChange={(e) => setSheetData(prev => prev.map(r => r._orderId === row._orderId ? { ...r, remark: e.target.value } : r))}
                          onBlur={(e) => handleUpdate(row._orderId, { remark: e.target.value })}
                          placeholder="Remark..."
                          className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg text-sm text-slate-300 p-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </td>

                      <td className="py-2 px-3 border-l border-slate-800/50 bg-slate-900/20">
                        <select 
                          value={row._internalStatus || ''}
                          onChange={(e) => handleUpdate(row._orderId, { _internalStatus: e.target.value })}
                          className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg text-sm text-slate-300 p-1.5 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                        >
                          <option className="bg-slate-900 text-slate-200" value="">-- Action --</option>
                          <option className="bg-slate-900 text-slate-200" value="Yes">Yes</option>
                          <option className="bg-slate-900 text-slate-200" value="NR">NR</option>
                          <option className="bg-slate-900 text-slate-200" value="Call back">Call back</option>
                          <option className="bg-slate-900 text-slate-200" value="No">No</option>
                          <option className="bg-slate-900 text-slate-200" value="Delay">Delay</option>
                          <option className="bg-slate-900 text-slate-200" value="reschedule">Reschedule</option>
                        </select>
                      </td>

                    </tr>
                  ))}
                  {displayedData.length === 0 && (
                    <tr><td colSpan={headers.length + 2} className="py-10 text-center text-slate-500">No matching orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-900/60 p-4 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4 w-full">
              <span className="text-xs font-medium text-slate-500">
                Showing {paginatedData.length} of {displayedData.length} records
              </span>
              
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs font-semibold text-slate-400 px-2">Page {currentPage} of {totalPages}</span>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>

              <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                <span className="text-xs text-emerald-400 font-bold">Auto-Polling Active</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-slate-400 font-medium animate-pulse">Reading Google Sheet...</p>
          </div>
        )}

        {/* Modal Popup */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0f1d] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div>
                  <h3 className="text-xl font-bold text-white">Order Details</h3>
                  <p className="text-sm font-mono text-indigo-400 mt-1">{selectedOrder._orderId}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {selectedOrder && liveStatuses[selectedOrder._orderId]?.rawShipment && (
                  <div className="mb-6 bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-5 shadow-lg">
                    <h4 className="text-lg font-bold text-indigo-300 mb-4 flex items-center gap-2 border-b border-indigo-500/20 pb-3">
                      <Truck className="w-5 h-5" /> Live Tracking Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Sheet Data injected at the top of modal */}
                      {Object.keys(selectedOrder).find(k => k.toLowerCase() === 'order date') && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-1">Order Date</p>
                          <p className="text-lg font-bold text-emerald-100">{formatDate(selectedOrder[Object.keys(selectedOrder).find(k => k.toLowerCase() === 'order date') as string])}</p>
                        </div>
                      )}
                      {Object.keys(selectedOrder).find(k => k.toLowerCase() === 'product') && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-1">Product</p>
                          <p className="text-lg font-bold text-emerald-100 truncate" title={selectedOrder[Object.keys(selectedOrder).find(k => k.toLowerCase() === 'product') as string]}>
                            {selectedOrder[Object.keys(selectedOrder).find(k => k.toLowerCase() === 'product') as string]}
                          </p>
                        </div>
                      )}
                      
                      {liveStatuses[selectedOrder._orderId].rawShipment.PickUpDate && (
                        <div>
                          <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider mb-1">Pickup Date</p>
                          <p className="text-lg font-bold text-indigo-100">{formatDate(liveStatuses[selectedOrder._orderId].rawShipment.PickUpDate)}</p>
                        </div>
                      )}
                      {liveStatuses[selectedOrder._orderId].rawShipment.ExpectedDeliveryDate && (
                        <div>
                          <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider mb-1">Expected Delivery</p>
                          <p className="text-lg font-bold text-indigo-100">{formatDate(liveStatuses[selectedOrder._orderId].rawShipment.ExpectedDeliveryDate)}</p>
                        </div>
                      )}
                      {liveStatuses[selectedOrder._orderId].rawShipment.Destination && (
                        <div>
                          <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider mb-1">Destination</p>
                          <p className="text-base font-bold text-indigo-100">{liveStatuses[selectedOrder._orderId].rawShipment.Destination}</p>
                        </div>
                      )}
                      {liveStatuses[selectedOrder._orderId].rawShipment.Status?.StatusLocation && (
                        <div>
                          <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider mb-1">Current Location</p>
                          <p className="text-base font-bold text-indigo-100">{liveStatuses[selectedOrder._orderId].rawShipment.Status.StatusLocation}</p>
                        </div>
                      )}
                      {liveStatuses[selectedOrder._orderId].rawShipment.Status?.Instructions && (
                        <div className="col-span-1 md:col-span-2 bg-indigo-950/40 p-3 rounded-lg border border-indigo-500/20 mt-2">
                          <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider mb-1">Latest Instructions</p>
                          <p className="text-base font-bold text-indigo-100">{liveStatuses[selectedOrder._orderId].rawShipment.Status.Instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4" /> Sheet Data
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {Object.entries(selectedOrder._popupData).map(([key, value]) => {
                    if(!key) return null;
                    return (
                      <div key={key} className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{key}</p>
                        <p className="text-sm text-slate-200 font-medium break-words">
                          {value ? String(value) : '-'}
                        </p>
                      </div>
                    )
                  })}

                  {Object.keys(selectedOrder._popupData).length === 0 && (
                    <div className="col-span-2 text-center text-slate-500 py-4">
                      No additional columns found in the sheet.
                    </div>
                  )}

                </div>
              </div>
              <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
                <button onClick={() => setSelectedOrder(null)} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl font-bold text-white transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug JSON Modal */}
        {debugJson && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-[#0a0f1d] border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                <h3 className="text-lg font-bold text-indigo-300">Raw JSON: {debugInput}</h3>
                <button onClick={() => setDebugJson(null)} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1 bg-black text-emerald-400 font-mono text-[11px] leading-tight">
                <pre>{JSON.stringify(debugJson, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
