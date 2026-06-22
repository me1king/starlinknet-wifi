'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, Activity, Router, LogOut, Settings, XCircle, Zap, Wifi } from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>({ totalRevenue: 0 });
  const [offers, setOffers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [routerInfo, setRouterInfo] = useState<any>({ cpu: 0, memory: '0', uptime: '0s', isOnline: false });
  const [networkHealth, setNetworkHealth] = useState<any>(null);
  const [selectedSite, setSelectedSite] = useState('default-site');
  const [systemSettings, setSystemSettings] = useState({ bannerText: '', bannerType: 'info', blockTethering: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M'
  });

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const headers = { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' };

      const [metr, offr, sess, sys, sett, net] = await Promise.all([
        fetch(`/api/admin/metrics?siteId=${selectedSite}`, { headers }).then(res => res.json()).catch(() => ({})),
        fetch(`/api/admin/offers?siteId=${selectedSite}`, { headers }).then(res => res.json()).catch(() => []),
        fetch(`/api/admin/router/active-users?siteId=${selectedSite}`, { headers }).then(res => res.json()).catch(() => []),
        fetch(`/api/admin/router/system-info?siteId=${selectedSite}`, { headers }).then(res => res.json()).catch(() => null),
        fetch('/api/admin/settings', { headers }).then(res => res.json()).catch(() => ({})),
        fetch(`/api/admin/network/health?siteId=${selectedSite}`, { headers }).then(res => res.json()).catch(() => null)
      ]);

      setMetrics(metr);
      setOffers(Array.isArray(offr) ? offr : []);
      setActiveSessions(Array.isArray(sess) ? sess : []);
      setSystemSettings(sett || { bannerText: '', bannerType: 'info' });
      setNetworkHealth(net);

      if (sys && !sys.error) {
        setRouterInfo({
          cpu: parseInt(sys['cpu-load']) || 0,
          memory: `${(parseInt(sys['free-memory'] || 0) / (1024 * 1024)).toFixed(1)} MB`,
          uptime: sys.uptime || '0s',
          isOnline: true
        });
      } else {
        setRouterInfo(prev => ({ ...prev, isOnline: false }));
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSite]);

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { const int = setInterval(() => fetchData(false), 10000); return () => clearInterval(int); }, [fetchData]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) alert("✅ Announcement Published Successfully!");
      else alert("❌ Failed to publish. Check your connection.");
    } catch (err) { alert("❌ Error connecting to server."); }
    finally { setActionLoading(false); }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/offers', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, siteId: selectedSite })
      });
      if (res.ok) {
        alert("✅ Billing Plan Saved!");
        setFormData({ id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M' });
        fetchData(false);
      } else alert("❌ Error saving plan.");
    } catch (err) { alert("❌ Connection failed."); }
    finally { setActionLoading(false); }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    try {
      await fetch('/api/admin/offers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      fetchData(false);
    } catch (err) { alert("Delete failed."); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
      <Zap className="w-12 h-12 text-indigo-500 animate-pulse" />
      <div className="text-white text-xl animate-pulse font-black uppercase tracking-widest">SYNCING FULIFI CLOUD...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 font-sans">
      <header className="mb-8 border-b border-gray-800 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20"><Zap className="w-8 h-8 text-white fill-white" /></div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">FULIFI <span className="text-indigo-500">OPERATOR</span></h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
              <Activity className={`w-3 h-3 ${routerInfo.isOnline ? 'text-emerald-500' : 'text-red-500'}`} /> {routerInfo.isOnline ? 'ROUTER SYNCED' : 'ROUTER OFFLINE'}
            </p>
          </div>
        </div>
        <button onClick={() => router.push('/admin/login')} className="bg-gray-800 p-2 rounded-lg hover:text-red-400 transition-colors"><LogOut /></button>
      </header>

      <div className="space-y-8">
        {/* TELEMETRY */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">CPU Load</p>
            <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full transition-all" style={{ width: `${routerInfo.cpu}%` }} /></div>
            <p className="text-[10px] text-right mt-1 font-bold text-indigo-400">{routerInfo.cpu}%</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700"><p className="text-[10px] text-gray-500 uppercase font-black">Free Memory</p><p className="text-sm font-bold text-white">{routerInfo.memory}</p></div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700"><p className="text-[10px] text-gray-500 uppercase font-black">Uptime</p><p className="text-sm font-bold text-white">{routerInfo.uptime}</p></div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700"><p className="text-[10px] text-gray-500 uppercase font-black">Total Revenue</p><p className="text-sm font-bold text-emerald-400">KSh {metrics.totalRevenue || 0}</p></div>
        </div>

        {/* PERIPHERALS */}
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2"><Wifi className="w-4 h-4 text-indigo-500" /> Peripheral Hardware Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(networkHealth?.peripherals || [
                { name: 'Fiber Gateway', ip: '192.168.150.1', alive: false },
                { name: 'Core Switch', ip: '192.168.88.2', alive: false },
                { name: 'Access Point East', ip: '192.168.88.10', alive: false }
              ]).map((p: any, i: number) => (
                <div key={i} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 flex justify-between items-center">
                  <div><p className="text-[10px] font-black uppercase text-gray-400">{p.name}</p><p className="text-[9px] font-mono text-gray-600">{p.ip}</p></div>
                  <div className="text-right">
                    <p className={`text-[10px] font-bold ${p.alive ? 'text-emerald-400' : 'text-red-500'}`}>{p.alive ? 'ONLINE' : 'OFFLINE'}</p>
                    <div className={`w-2 h-2 rounded-full inline-block ${p.alive ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                  </div>
                </div>
              ))}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                {/* ANNOUNCEMENT */}
                <form onSubmit={handleUpdateSettings} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 shadow-xl">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-gray-700 pb-2">Set Announcement</h3>
                    <textarea className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-xs text-white outline-none focus:border-indigo-500" placeholder="Type message..." value={systemSettings.bannerText} onChange={e => setSystemSettings({...systemSettings, bannerText: e.target.value})} />
                    <div className="flex gap-2">
                        <select className="bg-gray-900 border border-gray-700 p-2 rounded-lg text-xs text-white flex-1" value={systemSettings.bannerType} onChange={e => setSystemSettings({...systemSettings, bannerType: e.target.value})}>
                            <option value="info">Purple (Info)</option>
                            <option value="warning">Amber (Warning)</option>
                            <option value="maintenance">Red (Danger)</option>
                        </select>
                        <button type="submit" disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all disabled:opacity-50">{actionLoading ? 'Saving...' : 'Publish'}</button>
                    </div>
                </form>

                {/* ADD PLAN */}
                <form onSubmit={handleCreateOffer} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4 shadow-xl">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-gray-700 pb-2">{formData.id ? 'Edit Plan' : 'New Plan'}</h3>
                    <input type="text" placeholder="Plan Name" className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-xs text-white" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} required />
                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder="Price (KES)" className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-xs text-white" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} required />
                        <input type="number" placeholder="Mins" className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-xs text-white" value={formData.durationMin} onChange={e=>setFormData({...formData, durationMin:e.target.value})} required />
                    </div>
                    <button type="submit" disabled={actionLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 p-3 rounded-lg font-black text-xs uppercase transition-all disabled:opacity-50">{actionLoading ? 'Processing...' : 'Save Plan'}</button>
                </form>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4">Current Active Billing Options</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {offers.map(o => (
                            <div key={o.id} className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex justify-between items-center group">
                                <div><p className="font-bold text-white">{o.name}</p><p className="text-[10px] text-gray-500 uppercase font-black">{o.price} KES | {o.durationMin} MINS</p></div>
                                <button onClick={() => handleDeleteOffer(o.id)} className="p-2 hover:bg-red-900/20 text-red-500 transition-colors"><XCircle className="w-5 h-5" /></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Live Customer Leases</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left"><thead className="text-[10px] text-gray-500 uppercase font-black border-b border-gray-700"><tr><th className="p-4">User</th><th className="p-4">IP Address</th><th className="p-4">Time Connected</th><th className="p-4">Actions</th></tr></thead>
                            <tbody className="text-xs">{activeSessions.map((s:any, idx: number) => (<tr key={idx} className="border-b border-gray-700/50 hover:bg-black/10"><td className="p-4 font-mono text-indigo-400 font-bold">{s.user || s.voucherCode}</td><td className="p-4 text-gray-400 font-mono">{s.address || s.ipAddress}</td><td className="p-4 text-emerald-400 font-bold">{s.uptime}</td><td className="p-4"><button className="text-red-500 font-black uppercase text-[10px]">Kick</button></td></tr>))}
                            </tbody></table>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
