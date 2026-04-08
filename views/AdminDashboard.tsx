import React, { useState, useEffect, useRef } from 'react';
import { User, Resource, FarmerResource, Order, Delivery } from '../types';
import { db } from '../services/db';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with React
// We'll use custom DivIcons instead to avoid asset loading issues
const farmerIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="w-6 h-6 bg-emerald-500 rounded-full border-2 border-white shadow-lg animate-pulse flex items-center justify-center text-white text-[10px] font-bold">F</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const driverIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="w-6 h-6 bg-slate-900 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">D</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const buyerIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">B</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const getLoc = (loc: any) => {
  if (!loc) return null;
  let parsed = loc;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) {}
  }
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) {}
  }
  return parsed;
};

interface Props {
  user: User;
}

const SupplyChainMap: React.FC<{ farmers: User[]; drivers: User[]; buyers: User[] }> = ({ farmers, drivers, buyers }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    const bounds = L.latLngBounds([]);

    const seenCoords = new Set<string>();
    const getOffsetCoords = (baseLat: number, baseLng: number) => {
      let lat = baseLat;
      let lng = baseLng;
      let key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      let radius = 0.00015; // roughly 15 meters
      let angle = 0;
      
      while (seenCoords.has(key)) {
        lat = baseLat + radius * Math.cos(angle);
        lng = baseLng + radius * Math.sin(angle);
        key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        angle += Math.PI / 4;
        if (angle >= Math.PI * 2) {
          angle = 0;
          radius += 0.00015;
        }
      }
      seenCoords.add(key);
      return [lat, lng];
    };

    farmers.forEach((f, i) => {
        const loc = getLoc(f.location);
        let lat = loc?.lat !== undefined ? Number(loc.lat) : 0;
        let lng = loc?.lng !== undefined ? Number(loc.lng) : 0;
        if (!lat && !lng) {
            lat = 20.5937 + (Math.sin(i) * 5);
            lng = 78.9629 + (Math.cos(i) * 5);
        }
        const [offsetLat, offsetLng] = getOffsetCoords(lat, lng);
        const marker = L.marker([offsetLat, offsetLng], { icon: farmerIcon, zIndexOffset: 1000 })
            .bindPopup(`<div class="text-center"><p class="font-bold">${f.name}</p><p class="text-xs text-slate-500">Farmer • ${loc?.address || 'Unknown Location'}</p></div>`);
        markersLayerRef.current?.addLayer(marker);
        bounds.extend([offsetLat, offsetLng]);
    });

    drivers.forEach((d, i) => {
        const loc = getLoc(d.location);
        let lat = loc?.lat !== undefined ? Number(loc.lat) : 0;
        let lng = loc?.lng !== undefined ? Number(loc.lng) : 0;
        if (!lat && !lng) {
            lat = 22.5937 + (Math.sin(i) * 3);
            lng = 76.9629 + (Math.cos(i) * 3);
        }
        const [offsetLat, offsetLng] = getOffsetCoords(lat, lng);
        const marker = L.marker([offsetLat, offsetLng], { icon: driverIcon, zIndexOffset: 800 })
            .bindPopup(`<div class="text-center"><p class="font-bold">${d.name}</p><p class="text-xs text-slate-500">Driver • ${loc?.address || 'Unknown Location'}</p></div>`);
        markersLayerRef.current?.addLayer(marker);
        bounds.extend([offsetLat, offsetLng]);
    });

    buyers.forEach((b, i) => {
        const loc = getLoc(b.location);
        let lat = loc?.lat !== undefined ? Number(loc.lat) : 0;
        let lng = loc?.lng !== undefined ? Number(loc.lng) : 0;
        if (!lat && !lng) {
            lat = 18.5937 + (Math.sin(i) * 4);
            lng = 74.9629 + (Math.cos(i) * 4);
        }
        const [offsetLat, offsetLng] = getOffsetCoords(lat, lng);
        const marker = L.marker([offsetLat, offsetLng], { icon: buyerIcon, zIndexOffset: 600 })
            .bindPopup(`<div class="text-center"><p class="font-bold">${b.name}</p><p class="text-xs text-slate-500">Buyer • ${loc?.address || 'Unknown Location'}</p></div>`);
        markersLayerRef.current?.addLayer(marker);
        bounds.extend([offsetLat, offsetLng]);
    });

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [farmers, drivers, buyers]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
};

const AdminDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'resources' | 'logistics' | 'financial' | 'farmers'>('resources');
  const [resources, setResources] = useState<Resource[]>([]);
  const [farmers, setFarmers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [buyers, setBuyers] = useState<User[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [farmerResources, setFarmerResources] = useState<FarmerResource[]>([]);
  const [newResource, setNewResource] = useState({ name: '', type: 'seed', customType: '', cost: '', unit: 'kg', stock: '' });
  const [assignData, setAssignData] = useState({ farmerId: '', resourceId: '', quantity: '', driverId: '' });
  const [error, setError] = useState<string | null>(null);
  
  // Farmer Deep Dive State
  const [selectedFarmer, setSelectedFarmer] = useState<User | null>(null);
  const [farmerProfileData, setFarmerProfileData] = useState<{
    resources: FarmerResource[];
    logs: any[];
    orders: Order[];
  } | null>(null);

  useEffect(() => {
    loadData();

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#admin-')) {
        const tab = hash.replace('#admin-', '');
        const validTabs = ['resources', 'logistics', 'financial', 'farmers'];
        if (validTabs.includes(tab)) {
          setActiveTab(tab as any);
          setSelectedFarmer(null);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const loadData = async () => {
    const r = await db.resources.find({});
    setResources(r);
    const f = await db.users.find({ role: 'farmer' });
    setFarmers(f);
    const d = await db.users.find({ role: 'driver' });
    setDrivers(d);
    const b = await db.users.find({ role: 'buyer' });
    setBuyers(b);
    const o = await db.orders.find({});
    setOrders(o);
    const del = await db.deliveries.find({});
    setDeliveries(del);
    const fr = await db.farmerResources.find({});
    setFarmerResources(fr);
  };

  const loadFarmerDetails = async (farmerId: string) => {
    const fr = await db.farmerResources.find({ farmerId });
    const logs = await db.growthLogs.find({ farmerId });
    const farmerOrders = orders.filter(o => o.farmerId === farmerId);
    setFarmerProfileData({ resources: fr, logs, orders: farmerOrders });
  };

  const handleFarmerClick = async (farmer: User) => {
    setSelectedFarmer(farmer);
    await loadFarmerDetails(farmer.id);
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const stockVal = parseInt(newResource.stock);
    if (isNaN(stockVal) || stockVal < 0) {
      alert("Stock quantity cannot be negative.");
      return;
    }
    const res: Resource = {
      id: Math.random().toString(36).substr(2, 9),
      name: newResource.name,
      type: (newResource.type === 'other' ? newResource.customType : newResource.type) as any,
      cost: parseFloat(newResource.cost),
      unit: newResource.unit,
      stock: stockVal
    };
    await db.resources.insertOne(res);
    setNewResource({ name: '', type: 'seed', customType: '', cost: '', unit: 'kg', stock: '' });
    loadData();
  };

  const handleAssignResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!assignData.farmerId || !assignData.resourceId) return;
    
    const resource = resources.find(r => r.id === assignData.resourceId);
    if (!resource) return;

    const qty = parseFloat(assignData.quantity);
    if (isNaN(qty) || qty <= 0) return;

    if (qty > resource.stock) {
      setError(`Insufficient stock! Only ${resource.stock} units of ${resource.name} available.`);
      return;
    }

    const totalCost = qty * resource.cost;

    try {
      const assignment: FarmerResource = {
        id: Math.random().toString(36).substr(2, 9),
        farmerId: assignData.farmerId,
        resourceId: assignData.resourceId,
        quantity: qty,
        totalCost: totalCost,
        status: 'assigned',
        date: new Date().toISOString(),
        driverId: assignData.driverId || undefined
      };

      await db.farmerResources.insertOne(assignment);

      setAssignData({ farmerId: '', resourceId: '', quantity: '', driverId: '' });
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to assign resource");
    }
  };

  const handleAssignDriverToOrder = async (orderId: string, driverId: string) => {
    if (!driverId) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const farmer = farmers.find(f => f.id === order.farmerId);
    const pickup = getLoc(farmer?.location)?.address || order.farmName;

    const delivery: Delivery = {
      id: Math.random().toString(36).substr(2, 9),
      orderId: orderId,
      driverId: driverId,
      pickupLocation: pickup,
      dropoffLocation: order.buyerLocation || 'Unknown',
      status: 'assigned',
      timestamp: new Date().toISOString()
    };

    await db.deliveries.insertOne(delivery);
    loadData();
  };

  const handleAssignDriverToResource = async (farmerResourceId: string, driverId: string) => {
    if (!driverId) return;
    await db.farmerResources.updateOne(farmerResourceId, { driverId, status: 'assigned' });
    loadData();
  };

  const handleApproveResourceRequest = async (requestId: string) => {
    const request = farmerResources.find(r => r.id === requestId);
    if (!request) return;

    const farmer = farmers.find(f => f.id === request.farmerId);
    if (farmer) {
      const currentDebt = farmer.materialDebt || 0;
      await db.users.updateOne(request.farmerId, { materialDebt: currentDebt + request.totalCost });
    }

    await db.farmerResources.updateOne(requestId, { status: 'assigned' });
    loadData();
  };

  const handleRejectResourceRequest = async (requestId: string) => {
    await db.farmerResources.deleteOne(requestId);
    loadData();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-65px)] bg-slate-50 relative">
      {/* Desktop Sidebar - Hidden on Mobile */}
      <nav className="hidden md:flex flex-col w-72 lg:w-80 bg-white border-r border-slate-200 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto no-scrollbar p-6">
        <div className="pb-6 px-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">ADMIN PANEL</h3>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { id: 'resources', label: 'Resources', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { id: 'logistics', label: 'Logistics', icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
            { id: 'financial', label: 'Financial', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'farmers', label: 'Farmers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => { setActiveTab(item.id as any); setSelectedFarmer(null); }}
              className={`flex items-center gap-5 px-7 py-5 rounded-[1.8rem] transition-all font-black text-xs uppercase tracking-widest border-2 ${activeTab === item.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 lg:p-12 pt-20 w-full overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-serif text-slate-900 tracking-tight">Admin Command Center</h1>
        </div>

        {activeTab === 'farmers' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            {!selectedFarmer ? (
              <>
                <h2 className="text-2xl font-serif text-slate-900 mb-6">Farmer Directory</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {farmers.map(f => (
                    <div key={f.id} onClick={() => handleFarmerClick(f)} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-lg transition-all cursor-pointer group">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xl">
                          {f.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{f.name}</h3>
                          <p className="text-xs text-slate-500">{getLoc(f.location)?.address || 'Unknown Location'}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                        <div className="text-xs">
                          <span className="text-slate-400 uppercase font-black tracking-wider">Trust</span>
                          <p className="font-bold text-slate-900">{f.trustScore?.toFixed(1) || '0.0'}</p>
                        </div>
                        <div className="text-xs text-center">
                          <span className="text-slate-400 uppercase font-black tracking-wider">Wallet</span>
                          <p className="font-bold text-emerald-600">
                            ₹{(
                              Number(f.walletBalance) || 
                              orders
                                .filter(o => o.farmerId === f.id && o.status === 'delivered')
                                .reduce((acc, o) => acc + (Number(o.totalPrice) * 0.7) - (Number(o.debtPaid) || 0), 0)
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-xs text-right">
                          <span className="text-slate-400 uppercase font-black tracking-wider">Debt</span>
                          <p className="font-bold text-red-500">₹{f.materialDebt?.toLocaleString() || '0'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => setSelectedFarmer(null)} className="mb-6 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 flex items-center gap-2">
                  ← Back to Directory
                </button>
                
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-serif text-slate-900">{selectedFarmer.name}</h2>
                    <p className="text-slate-500">{getLoc(selectedFarmer.location)?.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Trust Score</p>
                    <p className="text-4xl font-serif text-emerald-600">{selectedFarmer.trustScore?.toFixed(1) || '0.0'}</p>
                  </div>
                </div>

                {farmerProfileData && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Financial Ledger */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Financial Ledger</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Input Debt</p>
                          <p className="text-2xl font-bold text-slate-900">₹{Number(selectedFarmer.materialDebt || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm relative group/balance">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Wallet Balance</p>
                          <div className="flex items-center justify-between">
                            <p className="text-2xl font-bold text-slate-900">
                              ₹{(
                                Number(selectedFarmer.walletBalance) || 
                                farmerProfileData.orders
                                  .filter(o => o.status === 'delivered')
                                  .reduce((acc, o) => acc + (Number(o.totalPrice) * 0.7) - (Number(o.debtPaid) || 0), 0)
                              ).toLocaleString()}
                            </p>
                            <button 
                              onClick={async () => {
                                const current = Number(selectedFarmer.walletBalance) || farmerProfileData.orders
                                  .filter(o => o.status === 'delivered')
                                  .reduce((acc, o) => acc + (Number(o.totalPrice) * 0.7) - (Number(o.debtPaid) || 0), 0);
                                
                                const newBalance = prompt("Enter new wallet balance:", current.toString());
                                if (newBalance !== null && !isNaN(parseFloat(newBalance))) {
                                  const balance = parseFloat(newBalance);
                                  await db.users.updateOne(selectedFarmer.id, { walletBalance: balance });
                                  setSelectedFarmer({ ...selectedFarmer, walletBalance: balance });
                                  setFarmers(prev => prev.map(f => f.id === selectedFarmer.id ? { ...f, walletBalance: balance } : f));
                                  alert("Balance updated successfully!");
                                }
                              }}
                              className="opacity-0 group-hover/balance:opacity-100 transition-opacity text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        <div className="bg-white/50 p-3 rounded-xl col-span-2 flex justify-between items-center text-[10px]">
                          <div className="text-slate-400 uppercase font-black tracking-wider">Total Gross (70%)</div>
                          <div className="font-bold text-slate-600">
                            ₹{farmerProfileData.orders
                              .filter(o => o.status === 'delivered')
                              .reduce((acc, o) => acc + (Number(o.totalPrice) * 0.7), 0)
                              .toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white/50 p-3 rounded-xl col-span-2 flex justify-between items-center text-[10px]">
                          <div className="text-slate-400 uppercase font-black tracking-wider">Debt Repaid</div>
                          <div className="font-bold text-red-400">
                            -₹{farmerProfileData.orders
                              .filter(o => o.status === 'delivered')
                              .reduce((acc, o) => acc + (Number(o.debtPaid) || 0), 0)
                              .toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Current Assets */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Current Assets</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {farmerProfileData.resources.filter(r => r.status !== 'consumed').map(r => (
                          <div key={r.id} className="flex justify-between items-center bg-white p-3 rounded-xl text-sm">
                            <span className="font-bold text-slate-700">{r.resourceName}</span>
                            <span className="text-slate-500">{r.quantity} units</span>
                            <span className={`text-[10px] uppercase font-black px-2 py-1 rounded ${r.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{r.status}</span>
                          </div>
                        ))}
                        {farmerProfileData.resources.filter(r => r.status !== 'consumed').length === 0 && <p className="text-slate-400 italic text-sm">No active assets.</p>}
                      </div>
                    </div>

                    {/* Live Progress */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 lg:col-span-2">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Live Progress</h3>
                      <div className="flex gap-4 overflow-x-auto pb-4">
                        {farmerProfileData.logs.map(log => (
                          <div key={log.id} className="min-w-[200px] bg-white p-3 rounded-2xl shadow-sm">
                            <img src={log.imageUrl} className="w-full h-32 object-cover rounded-xl mb-3" alt="Crop" />
                            <p className="font-bold text-slate-900 text-sm">{log.stage}</p>
                            <p className="text-xs text-slate-500">{new Date(log.date).toLocaleDateString()}</p>
                          </div>
                        ))}
                        {farmerProfileData.logs.length === 0 && <p className="text-slate-400 italic text-sm">No growth logs uploaded.</p>}
                      </div>
                    </div>

                    {/* Order History */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 lg:col-span-2">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Order History</h3>
                      <table className="w-full text-left">
                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="pb-3">Order ID</th>
                            <th className="pb-3">Buyer</th>
                            <th className="pb-3">Amount</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {farmerProfileData.orders.map(o => (
                            <tr key={o.id} className="border-t border-slate-200">
                              <td className="py-3 font-mono text-slate-500">#{o.id.substr(0,6)}</td>
                              <td className="py-3">{o.buyerName}</td>
                              <td className="py-3 font-bold">₹{o.totalPrice}</td>
                              <td className="py-3"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${o.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{o.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Inventory Management */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h2 className="text-2xl font-serif text-slate-900 mb-6">Resource Inventory</h2>
              <form onSubmit={handleAddResource} className="grid grid-cols-2 gap-4 mb-8">
                <input type="text" placeholder="Resource Name" className="p-3 bg-slate-50 rounded-xl font-bold text-sm" value={newResource.name} onChange={e => setNewResource({...newResource, name: e.target.value})} required />
                <select className="p-3 bg-slate-50 rounded-xl font-bold text-sm" value={newResource.type} onChange={e => setNewResource({...newResource, type: e.target.value})}>
                  <option value="seed">Seed</option>
                  <option value="fertilizer">Fertilizer</option>
                  <option value="tool">Tool</option>
                  <option value="other">Other</option>
                </select>
                {newResource.type === 'other' && (
                  <input type="text" placeholder="What is it?" className="col-span-2 p-3 bg-slate-50 rounded-xl font-bold text-sm border-2 border-emerald-200 focus:border-emerald-500 outline-none" value={newResource.customType} onChange={e => setNewResource({...newResource, customType: e.target.value})} required />
                )}
                <input type="number" placeholder="Cost per Unit (₹)" className="p-3 bg-slate-50 rounded-xl font-bold text-sm" value={newResource.cost} onChange={e => setNewResource({...newResource, cost: e.target.value})} required />
                <input type="number" placeholder="Stock Qty" className="p-3 bg-slate-50 rounded-xl font-bold text-sm" value={newResource.stock} onChange={e => setNewResource({...newResource, stock: e.target.value})} required min="0" />
                <button type="submit" className="col-span-2 bg-emerald-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs">Add to Inventory</button>
              </form>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {resources.map(r => (
                  <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{r.type} • ₹{r.cost}/{r.unit}</p>
                    </div>
                    <div className="font-black text-slate-900">{r.stock} in stock</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatch / Assignment */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h2 className="text-2xl font-serif text-slate-900 mb-6">Dispatch to Farmer</h2>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p className="text-sm font-bold">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              )}

              <form onSubmit={handleAssignResource} className="space-y-4">
                <select className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm" value={assignData.farmerId} onChange={e => setAssignData({...assignData, farmerId: e.target.value})}>
                  <option value="">Select Farmer</option>
                  {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm" value={assignData.resourceId} onChange={e => setAssignData({...assignData, resourceId: e.target.value})}>
                  <option value="">Select Resource</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.name} (₹{r.cost}/{r.unit})</option>)}
                </select>
                <input type="number" placeholder="Quantity" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm" value={assignData.quantity} onChange={e => setAssignData({...assignData, quantity: e.target.value})} />
                <select className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm" value={assignData.driverId} onChange={e => setAssignData({...assignData, driverId: e.target.value})}>
                  <option value="">Select Driver (Optional)</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl">Dispatch & Charge Debt</button>
              </form>
            </div>

            {/* Pending Requests */}
            {farmerResources.filter(fr => fr.status === 'requested').length > 0 && (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
                <h2 className="text-2xl font-serif text-slate-900 mb-6">Pending Resource Requests</h2>
                <div className="space-y-4">
                  {farmerResources.filter(fr => fr.status === 'requested').map(fr => {
                    const farmer = farmers.find(f => f.id === fr.farmerId);
                    return (
                      <div key={fr.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-amber-50 rounded-xl border border-amber-100 gap-4">
                        <div>
                          <p className="font-bold text-slate-900">{fr.resourceName} <span className="text-slate-500 font-normal">x {fr.quantity}</span></p>
                          <p className="text-xs text-slate-500">Requested by: <span className="font-bold">{farmer?.name || 'Unknown'}</span></p>
                          <p className="text-xs text-red-500 font-bold mt-1">Total Cost: ₹{fr.totalCost}</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button onClick={() => handleApproveResourceRequest(fr.id)} className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700">Approve</button>
                          <button onClick={() => handleRejectResourceRequest(fr.id)} className="flex-1 md:flex-none bg-red-100 text-red-600 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-red-200">Reject</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logistics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <h2 className="text-2xl font-serif text-slate-900 mb-6 relative z-10">Live Supply Chain Map</h2>
              {/* Map UI */}
              <div className="w-full h-72 md:h-96 rounded-2xl relative overflow-hidden border border-slate-300 z-10">
                <SupplyChainMap farmers={farmers} drivers={drivers} buyers={buyers} />
                
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-xs font-bold shadow-lg border border-slate-100 z-[1000]">
                  <div className="flex items-center gap-2 mb-2"><div className="w-4 h-4 bg-emerald-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">F</div> Farmer</div>
                  <div className="flex items-center gap-2 mb-2"><div className="w-4 h-4 bg-slate-900 rounded-full text-[8px] text-white flex items-center justify-center font-bold">D</div> Driver</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">B</div> Buyer</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h2 className="text-2xl font-serif text-slate-900 mb-6">All Logistics</h2>
              <div className="space-y-6">
                {/* Resource Delivery Requests */}
                {farmerResources.filter(fr => fr.deliveryRequested && !fr.driverId).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Resource Requests</h3>
                    {farmerResources.filter(fr => fr.deliveryRequested && !fr.driverId).map(fr => {
                      const farmer = farmers.find(f => f.id === fr.farmerId);
                      return (
                        <div key={fr.id} className="p-4 rounded-2xl border bg-emerald-50 border-emerald-100">
                          <div className="flex justify-between mb-2">
                            <span className="font-bold text-slate-900">{fr.resourceName}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Requested</span>
                          </div>
                          <div className="text-xs text-slate-500 space-y-1 mb-3">
                            <p>Farmer: <span className="font-bold">{farmer?.name || 'Unknown'}</span></p>
                            <p>Location: {getLoc(farmer?.location)?.address || 'Unknown'}</p>
                            <p>Quantity: {fr.quantity} units</p>
                          </div>
                          <div className="mt-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Assign Driver</label>
                            <select 
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none shadow-sm"
                              onChange={(e) => handleAssignDriverToResource(fr.id, e.target.value)}
                              defaultValue=""
                            >
                              <option value="" disabled>Select Driver</option>
                              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Forward & Reverse Logistics (Orders) */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Logistics</h3>
                  {orders.map(o => {
                  const delivery = deliveries.find(d => d.orderId === o.id);
                  const assignedDriver = delivery ? drivers.find(d => d.id === delivery.driverId) : null;

                  return (
                    <div key={o.id} className={`p-4 rounded-2xl border ${!!o.driverRequested && !assignedDriver ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-900">#{o.id.substr(0,6)}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{o.status}</span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1 mb-3">
                        <p>From: <span className="font-bold">{o.farmName}</span></p>
                        <p>To: {o.buyerName}</p>
                        {!!o.driverRequested && !assignedDriver && (
                          <div className="mt-2 flex items-center gap-2 text-red-600 animate-pulse">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                             <p className="text-[10px] font-black uppercase tracking-widest">Driver Requested by Farmer</p>
                          </div>
                        )}
                      </div>
                      
                      {assignedDriver ? (
                        <div className="flex items-center gap-2 mt-2 bg-white p-2 rounded-lg border border-slate-200">
                            <div className="w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{assignedDriver.name.charAt(0)}</div>
                            <span className="text-xs font-bold text-slate-700">{assignedDriver.name}</span>
                            <span className="ml-auto text-[9px] font-black text-emerald-600 uppercase tracking-widest">Assigned</span>
                        </div>
                      ) : (
                        !!o.driverRequested && (
                          <div className="mt-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Assign Driver</label>
                            <select 
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-slate-900 outline-none shadow-sm"
                              onChange={(e) => handleAssignDriverToOrder(o.id, e.target.value)}
                              defaultValue=""
                            >
                              <option value="" disabled>Select Driver</option>
                              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
                {orders.length === 0 && (
                  <p className="text-slate-400 italic text-center py-8">No logistics data available.</p>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-2xl font-serif text-slate-900 mb-6">Razorpay Route Splits</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
               <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Volume</p>
                 <p className="text-3xl font-serif text-slate-900">₹{orders.reduce((acc, o) => acc + o.totalPrice, 0).toLocaleString()}</p>
               </div>
               <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Farmer Payout (70%)</p>
                 <p className="text-2xl font-serif text-slate-900">₹{orders.reduce((acc, o) => acc + (Number(o.totalPrice) * 0.7), 0).toLocaleString()}</p>
               </div>
               <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Current Wallets</p>
                 <p className="text-2xl font-serif text-slate-900">
                   ₹{farmers.reduce((acc, f) => {
                     const balance = Number(f.walletBalance) || orders
                       .filter(o => o.farmerId === f.id && o.status === 'delivered')
                       .reduce((sum, o) => sum + (Number(o.totalPrice) * 0.7) - (Number(o.debtPaid) || 0), 0);
                     return acc + balance;
                   }, 0).toLocaleString()}
                 </p>
               </div>
               <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Logistics (15%)</p>
                 <p className="text-2xl font-serif text-slate-900">₹{orders.reduce((acc, o) => acc + (o.totalPrice * 0.15), 0).toLocaleString()}</p>
               </div>
               <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Platform (15%)</p>
                 <p className="text-2xl font-serif text-slate-900">₹{orders.reduce((acc, o) => acc + (o.totalPrice * 0.15), 0).toLocaleString()}</p>
               </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-4">Transaction Ledger</h3>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Farmer</th>
                    <th className="px-6 py-4">Admin/Debt</th>
                    <th className="px-6 py-4">Driver</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(o => (
                    <tr key={o.id} className="text-sm">
                      <td className="px-6 py-4 font-mono text-slate-500">#{o.id.substr(0,6)}</td>
                      <td className="px-6 py-4 font-bold">₹{o.totalPrice}</td>
                      <td className="px-6 py-4 text-emerald-600">+₹{Number(o.totalPrice * 0.7).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">+₹{Number(o.totalPrice * 0.1).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">+₹{Number(o.totalPrice * 0.15).toLocaleString()}</td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{o.status === 'delivered' ? 'SETTLED' : 'ESCROW'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {orders.map(o => (
                <div key={o.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-slate-500 text-xs">#{o.id.substr(0,6)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {o.status === 'delivered' ? 'SETTLED' : 'ESCROW'}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Amount</p>
                      <p className="text-lg font-bold text-slate-900">₹{o.totalPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Farmer: +₹{Number(o.totalPrice * 0.7).toLocaleString()}</p>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Admin: +₹{Number(o.totalPrice * 0.1).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
