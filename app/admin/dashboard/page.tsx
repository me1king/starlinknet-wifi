'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wifi,
  Users,
  TrendingUp,
  Activity,
  Router,
  LogOut,
  Settings,
  Database,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Download,
  Shield,
  Zap
} from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>({ totalRevenue: 0, activeTickets: [], recentPayments: [] });
  const [offers, setOffers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [routerInfo, setRouterInfo] = useState<any>({ cpu: 0, memory: '0', uptime: '0s', isOnline: false });
  const [networkHealth, setNetworkHealth] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState('default-site');
  const [systemSettings, setSystemSettings] = useState({ bannerText: '', bannerType: 'info' });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [formData, setFormData] = useState({
    id: '', name: '', duration: '', durationMin: '60', price: '',
    download_limit: '5M', upload_limit: '5M', data_limit_mb: '',
    max_devices: '1', expiry_mode: 'CONTINUOUS',
  });

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const headers = { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' };
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url, { headers });
          if (res.status === 401) { router.push('/admin/login'); return null; }
          const text = await res.text();
          return text.includes('<!DOCTYPE') ? null : JSON.parse(text);
        } catch (e) { return null; }
      };

      const [metr, offr, sess, ana, sys, sett, ledg, net, stes, back, alrt] = await Promise.all([
        safeFetch(`/api/admin/metrics?siteId=${selectedSite}`),
        safeFetch(`/api/admin/offers?siteId=${selectedSite}`),
        safeFetch(`/api/admin/router/active-users?siteId=${selectedSite}`),
        safeFetch(`/api/admin/analytics/revenue?siteId=${selectedSite}`),
        safeFetch(`/api/admin/router/system-info?siteId=${selectedSite}`),
        safeFetch('/api/admin/settings'),
        safeFetch(`/api/admin/ledger?siteId=${selectedSite}`),
        safeFetch(`/api/admin/network/health?siteId=${selectedSite}`),
        safeFetch('/api/admin/sites'),
        safeFetch(`/api/admin/backup?siteId=${selectedSite}`),
        safeFetch(`/api/admin/alerts?siteId=${selectedSite}`)
      ]);

      if (metr) setMetrics(metr);
      setOffers(Array.isArray(offr) ? offr : []);
      setActiveSessions(Array.isArray(sess) ? sess : []);
      if (ana) setAnalytics(ana);
      if (sett) setSystemSettings(sett);
      setLedger(Array.isArray(ledg) ? ledg : []);
      if (net) setNetworkHealth(net);
      setSites(Array.isArray(stes) ? stes : []);
      setBackups(Array.isArray(back) ? back : []);
      setSecurityAlerts(Array.isArray(alrt) ? alrt : []);

      if (sys) {
        setRouterInfo({
          cpu: parseInt(sys['cpu-load']) || 0,
          memory: `${(parseInt(sys['free-memory']) / (1024 * 1024)).toFixed(1)} MB`,
          uptime: sys.uptime,
          isOnline: true
        });
      }
    } catch (err) { console.error("Dashboard error:", err); } finally { setLoading(false); }
  }, [selectedSite, router]);

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { const int = setInterval(() => fetchData(false), 20000); return () => clearInterval(int); }, [fetchData]);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/offers', {
      method: formData.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, siteId: selectedSite })
    });
    if (res.ok) {
      setFormData({id:'', name:'', duration:'', durationMin:'60', price:'', download_limit:'5M', upload_limit:'5M', data_limit_mb: '', max_devices:'1', expiry_mode:'CONTINUOUS'});
      fetchData(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(systemSettings) });
    alert("Updated!");
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
      <Zap className="w-12 h-12 text-indigo-500 animate-pulse" />
      <div className="text-white text-xl animate-pulse font-black uppercase">SYNCING FULIFI CLOUD...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 font-sans">
      <header className="mb-8 border-b border-gray-800 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20"><Zap className="w-8 h-8 text-white fill-white" /></div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">FULIFI <span className="text-indigo-500">OPERATOR</span></h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-500" /> CLOUD LINK ACTIVE</p>
          </div>
        </div>
        <div className="flex gap-4">
          <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-indigo-400">
            <option value="default-site">Main Site</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => fetchData(true)} className="text-gray-500 hover:text-white"><Activity /></button>
        </div>
      </header>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
            <div className={`p-2 rounded-lg ${routerInfo.isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}><Router className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-black">Router Cloud Link</p>
              <p className={`text-xs font-bold ${routerInfo.isOnline ? 'text-emerald-400' : 'text-red-400'}`}>{routerInfo.isOnline ? 'CONNECTED' : 'OFFLINE'}</p>
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-black mb-1">CPU Load</p>
            <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full transition-all" style={{ width: `${routerInfo.cpu}%` }} /></div>
            <p className="text-[10px] text-right mt-1 font-bold text-indigo-400">{routerInfo.cpu}%</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-black">Memory</p>
            <p className="text-sm font-bold text-white">{routerInfo.memory}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-black">Uptime</p>
            <p className="text-sm font-bold text-white">{routerInfo.uptime}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Peripheral Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(networkHealth?.peripherals || []).map((p: any, i: number) => (
                <div key={i} className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black uppercase text-gray-400">{p.name}</p>
                    <div className={`w-2 h-2 rounded-full ${p.alive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                  <p className="text-[9px] font-mono text-gray-500">{p.ip}</p>
                  <p className={`text-[9px] font-bold mt-1 ${p.alive ? 'text-indigo-400' : 'text-red-400'}`}>{p.alive ? (p.avgRtt || 'Active') : 'OFFLINE'}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500" /> WAN Performance</h3>
            <div className="flex items-center justify-between gap-8">
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Download</p>
                <p className="text-2xl font-black text-white">{(parseInt(networkHealth?.wanStats?.rxRate || 0) / 1000000).toFixed(1)} <span className="text-xs text-gray-500">Mbps</span></p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Upload</p>
                <p className="text-2xl font-black text-white">{(parseInt(networkHealth?.wanStats?.txRate || 0) / 1000000).toFixed(1)} <span className="text-xs text-gray-500">Mbps</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
            <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Revenue</p>
            <h3 className="text-4xl font-black mt-2">KSh {analytics?.totalRevenue || 0}</h3>
          </div>
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 relative overflow-hidden group">
            <Users className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Active Leases</p>
            <h3 className="text-4xl font-black mt-2 text-white">{(activeSessions || []).length}</h3>
          </div>
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment Engine</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              <span className="text-xl font-black text-emerald-400 uppercase">READY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}