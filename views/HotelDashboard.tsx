import React, { useState, useEffect } from 'react';
import { User, FarmerResource, GrowthLog } from '../types';
import { db } from '../services/db';

interface Props {
  user: User;
}

const HotelDashboard: React.FC<Props> = ({ user }) => {
  const [farmers, setFarmers] = useState<User[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<string | null>(null);
  const [resources, setResources] = useState<FarmerResource[]>([]);
  const [logs, setLogs] = useState<GrowthLog[]>([]);

  useEffect(() => {
    const loadFarmers = async () => {
      const f = await db.users.find({ role: 'farmer' });
      setFarmers(f);
    };
    loadFarmers();
  }, []);

  useEffect(() => {
    if (selectedFarmer) {
      const loadDetails = async () => {
        const r = await db.farmerResources.find({ farmerId: selectedFarmer });
        setResources(r);
        const l = await db.growthLogs.find({ farmerId: selectedFarmer });
        setLogs(l);
      };
      loadDetails();
    }
  }, [selectedFarmer]);

  return (
    <div className="animate-in fade-in space-y-12">
      <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-5xl font-serif tracking-tight mb-4">Future Harvest</h2>
          <p className="text-slate-400 text-lg max-w-2xl">Secure your supply chain. Pre-order crops directly from the ground and track their growth lifecycle.</p>
        </div>
        <div className="absolute right-0 top-0 p-12 opacity-10">
           <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Farmer List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Active Farms</h3>
          {farmers.map(f => (
            <button key={f.id} onClick={() => setSelectedFarmer(f.id)} className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all ${selectedFarmer === f.id ? 'bg-emerald-50 border-emerald-500 shadow-lg' : 'bg-white border-slate-100 hover:border-emerald-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-serif text-xl text-slate-900">{f.name}</h4>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{f.trustScore?.toFixed(1)} Trust</span>
              </div>
              <div className="flex gap-2 text-xs text-slate-500">
                <span>{f.location?.address || 'Unknown Location'}</span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><span>Harvest Goal</span><span>{f.currentQuantity}/{f.thresholdQuantity} kg</span></div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, ((f.currentQuantity||0)/(f.thresholdQuantity||100))*100)}%` }}></div></div>
              </div>
            </button>
          ))}
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-2">
          {selectedFarmer ? (
            <div className="space-y-8">
              {/* Quality Traceability */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-serif text-slate-900 mb-6">Quality Traceability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resources.length === 0 ? (
                    <p className="text-slate-400 italic">No resource data available.</p>
                  ) : (
                    resources.map(r => (
                      <div key={r.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${r.resourceName?.toLowerCase().includes('organic') ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                          {r.resourceName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.resourceName}</p>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">{r.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Growth Logs */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-serif text-slate-900 mb-6">Live Growth Feed</h3>
                <div className="space-y-6">
                  {logs.length === 0 ? (
                    <p className="text-slate-400 italic">No growth updates yet.</p>
                  ) : (
                    logs.map(log => (
                      <div key={log.id} className="flex gap-6">
                        <div className="w-24 h-24 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0">
                          <img src={log.imageUrl} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest">{log.stage}</span>
                            <span className="text-slate-400 text-xs">{new Date(log.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-700 text-sm leading-relaxed">{log.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 font-serif text-2xl italic">Select a farm to view details</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HotelDashboard;
