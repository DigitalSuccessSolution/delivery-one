'use client';

import React, { useState, useEffect } from 'react';
import { Package, Search, Truck, MapPin, Calendar, CheckCircle, AlertCircle, RefreshCw, ShoppingBag, Database, User, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [searchAwb, setSearchAwb] = useState('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Real-time Database State
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [isFetchingDb, setIsFetchingDb] = useState(true);

  // Poll database every 10 seconds for new webhook updates
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        const json = await res.json();
        if (json.success && json.data) {
          // We only replace if we actually fetched something, otherwise keep existing state (which might have manually tracked items)
          if (json.data.length > 0) {
            setDbOrders(json.data);
          }
        }
      } catch (err) {
        console.error("Error fetching live orders:", err);
      } finally {
        setIsFetchingDb(false);
      }
    };

    fetchOrders(); // Initial fetch
    const intervalId = setInterval(fetchOrders, 10000); // Polling every 10s
    return () => clearInterval(intervalId);
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAwb.trim()) return;

    setIsLoading(true);
    setError('');
    setTrackingData(null);

    try {
      const res = await fetch(`/api/track?waybill=${searchAwb.trim()}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.Error || 'Failed to fetch tracking data');
      }
      
      if (data.Error) {
        throw new Error(data.Error);
      }
      
      setTrackingData(data);

      // --- ADD SEARCHED DATA TO MAIN TABLE FOR PROTOTYPE ---
      const shipment = data.ShipmentData?.[0]?.Shipment;
      if (shipment) {
        const newOrder = {
          _id: Math.random().toString(), // temporary ID
          awb: shipment.AWB,
          orderId: shipment.ReferenceNo || 'N/A',
          status: shipment.Status?.Status || 'Unknown',
          destination: shipment.Destination || 'N/A',
          payment: shipment.OrderType || 'N/A',
          product: shipment.Consignee?.Name || 'N/A',
          rawPayload: data
        };
        
        // Check if AWB already exists in table to prevent duplicates
        setDbOrders(prev => {
          if (prev.find(o => o.awb === shipment.AWB)) return prev;
          return [newOrder, ...prev];
        });
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while tracking the package');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    if (!status) return 'status-pending';
    const s = status.toLowerCase();
    if (s.includes('out for delivery') || s.includes('delivered')) return 'status-ofd';
    if (s.includes('transit')) return 'status-intransit';
    return 'status-pending';
  };

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
      return dateString;
    }
  };

  const displayData = dbOrders;

  const filteredData = activeTab === 'ofd' 
    ? displayData.filter(item => (item.status || '').toLowerCase().includes('out for delivery'))
    : displayData;

  const isUsingRealData = dbOrders.length > 0;

  // Extracted shipment for easy access in UI
  const liveShipment = trackingData?.ShipmentData?.[0]?.Shipment;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-[1500px] mx-auto space-y-8">
        
        {/* Header section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-3.5 rounded-2xl border border-blue-500/30">
              <Truck className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Logistics Command Center
              </h1>
              <p className="text-slate-400 mt-1.5 text-sm font-medium">Real-Time Delhivery OFD Dashboard</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 pl-5 pr-5 rounded-full border border-slate-700/50 shadow-sm">
              <div className={`w-2.5 h-2.5 rounded-full ${isUsingRealData ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
              <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" /> 
                {isUsingRealData ? 'Live Data Syncing' : 'Waiting for Webhook Data...'}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Main Table Section (Left / Center) - 8 cols */}
          <div className="xl:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                <Package className="w-5 h-5 text-indigo-400" />
                Active Shipments
              </h2>
              
              <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setActiveTab('all')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'all' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All Active ({displayData.length})
                </button>
                <button 
                  onClick={() => setActiveTab('ofd')}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === 'ofd' ? 'bg-indigo-600/20 text-indigo-300 shadow-md border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                  OFD Only ({displayData.filter(i => (i.status||'').toLowerCase().includes('out for delivery')).length})
                </button>
              </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-800/60 shadow-2xl relative min-h-[500px] flex flex-col">
              {isFetchingDb && dbOrders.length === 0 && (
                <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center z-10 backdrop-blur-sm">
                  <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                </div>
              )}
              
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-700/50">
                      <th className="py-5 px-6 font-semibold text-slate-400 text-xs uppercase tracking-wider">Waybill / Order</th>
                      <th className="py-5 px-6 font-semibold text-slate-400 text-xs uppercase tracking-wider">Customer / Product</th>
                      <th className="py-5 px-6 font-semibold text-slate-400 text-xs uppercase tracking-wider">Status</th>
                      <th className="py-5 px-6 font-semibold text-slate-400 text-xs uppercase tracking-wider">Destination</th>
                      <th className="py-5 px-6 font-semibold text-slate-400 text-xs uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredData.map((item: any, idx: number) => (
                      <tr key={item._id || idx} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="py-5 px-6">
                          <div className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors text-base">{item.awb}</div>
                          <div className="text-xs text-slate-500 mt-1.5 font-mono">{item.orderId}</div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-start gap-3">
                            <User className="w-5 h-5 text-slate-500 mt-0.5" />
                            <div>
                              <span className="block text-sm text-slate-200 font-semibold">
                                {item.rawPayload?.Shipment?.Consignee?.Name || item.product || 'Pending Data'}
                              </span>
                              <span className="block text-xs text-slate-500 mt-1">
                                {item.rawPayload?.Shipment?.Consignee?.City ? `${item.rawPayload?.Shipment?.Consignee?.City}, ` : ''}{item.rawPayload?.Shipment?.Consignee?.State || ''}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className={`status-badge ${getStatusBadgeClass(item.status)} inline-block mb-1.5`}>
                            {item.status}
                          </span>
                          <div className="text-xs text-slate-400 truncate max-w-[220px]" title={item.rawPayload?.Shipment?.Status?.Instructions}>
                            {item.rawPayload?.Shipment?.Status?.Instructions || 'Awaiting update'}
                          </div>
                        </td>
                        <td className="py-5 px-6 text-sm text-slate-300 font-medium">
                          {item.destination}
                        </td>
                        <td className="py-5 px-6 text-sm">
                          <div className="text-slate-200 font-bold">
                            {item.rawPayload?.Shipment?.OrderType || item.payment || 'N/A'}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {!isFetchingDb && filteredData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-32 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-500 space-y-4">
                            <div className="bg-slate-900/50 p-6 rounded-full border border-slate-800">
                              <Search className="w-12 h-12 text-slate-600" />
                            </div>
                            <p className="text-xl font-semibold text-slate-300">Track an AWB to preview the table</p>
                            <p className="text-sm max-w-md mx-auto text-slate-500">Search for a Waybill on the right, and it will appear here automatically.<br/>Once webhooks are configured, this will happen by itself!</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-900/60 p-4 border-t border-slate-800/50 flex justify-between items-center w-full mt-auto">
                <span className="text-xs font-medium text-slate-500">
                  {isUsingRealData ? 'Live Data Visible' : 'Awaiting Data...'}
                </span>
                <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                  <span className="text-xs text-emerald-400 font-bold">Auto-refreshing (10s)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration & Tracking Section (Right) - 4 cols */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Webhook Configuration Card */}
            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-indigo-500/30">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-indigo-300">
                <Database className="w-5 h-5" />
                Webhook Config
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">Your Webhook URL</label>
                  <div className="p-3 bg-[#0a0f1d] border border-indigo-500/20 rounded-xl text-sm text-slate-300 font-mono break-all selection:bg-indigo-500/30">
                    https://[YOUR-VERCEL-URL]/api/webhook
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Paste your actual Vercel URL above into the <strong>Delhivery One</strong> Portal &gt; Settings &gt; API/Webhooks. As soon as you do, this dashboard will start receiving real-time OFD orders.
                </p>
              </div>
            </div>

            <h2 className="text-xl font-semibold flex items-center gap-2 mt-8 text-white">
              <Search className="w-5 h-5 text-emerald-400" />
              Live Track Order
            </h2>
            
            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-slate-800/60">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <form onSubmit={handleTrack} className="relative mb-6">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Enter AWB (Waybill) Number</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Package className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      value={searchAwb}
                      onChange={(e) => setSearchAwb(e.target.value)}
                      placeholder="e.g. 57670410041576"
                      className="block w-full pl-11 pr-4 py-3 bg-[#0a0f1d] border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner font-medium text-base"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[110px]"
                  >
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Track'}
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 font-medium leading-relaxed">{error}</p>
                </div>
              )}

              {liveShipment && (
                <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                  <div className="p-6 bg-[#0a0f1d] rounded-2xl border border-slate-700/60 shadow-inner space-y-6">
                    
                    {/* Header: Status & AWB */}
                    <div className="flex flex-wrap justify-between items-start gap-4 pb-5 border-b border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Current Status</div>
                        <div className="text-xl font-black text-emerald-400 flex items-center gap-2">
                          <CheckCircle className="w-6 h-6" />
                          {liveShipment.Status?.Status || 'Unknown'}
                        </div>
                        <div className="text-xs font-medium text-slate-400 mt-1.5 bg-slate-800/50 inline-block px-2.5 py-1 rounded-md">
                          {liveShipment.Status?.Instructions || 'No extra info'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">AWB / Ref</div>
                        <div className="font-mono text-slate-200 font-bold text-lg">{liveShipment.AWB}</div>
                        <div className="text-xs font-mono text-slate-500 mt-1">{liveShipment.ReferenceNo}</div>
                      </div>
                    </div>

                    {/* Customer & Order Type */}
                    <div className="grid grid-cols-2 gap-6 pb-5 border-b border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Consignee</div>
                        <div className="text-base text-slate-200 font-bold leading-tight">{liveShipment.Consignee?.Name || 'N/A'}</div>
                        <div className="text-xs text-slate-400 mt-1.5 font-medium leading-relaxed">
                          {liveShipment.Consignee?.City ? `${liveShipment.Consignee.City}, ` : ''}{liveShipment.Consignee?.State}<br/>
                          {liveShipment.Consignee?.PinCode ? `PIN: ${liveShipment.Consignee.PinCode}` : ''}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Order Type</div>
                        <div className="flex flex-col gap-1.5">
                          <span className={`w-max px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${liveShipment.OrderType === 'COD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                            {liveShipment.OrderType || 'N/A'}
                          </span>
                          <span className="text-xl text-slate-200 font-black mt-1">₹{liveShipment.CODAmount || liveShipment.InvoiceAmount || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Routing Details */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Current Location</div>
                          <div className="text-sm text-slate-200 font-semibold break-words">
                            {liveShipment.Status?.StatusLocation || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30 flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-widest mb-1">Expected Delivery</div>
                          <div className="text-sm text-emerald-400 font-bold">
                            {formatDate(liveShipment.ExpectedDeliveryDate || liveShipment.PromisedDeliveryDate)}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
}
