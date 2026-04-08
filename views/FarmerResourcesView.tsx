import React, { useState, useEffect, useRef } from 'react';
import { User, FarmerResource, GrowthLog, Resource } from '../types';
import { db } from '../services/db';

interface Props {
  user: User;
}

const FarmerResourcesView: React.FC<Props> = ({ user }) => {
  const [resources, setResources] = useState<FarmerResource[]>([]);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [logs, setLogs] = useState<GrowthLog[]>([]);
  const [newLog, setNewLog] = useState({ description: '', imageUrl: '', stage: 'Seedling' });
  const [requestData, setRequestData] = useState({ resourceId: '', quantity: '' });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const res = await db.farmerResources.find({ farmerId: user.id });
      setResources(res);
      const avail = await db.resources.find({});
      setAvailableResources(avail);
      const l = await db.growthLogs.find({ farmerId: user.id });
      setLogs(l);
    };
    loadData();
  }, [user.id]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewLog({ ...newLog, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.imageUrl) return;
    
    const log: GrowthLog = {
      id: Math.random().toString(36).substr(2, 9),
      farmerId: user.id,
      description: newLog.description,
      imageUrl: newLog.imageUrl,
      stage: newLog.stage,
      date: new Date().toISOString()
    };

    await db.growthLogs.insertOne(log);
    setLogs([log, ...logs]);
    setNewLog({ description: '', imageUrl: '', stage: 'Seedling' });
  };

  const handleRequestDelivery = async () => {
    const assignedResources = resources.filter(r => r.status === 'assigned' && !r.deliveryRequested);
    if (assignedResources.length === 0) {
      return;
    }

    try {
      await Promise.all(assignedResources.map(r => 
        db.farmerResources.updateOne(r.id, { deliveryRequested: true })
      ));
      
      setResources(prev => prev.map(r => 
        r.status === 'assigned' ? { ...r, deliveryRequested: true } : r
      ));
    } catch (err) {
      console.error("Request failed:", err);
    }
  };

  const handleRequestResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!requestData.resourceId || !requestData.quantity) return;

    const resource = availableResources.find(r => r.id === requestData.resourceId);
    if (!resource) return;

    const qty = Number(requestData.quantity);
    if (qty <= 0) return;

    if (qty > resource.stock) {
      setError(`Insufficient stock! Only ${resource.stock} units of ${resource.name} available.`);
      return;
    }

    try {
      const newRequest: FarmerResource = {
        id: Math.random().toString(36).substr(2, 9),
        farmerId: user.id,
        resourceId: resource.id,
        resourceName: resource.name,
        quantity: qty,
        totalCost: resource.cost * qty,
        status: 'requested',
        date: new Date().toISOString()
      };

      await db.farmerResources.insertOne(newRequest);
      setResources([newRequest, ...resources]);
      setRequestData({ resourceId: '', quantity: '' });
      
      // Refresh available resources to show updated stock
      const avail = await db.resources.find({});
      setAvailableResources(avail);
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    }
  };

  const selectedResource = availableResources.find(r => r.id === requestData.resourceId);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Request New Resource */}
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
        <h2 className="text-3xl font-serif text-slate-900 mb-6">Request New Resource</h2>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p className="text-sm font-bold">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleRequestResource} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Resource</label>
            <select 
              className="w-full p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-700 outline-none focus:border-emerald-500"
              value={requestData.resourceId}
              onChange={e => setRequestData({...requestData, resourceId: e.target.value})}
              required
            >
              <option value="">Select Resource...</option>
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>{r.name} (₹{r.cost}/{r.unit})</option>
              ))}
            </select>
            {selectedResource && (
              <div className="ml-4 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Available Stock: {selectedResource.stock} {selectedResource.unit}s
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Quantity</label>
            <input 
              type="number" 
              placeholder="Quantity" 
              className="w-full p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-700 outline-none focus:border-emerald-500"
              value={requestData.quantity}
              onChange={e => setRequestData({...requestData, quantity: e.target.value})}
              required
              min="1"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm md:text-base py-5 md:py-6 hover:bg-emerald-600 transition-all shadow-lg active:scale-95">
              Submit Request
            </button>
          </div>
        </form>
      </div>

      {/* Resource Ledger */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-xl border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900">Resource Ledger</h2>
          <button 
            onClick={handleRequestDelivery} 
            className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${
              resources.some(r => r.deliveryRequested && r.status === 'assigned')
                ? 'bg-slate-400 text-white cursor-default'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            {resources.some(r => r.deliveryRequested && r.status === 'assigned') ? 'Requested' : 'Request Resource Delivery'}
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Cost (Debt)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No resources assigned yet.</td></tr>
              ) : (
                resources.map(r => (
                  <tr key={r.id} className="text-sm font-medium text-slate-700">
                    <td className="px-6 py-4 font-bold text-slate-900">{r.resourceName || 'Unknown'}</td>
                    <td className="px-6 py-4">{r.quantity}</td>
                    <td className="px-6 py-4 text-red-500">₹{r.totalCost}</td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${r.status === 'requested' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.status}</span></td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {resources.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic">No resources assigned yet.</div>
          ) : (
            resources.map(r => (
              <div key={r.id} className="py-4 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-slate-900">{r.resourceName || 'Unknown'}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${r.status === 'requested' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{r.status}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <p className="text-slate-500">Qty: {r.quantity}</p>
                  <p className="text-red-500 font-black">₹{r.totalCost}</p>
                </div>
                <p className="text-[10px] text-slate-400">{new Date(r.date).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Growth Timeline */}
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-serif text-slate-900">Growth Timeline</h2>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Upload every 15 days</span>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmitLog} className="mb-12 bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div onClick={() => fileInputRef.current?.click()} className="h-32 bg-white rounded-2xl border-2 border-slate-100 flex items-center justify-center cursor-pointer hover:border-emerald-500 transition-all overflow-hidden">
              {newLog.imageUrl ? <img src={newLog.imageUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-slate-400 uppercase">Upload Photo</span>}
            </div>
            <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleImageUpload} />
            
            <div className="space-y-4">
              <select className="w-full p-3 rounded-xl border border-slate-200 font-bold text-sm outline-none" value={newLog.stage} onChange={e => setNewLog({...newLog, stage: e.target.value})}>
                {['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Harvest Ready'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="text" placeholder="Notes (e.g. applied fertilizer)" className="w-full p-3 rounded-xl border border-slate-200 font-bold text-sm outline-none" value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} />
            </div>
            
            <button type="submit" className="bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-sm md:text-base py-4 md:py-5 hover:bg-emerald-600 transition-all active:scale-95 shadow-lg">Log Progress</button>
          </div>
        </form>

        {/* Timeline */}
        <div className="space-y-8 relative before:absolute before:left-4 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-100">
          {logs.map(log => (
            <div key={log.id} className="relative pl-12">
              <div className="absolute left-2 top-2 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white shadow-md"></div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={log.imageUrl} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{log.stage}</span>
                    <span className="text-[10px] font-bold text-slate-300">•</span>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(log.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{log.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FarmerResourcesView;
