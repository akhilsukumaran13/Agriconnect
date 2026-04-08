import React from 'react';
import { User, Order } from '../types';

interface Props {
  user: User;
  orders: Order[];
}

const FarmerWalletView: React.FC<Props> = ({ user, orders }) => {
  // Use user.walletBalance as the primary source of truth if it's set
  // Fallback to calculation from orders for legacy data or if balance is 0
  const calculatedBalance = orders
    .filter(o => o.status === 'delivered')
    .reduce((acc, o) => acc + (Number(o.totalPrice) * 0.7) - (Number(o.debtPaid) || 0), 0);
  
  const walletBalance = user.walletBalance || calculatedBalance;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet Balance */}
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zm-6-11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path></svg>
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">Wallet Balance</p>
          <h2 className="text-5xl font-serif tracking-tight">₹{walletBalance.toLocaleString()}</h2>
          <button className="mt-8 bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all">Withdraw Funds</button>
        </div>

        {/* Material Debt */}
        <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100">
          <p className="text-red-400 font-black uppercase tracking-widest text-xs mb-2">Material Debt</p>
          <h2 className="text-4xl font-serif text-red-600 tracking-tight">₹{user.materialDebt?.toLocaleString() || '0'}</h2>
          <p className="text-red-400 text-xs mt-4 font-medium leading-relaxed">Deducted automatically from your next harvest payment.</p>
        </div>

        {/* Trust Score */}
        <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100">
          <p className="text-emerald-600 font-black uppercase tracking-widest text-xs mb-2">Trust Score</p>
          <h2 className="text-4xl font-serif text-emerald-700 tracking-tight">{user.trustScore?.toFixed(1) || '0.0'}</h2>
          <div className="w-full bg-emerald-200 h-2 rounded-full mt-4 overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (user.trustScore || 0) * 10)}%` }}></div>
          </div>
          <p className="text-emerald-600 text-xs mt-4 font-medium">Upload photos regularly to increase your score and loan limit.</p>
        </div>
      </div>
    </div>
  );
};

export default FarmerWalletView;
