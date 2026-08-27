'use client';

import React, { useState, useEffect } from 'react';
import { Package, Search, Truck, MapPin, Calendar, Clock, CheckCircle, AlertCircle, RefreshCw, ShoppingBag, Database } from 'lucide-react';
import { format } from 'date-fns';

// Fallback Mock data for presentation when DB is empty
const MOCK_DATA = [
  { awb: '10987654321', orderId: 'ORD-2023-001', status: 'Out for Delivery', destination: 'Mumbai, MH', executive: 'Ramesh K. (9876543210)', payment: 'Prepaid', product: 'Ayurvedic Hair Oil (Set of 2)' },
  { awb: '10987654322', orderId: 'ORD-2023-002', status: 'Out for Delivery', destination: 'Delhi, DL', executive: 'Suresh S. (9876543211)', payment: 'COD - ₹1,499', product: 'Ashwagandha Tablets (60 pcs)' },
  { awb: '10987654323', orderId: 'ORD-2023-003', status: 'In Transit', destination: 'Bangalore, KA', executive: 'Not Assigned', payment: 'Prepaid', product: 'Vitamin C Face Serum' },
  { awb: '10987654324', orderId: 'ORD-2023-004', status: 'Out for Delivery', destination: 'Pune, MH', executive: 'Amit Patel (9876543212)', payment: 'COD - ₹899', product: 'Triphala Churna 500g' },
];

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
          setDbOrders(json.data);
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

  // Use real DB data if available, otherwise use mock data for presentation
  const displayData = dbOrders.length > 0 ? dbOrders : MOCK_DATA;

  const filteredData = activeTab === 'ofd' 
    ? displayData.filter(item => (item.status || '').toLowerCase().includes('out for delivery'))
    : displayData;

  const isUsingRealData = dbOrders.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/30">
              <Truck className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                Logistics Command Center
              </h1>
              <p className="text-slate-400 mt-1">Real-Time Delhivery OFD Dashboard</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-3 bg-slate-900/80 p-2 pl-4 pr-4 rounded-full border border-slate-700/50">
              <div className={`w-2 h-2 rounded-full ${isUsingRealData ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
              <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4" /> 
                {isUsingRealData ? 'Live Webhooks Connected' : 'Waiting for Webhooks... (Mock Mode)'}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Main Table Section (Left / Center) */}
          <div className="xl:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                Active Shipments
              </h2>
              
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All Active ({displayData.length})
                </button>
                <button 
                  onClick={() => setActiveTab('ofd')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${activeTab === 'ofd' ? 'bg-indigo-600/20 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                  OFD Only ({displayData.filter(i => (i.status||'').toLowerCase().includes('out for delivery')).length})
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl relative">
              {isFetchingDb && dbOrders.length === 0 && (
                <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 backdrop-blur-sm">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-800/50">
                      <th className="py-4 px-6 font-medium text-slate-400 text-sm uppercase tracking-wider">Waybill / Order</th>
                      <th className="py-4 px-6 font-medium text-slate-400 text-sm uppercase tracking-wider">Product</th>
                      <th className="py-4 px-6 font-medium text-slate-400 text-sm uppercase tracking-wider">Status</th>
                      <th className="py-4 px-6 font-medium text-slate-400 text-sm uppercase tracking-wider">Destination</th>
                      <th className="py-4 px-6 font-medium text-slate-400 text-sm uppercase tracking-wider">Executive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredData.map((item: any, idx: number) => (
                      <tr key={item._id || idx} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors">{item.awb}</div>
                          <div className="text-xs text-slate-500 mt-1">{item.orderId}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-300 font-medium">{item.product || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`status-badge ${getStatusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-300">
                          {item.destination}
                        </td>
                        <td className="py-4 px-6 text-sm">
                          <div className="text-slate-300">{(item.executive || 'Pending').split(' (')[0]}</div>
                        </td>
                      </tr>
                    ))}
                    
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          No orders found for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-900/40 p-4 border-t border-slate-800/50 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  {isUsingRealData ? 'Live Data from MongoDB (Auto-refreshing every 10s)' : '* Showing placeholder data (Connect Webhooks to see live data)'}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                  <span className="text-xs text-emerald-400 font-medium">Live Polling Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration & Tracking Section (Right) */}
          <div className="space-y-6">
            
            {/* Webhook Configuration Card */}
            <div className="glass-panel rounded-2xl p-6 shadow-2xl relative overflow-hidden border-indigo-500/30 border">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-indigo-300">
                <Database className="w-5 h-5" />
                Webhook Config
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Your Webhook URL</label>
                  <div className="p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono break-all selection:bg-indigo-500/30">
                    https://your-vercel-app.com/api/webhook
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Paste the URL above into the <strong>Delhivery One</strong> Portal &gt; Settings &gt; API/Webhooks. As soon as you do, this dashboard will start receiving real-time OFD orders.
                </p>
              </div>
            </div>

            <h2 className="text-xl font-semibold flex items-center gap-2 mt-8">
              <Search className="w-5 h-5 text-emerald-400" />
              Live Track Order
            </h2>
            
            <div className="glass-panel rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <form onSubmit={handleTrack} className="relative">
                <label className="block text-sm font-medium text-slate-400 mb-2">Enter AWB (Waybill) Number</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Package className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      value={searchAwb}
                      onChange={(e) => setSearchAwb(e.target.value)}
                      placeholder="e.g. 10987654321"
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                  >
                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Track'}
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                </div>
              )}

              {trackingData && trackingData.ShipmentData && (
                <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
                  <div className="p-5 bg-slate-900/60 rounded-xl border border-slate-700/50 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Status</div>
                        <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          {trackingData.ShipmentData[0]?.Shipment?.Status?.Status || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">AWB</div>
                        <div className="font-mono text-slate-300">{trackingData.ShipmentData[0]?.Shipment?.AWB}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                      <div>
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Origin</div>
                        <div className="text-sm text-slate-300 font-medium truncate" title={trackingData.ShipmentData[0]?.Shipment?.Origin}>
                          {trackingData.ShipmentData[0]?.Shipment?.Origin || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Destination</div>
                        <div className="text-sm text-slate-300 font-medium truncate" title={trackingData.ShipmentData[0]?.Shipment?.Destination}>
                          {trackingData.ShipmentData[0]?.Shipment?.Destination || 'N/A'}
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
