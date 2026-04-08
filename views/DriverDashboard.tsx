import React, { useState, useEffect } from 'react';
import { User, Order, Delivery } from '../types';
import { db } from '../services/db';

interface Props {
  user: User;
}

const DriverDashboard: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'forward' | 'reverse' | 'wallet'>('forward');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [resourceDeliveries, setResourceDeliveries] = useState<FarmerResource[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [activeResourceDelivery, setActiveResourceDelivery] = useState<FarmerResource | null>(null);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    // Forward Logistics (Orders)
    const d = await db.deliveries.find({ driverId: user.id });
    setDeliveries(d);
    const o = await db.orders.find({});
    setOrders(o);
    const active = d.find(del => del.status !== 'delivered');
    if (active) setActiveDelivery(active);

    // Reverse Logistics (Resources)
    const rd = await db.farmerResources.find({ driverId: user.id });
    setResourceDeliveries(rd);
    const activeRes = rd.find(r => r.status !== 'delivered' && r.status !== 'consumed');
    if (activeRes) setActiveResourceDelivery(activeRes);
  };

  const handleStatusUpdate = async (deliveryId: string, newStatus: 'picked_up' | 'delivered') => {
    await db.deliveries.updateOne(deliveryId, { status: newStatus });
    
    // Update order status as well
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      const orderStatus = newStatus === 'picked_up' ? 'picked_up' : 'delivered';
      await db.orders.updateOne(delivery.orderId, { status: orderStatus });

      // If delivered, handle UI feedback
      if (newStatus === 'delivered') {
        alert("Delivery Completed! Payment Released.");
      }
    }
    
    if (newStatus === 'delivered') {
      setActiveDelivery(null);
    }
    
    loadData();
  };

  const handleResourceStatusUpdate = async (resourceId: string, newStatus: 'picked_up' | 'delivered') => {
    await db.farmerResources.updateOne(resourceId, { status: newStatus });
    
    if (newStatus === 'delivered') {
      setActiveResourceDelivery(null);
      alert("Resource Delivered to Farmer!");
    }
    loadData();
  };

  const calculateEarnings = () => {
    const forwardEarnings = deliveries.filter(d => d.status === 'delivered').length * 150; // ₹150 per order
    const reverseEarnings = resourceDeliveries.filter(d => d.status === 'delivered').length * 100; // ₹100 per resource
    return forwardEarnings + reverseEarnings;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Logistics</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Driver: {user.name}</p>
          </div>
          <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
        </header>

        <div className="flex bg-white p-1 rounded-xl shadow-sm overflow-x-auto">
          <button onClick={() => setActiveTab('forward')} className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'forward' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Orders</button>
          <button onClick={() => setActiveTab('reverse')} className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'reverse' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Resources</button>
          <button onClick={() => setActiveTab('wallet')} className={`flex-1 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'wallet' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Wallet</button>
        </div>

        {activeTab === 'wallet' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-10">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zm-6-11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path></svg>
              </div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">Total Earnings</p>
              <h2 className="text-5xl font-serif tracking-tight">₹{calculateEarnings().toLocaleString()}</h2>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-xl">
                  <p className="text-[10px] uppercase font-black text-slate-400">Forward</p>
                  <p className="text-xl font-bold">₹{(deliveries.filter(d => d.status === 'delivered').length * 150).toLocaleString()}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-xl">
                  <p className="text-[10px] uppercase font-black text-emerald-400">Reverse</p>
                  <p className="text-xl font-bold">₹{(resourceDeliveries.filter(d => d.status === 'delivered').length * 100).toLocaleString()}</p>
                </div>
              </div>
              <button className="w-full mt-6 bg-white text-slate-900 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Withdraw Funds</button>
            </div>
          </div>
        )}

        {activeTab === 'forward' && (
          <>
            {/* Active Delivery Card */}
            {activeDelivery ? (
              <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">Live Task</span>
                    <span className="text-xs font-mono text-slate-400">#{activeDelivery.id.substr(0,6)}</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <div className="w-0.5 h-10 bg-slate-700"></div>
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      </div>
                      <div className="space-y-6 pt-1">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pickup</p>
                          <p className="font-bold text-lg leading-tight">{activeDelivery.pickupLocation}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dropoff</p>
                          <p className="font-bold text-lg leading-tight">{activeDelivery.dropoffLocation}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    {activeDelivery.status === 'assigned' ? (
                      <button onClick={() => handleStatusUpdate(activeDelivery.id, 'picked_up')} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-emerald-400 transition-all">
                        Confirm Pickup
                      </button>
                    ) : (
                      <button onClick={() => handleStatusUpdate(activeDelivery.id, 'delivered')} className="w-full bg-amber-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-amber-400 transition-all">
                        Confirm Delivery (PoD)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[2rem] text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">No active orders. You are online.</p>
              </div>
            )}

            {/* Task List */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">History</h3>
              {deliveries.filter(d => d.status === 'delivered').map(d => (
                <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center opacity-60">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Order #{d.orderId.substr(0,6)}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{new Date(d.timestamp).toLocaleDateString()}</p>
                  </div>
                  <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-black uppercase">Delivered</span>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'reverse' && (
          <>
             {activeResourceDelivery ? (
              <div className="bg-emerald-900 text-white p-6 rounded-[2rem] shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M20 8h-3V4H3v16h18v-8zM5 18v-6h6v6H5zm6-8H5V6h6v4zm8 8h-6v-6h6v6zm0-8h-6V6h6v4z"/></svg>
                </div>
                
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="bg-white text-emerald-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">Resource Drop</span>
                    <span className="text-xs font-mono text-emerald-400">#{activeResourceDelivery.id.substr(0,6)}</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Item</p>
                      <p className="font-bold text-2xl leading-tight">{activeResourceDelivery.resourceName}</p>
                      <p className="text-sm text-emerald-200">{activeResourceDelivery.quantity} units</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Destination (Farmer)</p>
                      <p className="font-bold text-lg leading-tight">Farmer #{activeResourceDelivery.farmerId.substr(0,6)}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-emerald-800">
                    {activeResourceDelivery.status === 'assigned' ? (
                      <button onClick={() => handleResourceStatusUpdate(activeResourceDelivery.id, 'picked_up')} className="w-full bg-white text-emerald-900 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-emerald-50 transition-all">
                        Confirm Warehouse Pickup
                      </button>
                    ) : (
                      <button onClick={() => handleResourceStatusUpdate(activeResourceDelivery.id, 'delivered')} className="w-full bg-amber-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-amber-400 transition-all">
                        Confirm Farmer Dropoff
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[2rem] text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">No active resource deliveries.</p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">History</h3>
              {resourceDeliveries.filter(d => d.status === 'delivered').map(d => (
                <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center opacity-60">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{d.resourceName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{new Date(d.date).toLocaleDateString()}</p>
                  </div>
                  <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-black uppercase">Delivered</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
