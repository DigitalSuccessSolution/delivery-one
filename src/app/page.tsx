'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Truck, Database, AlertCircle, RefreshCw, FileSpreadsheet, Lock, X, Edit2, Filter } from 'lucide-react';

export default function Dashboard() {
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchSheet = async () => {
    setIsLoading(true);
    setError('');
    setIsPrivate(false);
    
    try {
      const res = await fetch('/api/sheet');
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
      
      // Initialize fetching for statuses
      data.data.forEach((row: any) => {
        if (row._orderId && !liveStatuses[row._orderId]) {
          fetchSingleStatus(row._orderId);
        }
      });
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSingleStatus = async (orderId: string) => {
    try {
      const res = await fetch(`/api/track?waybill=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      let statusObj = { status: 'Not Found', instructions: '', firstAttempt: null, callPlaced: false };
      if (!data.Error && !data.error && data.ShipmentData?.[0]?.Shipment) {
        const shipment = data.ShipmentData[0].Shipment;
        
        let hasCallPlaced = false;
        if (shipment.Status?.Instructions?.toLowerCase().includes('call placed')) hasCallPlaced = true;
        if (shipment.Scans && Array.isArray(shipment.Scans)) {
          if (shipment.Scans.some((s:any) => s.ScanDetail?.Instructions?.toLowerCase().includes('call placed'))) {
             hasCallPlaced = true;
          }
        }

        statusObj = {
          status: shipment.Status?.Status || 'Unknown',
          instructions: shipment.Status?.Instructions || '',
          firstAttempt: shipment.FirstAttemptDate || null,
          callPlaced: hasCallPlaced
        };
      }
      setLiveStatuses(prev => ({ ...prev, [orderId]: statusObj }));
    } catch (e) {
      setLiveStatuses(prev => ({ ...prev, [orderId]: { status: 'Error', instructions: '', firstAttempt: null } }));
    }
  };

  // 10 Second Polling
  useEffect(() => {
    fetchSheet();
    const interval = setInterval(() => {
      // Re-fetch statuses for all orders currently loaded
      sheetData.forEach(row => {
        if (row._orderId) fetchSingleStatus(row._orderId);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []); // Note: leaving dependency array empty so it only mounts once, but captures sheetData via closure - actually sheetData won't be captured.
  // We need a ref or just let the interval use the latest state. To simplify, we'll re-bind the interval when sheetData changes.

  useEffect(() => {
    const interval = setInterval(() => {
      sheetData.forEach(row => {
        if (row._orderId) fetchSingleStatus(row._orderId);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [sheetData]);

  const handleInternalStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic UI update
    setSheetData(prev => prev.map(r => r._orderId === orderId ? { ...r, _internalStatus: newStatus } : r));
    
    try {
      const res = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, newStatus })
      });
      const data = await res.json();
      if (!data.success) {
        alert("Failed to update Sheet: " + (data.error || 'Unknown Error. Have you configured APPS_SCRIPT_URL?'));
        // fetchSheet(); // reload to reset
      }
    } catch (e) {
      alert("Error updating sheet.");
    }
  };

  const getStatusBadge = (s: any) => {
    const statusText = typeof s === 'string' ? s : s?.status;
    if (!statusText) return <span className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold whitespace-nowrap"><RefreshCw className="w-3 h-3 animate-spin" /> Fetching...</span>;
    const lower = statusText.toLowerCase();
    if (lower.includes('out for delivery') || lower.includes('delivered')) return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">{statusText}</span>;
    if (lower.includes('transit')) return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">{statusText}</span>;
    return <span className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">{statusText}</span>;
  };

  // Filter Data
  const displayedData = sheetData.filter(row => {
    if (filterStatus === 'ALL') return true;
    const statObj = liveStatuses[row._orderId];
    const s = statObj?.status || '';
    if (filterStatus === 'OFD' && s.toLowerCase().includes('out for delivery')) return true;
    if (filterStatus === 'TRANSIT' && s.toLowerCase().includes('transit')) return true;
    if (filterStatus === 'OTHER' && !s.toLowerCase().includes('out for delivery') && !s.toLowerCase().includes('transit')) return true;
    return false;
  });

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
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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
                <option className="bg-slate-900 text-slate-200" value="ALL">All Shipments</option>
                <option className="bg-slate-900 text-slate-200" value="OFD">Out for Delivery Only</option>
                <option className="bg-slate-900 text-slate-200" value="TRANSIT">In Transit Only</option>
                <option className="bg-slate-900 text-slate-200" value="OTHER">Other Statuses</option>
              </select>
            </div>
            
            <button 
              onClick={fetchSheet}
              disabled={isLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Manual Sync
            </button>
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
                    <th className="py-4 px-5 font-bold text-indigo-400 text-xs uppercase tracking-wider bg-indigo-900/10 border-r border-slate-800/50 shadow-inner">
                      Delhivery Status
                    </th>
                    {headers.map((h, i) => (
                      <React.Fragment key={i}>
                        <th className="py-4 px-5 font-semibold text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">
                          {h || `Column ${i+1}`}
                        </th>
                        {h.toLowerCase().includes('order date') && (
                          <th className="py-4 px-5 font-bold text-indigo-300 text-xs uppercase tracking-wider bg-indigo-900/10 whitespace-nowrap">
                            First Attempt
                          </th>
                        )}
                      </React.Fragment>
                    ))}
                    <th className="py-4 px-5 font-bold text-emerald-400 text-xs uppercase tracking-wider bg-emerald-900/10 border-l border-slate-800/50 text-center">
                      Internal Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                      
                      <td className="py-4 px-5 border-r border-slate-800/50 bg-slate-900/20 w-[180px]">
                        {getStatusBadge(liveStatuses[row._orderId])}
                      </td>
                      
                      {headers.map((h, i) => {
                        const callPlaced = liveStatuses[row._orderId]?.callPlaced;
                        const isCustomerCol = h.toLowerCase() === 'customer';
                        const hLower = h.toLowerCase();
                        
                        let widthClass = "max-w-[150px]"; // Default
                        if (hLower.includes('received') || hLower.includes('cod') || hLower.includes('price')) widthClass = "max-w-[90px]";
                        if (hLower.includes('product')) widthClass = "max-w-[120px]";

                        return (
                          <React.Fragment key={i}>
                            <td className="py-4 px-5">
                              {i === 0 ? (
                                <button 
                                  onClick={() => setSelectedOrder(row)}
                                  className="text-indigo-400 font-bold font-mono text-sm hover:text-indigo-300 transition-colors hover:underline"
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
                            {h.toLowerCase().includes('order date') && (
                              <td className="py-4 px-5 bg-indigo-900/5">
                                <div className="text-sm font-semibold text-indigo-200 whitespace-nowrap">
                                  {formatDate(liveStatuses[row._orderId]?.firstAttempt) || '-'}
                                </div>
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}

                      <td className="py-4 px-5 border-l border-slate-800/50 bg-slate-900/20">
                        <select 
                          value={row._internalStatus || ''}
                          onChange={(e) => handleInternalStatusChange(row._orderId, e.target.value)}
                          className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg text-sm text-slate-300 p-2 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {Object.entries(selectedOrder._popupData).map(([key, value]) => {
                    if(!key) return null;
                    return (
                      <div key={key} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{key}</p>
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

      </div>
    </div>
  );
}
