'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Truck, Database, AlertCircle, RefreshCw, FileSpreadsheet, Lock, X, Edit2, Filter, Wallet, Settings, Loader2, Calendar } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

export default function Dashboard() {
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  // Maps orderId -> { status, instructions, firstAttempt }
  const [liveStatuses, setLiveStatuses] = useState<Record<string, any>>({});
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
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
    const chunks: string[][] = [];
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      chunks.push(orderIds.slice(i, i + chunkSize));
    }
    
    try {
      const newStatuses: Record<string, any> = {};

      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const res = await fetch(`/api/track?waybill=${encodeURIComponent(chunk.join(','))}`);
            const data = await res.json();
            
            if (data.ShipmentData && Array.isArray(data.ShipmentData)) {
              data.ShipmentData.forEach((item: any) => {
                const shipment = item.Shipment;
                if (!shipment) return;
                
                const orderIdMatch = chunk.find(id => id === shipment.AWB || id === shipment.ReferenceNo);
                
                if (orderIdMatch) {
                  let hasCallPlaced = false;
                  let ofdDate: string | null = null;
                  const ofdDatesSet = new Set<string>();
                  
                  if (shipment.Status?.Instructions?.toLowerCase().includes('call placed')) hasCallPlaced = true;
                  if (shipment.Scans && Array.isArray(shipment.Scans)) {
                    shipment.Scans.forEach((s:any) => {
                      if (s.ScanDetail?.Instructions?.toLowerCase().includes('call placed')) hasCallPlaced = true;
                      
                      const stat = (s.ScanDetail?.Scan || s.ScanDetail?.Status || '').toLowerCase().trim();
                      const type = (s.ScanDetail?.ScanType || s.ScanDetail?.StatusType || '').toUpperCase().trim();
                      
                      const isScanOFD = (stat === 'dispatched' && type === 'UD');

                      if (isScanOFD) {
                        const scanDate = s.ScanDetail?.ScanDateTime || s.ScanDetail?.StatusDateTime;
                        if (scanDate) {
                          const dateOnly = scanDate.split('T')[0];
                          ofdDatesSet.add(dateOnly);
                          
                          if (!ofdDate) {
                            ofdDate = scanDate;
                          } else if (new Date(scanDate) > new Date(ofdDate)) {
                            ofdDate = scanDate;
                          }
                        }
                      }
                    });
                  }
                  
                  const currentStat = (shipment.Status?.Status || '').toLowerCase().trim();
                  const currentType = (shipment.Status?.StatusType || '').toUpperCase().trim();
                  
                  const isCurrentOFD = (currentStat === 'dispatched' && currentType === 'UD');

                  if (isCurrentOFD) {
                     const currentStatusDate = shipment.Status?.StatusDateTime || shipment.Status?.ScanDateTime;
                     if (currentStatusDate) {
                       ofdDate = currentStatusDate;
                     }
                  }
                  
                  const finalOfdCount = ofdDatesSet.size;

                  newStatuses[orderIdMatch] = {
                    status: shipment.Status?.Status || 'Unknown',
                    statusType: shipment.Status?.StatusType || '',
                    instructions: shipment.Status?.Instructions || '',
                    firstAttempt: shipment.FirstAttemptDate || null,
                    callPlaced: hasCallPlaced,
                    ofdCount: finalOfdCount,
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
          } catch (e) {
            chunk.forEach(id => {
              newStatuses[id] = { status: 'Error', statusType: '', instructions: '', firstAttempt: null, callPlaced: false, ofdCount: 0, ofdDate: null };
            });
          }
        })
      );
      
      setLiveStatuses(prev => ({ ...prev, ...newStatuses }));
    } catch (e) {
      console.error('Batch status error:', e);
    } finally {
      setIsPolling(false);
    }
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

  // Stable string representation of order IDs to prevent polling restarts on input typing
  const orderIdsKey = sheetData.map(r => r._orderId).filter(Boolean).join(',');

  // 10 Second Polling - decoupled from sheetData mutation so input keystrokes do NOT re-trigger network requests
  useEffect(() => {
    if (!orderIdsKey) return;
    
    const idsList = orderIdsKey.split(',').filter(Boolean);
    fetchBatchStatuses(idsList);
    
    const interval = setInterval(() => {
      fetchBatchStatuses(idsList);
      fetchWalletBalance();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [orderIdsKey]);

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
    } else if ((rawStatus === 'in transit' || rawStatus === 'dispatched') && rawType === 'RT') {
      displayStatus = 'RTO In transit';
      badgeColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
    } else if (rawStatus === 'delivered' && rawType === 'DL') {
      displayStatus = 'Delivered';
      badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    } else if (rawStatus === 'manifested' && rawType === 'UD') {
      displayStatus = 'Ready to Pickup';
      badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    } else if ((rawStatus === 'in transit' || rawStatus === 'pending') && rawType === 'UD') {
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
  const displayedData = React.useMemo(() => {
    return sheetData.filter(row => {
      let matchesStatus = false;
      if (filterStatus === 'ALL') {
         matchesStatus = true;
      } else {
         const statObj = liveStatuses[row._orderId];
         if (!statObj || !statObj.status) {
           matchesStatus = filterStatus === 'OTHER';
         } else {
           const rawStatus = (statObj.status || '').toLowerCase().trim();
           const rawType = (statObj.statusType || '').toUpperCase().trim();
           
           let mappedStatus = 'OTHER';
           if (rawStatus === 'dispatched' && rawType === 'UD') mappedStatus = 'OFD';
           else if ((rawStatus === 'in transit' || rawStatus === 'dispatched') && rawType === 'RT') mappedStatus = 'RTO_IN_TRANSIT';
           else if (rawStatus === 'delivered' && rawType === 'DL') mappedStatus = 'DELIVERED';
           else if (rawStatus === 'manifested' && rawType === 'UD') mappedStatus = 'READY_TO_PICKUP';
           else if ((rawStatus === 'in transit' || rawStatus === 'pending') && rawType === 'UD') mappedStatus = 'IN_TRANSIT';
           else if (rawStatus === 'rto' && rawType === 'DL') mappedStatus = 'RTO_RETURNED';
           else if (rawStatus.includes('lost') || rawStatus.includes('cancel')) mappedStatus = 'LOST';
           
           matchesStatus = mappedStatus === filterStatus;
         }
      }
      
      let matchesSearch = true;
      if (searchQuery.trim() !== '') {
         const q = searchQuery.toLowerCase().trim();
         // Check if any value in the row object contains the search query
         matchesSearch = Object.values(row).some((val: any) => 
             val && val.toString().toLowerCase().includes(q)
         );
      }
      
      return matchesStatus && matchesSearch;
    });
  }, [sheetData, liveStatuses, filterStatus, searchQuery]);

  const exportToCSV = () => {
    const exportData = displayedData.map(row => {
      const newRow: Record<string, any> = {};
      const statObj = liveStatuses[row._orderId];
      const dates = getOrderDates(row, statObj);

      // 1. Export ALL original Google Sheet headers (table + popup headers)
      headers.forEach(h => {
        if (!h || h.trim() === '') return;
        const keyLower = h.toLowerCase().trim();
        
        if (keyLower === 'discount') {
          newRow[h] = row.discount !== undefined ? row.discount : (row._popupData?.[h] || row[h] || '');
        } else if (keyLower === 'remark') {
          newRow[h] = row.remark !== undefined ? row.remark : (row._popupData?.[h] || row[h] || '');
        } else if (keyLower === 'internal status' || keyLower === 'status') {
          newRow[h] = row._internalStatus !== undefined ? row._internalStatus : (row._popupData?.[h] || row[h] || '');
        } else if (row.hasOwnProperty(h)) {
          newRow[h] = row[h];
        } else if (row._popupData && row._popupData.hasOwnProperty(h)) {
          newRow[h] = row._popupData[h];
        } else {
          newRow[h] = row[h] || '';
        }
      });

      // 2. Export Live Tracking & Logistics details (from table & popup)
      newRow['Delhivery Status'] = statObj?.status || '';
      newRow['Tracking Instructions'] = statObj?.instructions || '';
      newRow['First Attempt'] = formatDate(statObj?.firstAttempt) || '';
      newRow['OFD Date'] = formatDate(statObj?.ofdDate) || '';
      newRow['AT Count'] = statObj?.ofdCount || 0;
      newRow['Pickup Date'] = formatDate(dates.pickupDate) || '';
      newRow['Expected Delivery Date'] = formatDate(dates.expectedDeliveryDate) || '';
      newRow['Delivered Date'] = formatDate(dates.deliveryDate) || '';
      newRow['Destination'] = statObj?.rawShipment?.Destination || '';
      newRow['Current Location'] = statObj?.rawShipment?.Status?.StatusLocation || '';
      newRow['Call Placed'] = statObj?.callPlaced ? 'Yes' : 'No';

      // 3. Any additional popup data keys not in headers
      if (row._popupData) {
        Object.keys(row._popupData).forEach(k => {
          if (k && k.trim() !== '' && !newRow.hasOwnProperty(k)) {
            newRow[k] = row._popupData[k];
          }
        });
      }

      // 4. Ensure Discount, Remark, Internal Status exist
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
    link.setAttribute("download", `ofd_complete_export_${new Date().toISOString().split('T')[0]}.csv`);
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

  const getOrderDates = (row: any, liveStatus: any) => {
    if (!row) return { pickupDate: null, deliveryDate: null, expectedDeliveryDate: null };
    const raw = liveStatus?.rawShipment || {};
    
    // 1. Pickup Date
    let pickupDate = raw.PickUpDate || raw.PickupDate || raw.PickedupDate || raw.PickUpDateTime || raw.PickUpLocationDate || null;
    if (!pickupDate && raw.Scans && Array.isArray(raw.Scans)) {
      const pScan = raw.Scans.find((s: any) => {
        const stat = (s.ScanDetail?.Scan || s.ScanDetail?.Status || '').toLowerCase();
        return stat.includes('picked') || stat.includes('pickup') || stat.includes('dispatched');
      });
      if (pScan) {
        pickupDate = pScan.ScanDetail?.ScanDateTime || pScan.ScanDetail?.StatusDateTime || null;
      }
    }
    if (!pickupDate) {
      const pKey = Object.keys(row || {}).find(k => k.toLowerCase().includes('pickup'));
      if (pKey) pickupDate = row[pKey];
    }

    // 2. Delivery Date / Expected Delivery Date
    let deliveryDate = raw.DeliveryDate || raw.DeliveredDate || raw.ActualDeliveryDate || null;
    let expectedDeliveryDate = raw.ExpectedDeliveryDate || raw.EDD || raw.PromisedDeliveryDate || null;
    
    const isDelivered = (liveStatus?.status || raw.Status?.Status || '').toLowerCase().includes('delivered');
    if (isDelivered && !deliveryDate) {
      deliveryDate = raw.Status?.StatusDateTime || raw.Status?.ScanDateTime || null;
      if (!deliveryDate && raw.Scans && Array.isArray(raw.Scans)) {
        const dScan = raw.Scans.find((s: any) => (s.ScanDetail?.Scan || s.ScanDetail?.Status || '').toLowerCase().includes('delivered'));
        if (dScan) deliveryDate = dScan.ScanDetail?.ScanDateTime || dScan.ScanDetail?.StatusDateTime || null;
      }
    }

    if (!deliveryDate) {
      const dKey = Object.keys(row || {}).find(k => {
        const kl = k.toLowerCase();
        return kl.includes('delivery date') || kl.includes('delivered date');
      });
      if (dKey) deliveryDate = row[dKey];
    }

    if (!expectedDeliveryDate) {
      const eddKey = Object.keys(row || {}).find(k => {
        const kl = k.toLowerCase();
        return kl.includes('edd') || kl.includes('expected delivery');
      });
      if (eddKey) expectedDeliveryDate = row[eddKey];
    }

    return { pickupDate, deliveryDate, expectedDeliveryDate };
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
          
          <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
            
            {/* Main Table Search */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex-1 min-w-[200px] md:max-w-[300px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search data..." 
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-sm text-slate-200 focus:outline-none w-full"
              />
            </div>
            
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
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-medium text-slate-400">
                  Showing <span className="text-indigo-400 font-bold">{paginatedData.length}</span> of <span className="text-indigo-400 font-bold">{displayedData.length}</span> records
                </span>
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/60 px-3 py-1 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400">Rows per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs font-bold text-indigo-300 focus:outline-none cursor-pointer"
                  >
                    <option className="bg-slate-900 text-slate-200" value={25}>25</option>
                    <option className="bg-slate-900 text-slate-200" value={50}>50</option>
                    <option className="bg-slate-900 text-slate-200" value={100}>100</option>
                    <option className="bg-slate-900 text-slate-200" value={500}>500</option>
                  </select>
                </div>
              </div>
              
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
        {selectedOrder && (() => {
          const liveStat = liveStatuses[selectedOrder._orderId];
          const dates = getOrderDates(selectedOrder, liveStat);
          const orderDateKey = Object.keys(selectedOrder).find(k => k.toLowerCase() === 'order date');
          const productKey = Object.keys(selectedOrder).find(k => k.toLowerCase() === 'product');

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#0a0f1d] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-400" /> Order Details
                    </h3>
                    <p className="text-sm font-mono text-indigo-400 mt-1">ID: {selectedOrder._orderId}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                  
                  {/* Top Highlight Card for Dates & Core Logistics Info */}
                  <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
                    <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-indigo-500/20 pb-2">
                      <Truck className="w-4 h-4 text-indigo-400" /> Key Dates & Logistics Overview
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Order Date */}
                      {orderDateKey && selectedOrder[orderDateKey] && (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Order Date</p>
                          <p className="text-base font-bold text-slate-100">{formatDate(selectedOrder[orderDateKey])}</p>
                        </div>
                      )}

                      {/* Product */}
                      {productKey && selectedOrder[productKey] && (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product</p>
                          <p className="text-base font-bold text-slate-100 truncate" title={selectedOrder[productKey]}>
                            {selectedOrder[productKey]}
                          </p>
                        </div>
                      )}

                      {/* Pickup Date */}
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-500/20">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-400" /> Pickup Date
                        </p>
                        <p className="text-base font-bold text-indigo-200">
                          {dates.pickupDate ? formatDate(dates.pickupDate) : <span className="text-slate-500 text-xs font-medium">Not Available</span>}
                        </p>
                      </div>

                      {/* Delivery Date or Expected Delivery Date */}
                      {dates.deliveryDate ? (
                        <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-500/30">
                          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-400" /> Delivered Date
                          </p>
                          <p className="text-base font-bold text-emerald-200">
                            {formatDate(dates.deliveryDate)}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400" /> Expected Delivery
                          </p>
                          <p className="text-base font-bold text-amber-200">
                            {dates.expectedDeliveryDate ? formatDate(dates.expectedDeliveryDate) : <span className="text-slate-500 text-xs font-medium">Pending / N/A</span>}
                          </p>
                        </div>
                      )}

                      {/* Destination */}
                      {liveStat?.rawShipment?.Destination && (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destination</p>
                          <p className="text-sm font-bold text-slate-200">{liveStat.rawShipment.Destination}</p>
                        </div>
                      )}

                      {/* Current Location */}
                      {liveStat?.rawShipment?.Status?.StatusLocation && (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Location</p>
                          <p className="text-sm font-bold text-slate-200">{liveStat.rawShipment.Status.StatusLocation}</p>
                        </div>
                      )}

                    </div>

                    {/* Latest Instructions */}
                    {liveStat?.rawShipment?.Status?.Instructions && (
                      <div className="mt-4 bg-slate-950/60 p-3 rounded-xl border border-indigo-500/20">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Latest Instructions</p>
                        <p className="text-sm font-semibold text-indigo-100">{liveStat.rawShipment.Status.Instructions}</p>
                      </div>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Sheet Data
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedOrder._popupData || {}).map(([key, value]) => {
                      if (!key) return null;
                      return (
                        <div key={key} className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{key}</p>
                          <p className="text-sm text-slate-200 font-medium break-words">
                            {value ? String(value) : '-'}
                          </p>
                        </div>
                      );
                    })}

                    {Object.keys(selectedOrder._popupData || {}).length === 0 && (
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
          );
        })()}

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
