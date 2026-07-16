'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, TrendingUp, Activity, Router, LogOut, Settings,
  XCircle, Zap, Wifi, Clock, Database, Smartphone,
  CheckCircle2, ShieldAlert, Cpu, HardDrive, LayoutDashboard,
  Download, List, Printer, Plus, AlertTriangle, ArrowUpRight,
  Search, MessageSquare, Globe, Monitor, Eye, DollarSign
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export const dynamic = 'force-dynamic';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>({ totalRevenue: 0 });
  const [offers, setOffers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [routerInfo, setRouterInfo] = useState<any>({ cpu: 0, memory: '0', uptime: '0s', isOnline: false });
  const [selectedSite, setSelectedSite] = useState('default-site');
  const [sites, setSites] = useState<any[]>([]);
  const [latencyLogs, setLatencyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBulkScreen, setShowBulkScreen] = useState(false);
  const [liveTraffic, setLiveTraffic] = useState({ rx: 0, tx: 0 });
  const [trafficHistory, setTrafficHistory] = useState<any[]>([]);
  const [sessionTimers, setSessionTimers] = useState<Record<string, string>>({});
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);
  const [lastSniperScan, setLastSniperScan] = useState<string | null>(null);
  const [inspectingUser, setInspectingUser] = useState<any>(null);
  const [inspectData, setInspectData] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [routerLogs, setRouterLogs] = useState<any[]>([]);
  const [adBlockEnabled, setAdBlockEnabled] = useState(false);
  const [revenueMetrics, setRevenueMetrics] = useState<any>({ today: 0, week: 0, month: 0, projected: 0, last7Days: [] });
  const [rogueDevices, setRogueDevices] = useState<any[]>([]);
  const [showRoguePanel, setShowRoguePanel] = useState(false);
  const router = useRouter();

  // FINANCIAL HUD MATH
  const calculateFinancials = useCallback((payments: any[]) => {
    if (!payments) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDayOfMonth = now.getDate() || 1;

    let todayRev = 0;
    let weekRev = 0;
    let monthRev = 0;

    const trend: {date: string, amount: number}[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      trend.push({ date: d.toISOString().split('T')[0], amount: 0 });
    }

    payments.forEach(payment => {
      if (payment.status !== 'active') return;
      const pDateFull = new Date(payment.createdAt || payment.date);
      const pDate = pDateFull.toISOString().split('T')[0];
      const amount = Number(payment.amount);

      if (pDateFull >= today) todayRev += amount;
      if (pDateFull >= startOfWeek) weekRev += amount;
      if (pDateFull >= startOfMonth) monthRev += amount;

      const dayBucket = trend.find(t => t.date === pDate);
      if (dayBucket) dayBucket.amount += amount;
    });

    setRevenueMetrics({
        today: todayRev,
        week: weekRev,
        month: monthRev,
        projected: (monthRev / currentDayOfMonth) * daysInMonth,
        last7Days: trend
    });
  }, []);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          if (res.status === 401) { router.push('/admin/login'); return null; }
          return res.ok ? await res.json() : null;
        } catch (e) { return null; }
      };

      const metr = await safeFetch(`/api/admin/metrics?siteId=${selectedSite}`);
      if (metr) {
          setMetrics(metr);
          if (metr.recentPayments) calculateFinancials(metr.recentPayments);
      }

      const offr = await safeFetch(`/api/admin/offers?siteId=${selectedSite}`);
      if (offr) setOffers(offr);

      if (isInitial) setLoading(false);

      Promise.all([
        safeFetch(`/api/admin/router/active-users?siteId=${selectedSite}`).then(sess => {
            if (sess) {
                setActiveSessions([...sess].sort((a, b) => parseInt(b.bytesIn || '0') - parseInt(a.bytesIn || '0')));
                const initialTimers: Record<string, string> = {};
                sess.forEach((s: any) => { initialTimers[s.id] = s.timeLeft || '00:00:00'; });
                setSessionTimers(initialTimers);
            }
        }),
        safeFetch(`/api/admin/router/system-info?siteId=${selectedSite}`).then(sys => {
            if (sys && !sys.error) setRouterInfo({
                cpu: parseInt(sys['cpu-load']) || 0,
                memory: sys['free-memory'] ? `${(parseInt(sys['free-memory']) / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
                uptime: sys.uptime || '0s',
                isOnline: true,
                boardName: sys['board-name'] || 'RouterBoard',
                version: sys.version || '7.x'
            });
            else setRouterInfo((prev: any) => ({ ...prev, isOnline: false }));
        }),
        safeFetch('/api/admin/sites').then(sitList => { if (sitList) setSites(sitList); })
      ]);
    } catch (err) { console.error("Refresh error:", err); }
  }, [selectedSite, router, calculateFinancials]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  useEffect(() => {
    const fetchTraffic = async () => {
      try {
        const res = await fetch(`/api/admin/router/traffic?siteId=${selectedSite}`);
        if (res.ok) {
          const data = await res.json();
          setLiveTraffic({ rx: data.rx, tx: data.tx });
          setTrafficHistory(prev => [...prev, {
            rx: data.rx, tx: data.tx,
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }].slice(-20));
        }
      } catch (e) {}
    };
    const int = setInterval(fetchTraffic, 3000);
    return () => clearInterval(int);
  }, [selectedSite]);

  const handleReboot = async () => {
    if (!confirm("⚠️ Restart the router?")) return;
    setActionLoading(true);
    try {
      await fetch('/api/admin/router/reboot', { method: 'POST', body: JSON.stringify({ siteId: selectedSite }) });
      alert("🚀 Reboot signal sent!");
    } catch (e) { alert("❌ Reboot failed."); } finally { setActionLoading(false); }
  };

  const handleToggleAdBlock = async () => {
    const nextState = !adBlockEnabled;
    setActionLoading(true);
    try {
        await fetch('/api/admin/router/dns-block', { method: 'POST', body: JSON.stringify({ siteId: selectedSite, enabled: nextState }) });
        setAdBlockEnabled(nextState);
        alert(nextState ? "🛡️ Clean Web Active!" : "🌐 Standard DNS Restored.");
    } catch (e) { alert("Action failed."); } finally { setActionLoading(false); }
  };

  const handleGhostBuster = async () => {
    setActionLoading(true);
    try {
        const res = await fetch(`/api/cron/idle-cleanup?siteId=${selectedSite}`);
        const data = await res.json();
        if (res.ok) {
            setLastCleanup(new Date().toLocaleTimeString());
            alert(`✅ Ghost Buster: Kicked ${data.kickedCount} idle users.`);
            fetchData(false);
        }
    } catch (e) {} finally { setActionLoading(false); }
  };

  const handleRogueSniper = async () => {
    setActionLoading(true);
    try {
        const res = await fetch(`/api/cron/rogue-sniper?siteId=${selectedSite}`);
        const data = await res.json();
        if (res.ok) {
            setLastSniperScan(new Date().toLocaleTimeString());
            alert(data.neutralizedCount > 0 ? `🚨 SNIPER: ${data.neutralizedCount} ROGUES isolated!` : "✅ Perimeter clear.");
        }
    } catch (e) {} finally { setActionLoading(false); }
  };

  const handleInspectUser = async (user: any) => {
    setInspectingUser(user);
    setInspectLoading(true);
    try {
        const res = await fetch(`/api/admin/router/inspect?siteId=${selectedSite}&macAddress=${user.macAddress}&voucherCode=${user.voucherCode}`);
        if (res.ok) setInspectData(await res.json());
    } catch (e) {} finally { setInspectLoading(false); }
  };

  const handleKickUser = async (code: string) => {
    if(!confirm("Disconnect?")) return;
    try {
      await fetch('/api/admin/router/kick', { method: 'POST', body: JSON.stringify({ username: code, siteId: selectedSite }) });
      fetchData(false);
    } catch (e) {}
  };

  const FinancialHUD = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[{t:'Today',v:revenueMetrics.today,c:'#10b981'},{t:'This Week',v:revenueMetrics.week,c:'#fff'},{t:'This Month',v:revenueMetrics.month,c:'#fff'},{t:'Est. Month End',v:revenueMetrics.projected,c:'#a855f7'}].map((m,i)=>(
            <div key={i} className="bg-[#11141b] border border-gray-800 p-5 rounded-3xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                <p className="text-[10px] text-gray-500 font-black uppercase mb-1 relative z-10">{m.t}</p>
                <p className="text-xl font-black relative z-10" style={{color:m.c}}>KES {Math.round(m.v).toLocaleString()}</p>
                <div className="absolute bottom-0 left-0 w-full h-10 opacity-20 group-hover:opacity-40">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueMetrics.last7Days}><YAxis hide domain={['dataMin', 'dataMax']} /><Line type="monotone" dataKey="amount" stroke={m.c==='#fff'?'#6366f1':m.c} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        ))}
    </div>
  );

  const TrafficGraph = () => {
    const maxVal = Math.max(...trafficHistory.map(h => Math.max(h.rx, h.tx)), 1000000);
    const getPoints = (k: 'rx' | 'tx') => trafficHistory.map((h, i) => `${(i / 19) * 400},${120 - (h[k] / maxVal) * 120}`).join(' ');
    return (
        <div className="bg-black/40 rounded-2xl p-4 border border-gray-800 h-full">
            <p className="text-[9px] font-black text-gray-500 uppercase mb-3">Live Bandwidth (Mbps)</p>
            <svg width="100%" height="120" viewBox="0 0 400 120" className="overflow-visible">
                <polyline fill="none" stroke="#10b981" strokeWidth="2" points={getPoints('rx')} />
                <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={getPoints('tx')} />
            </svg>
        </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center text-white font-black uppercase tracking-widest animate-pulse">STARLINKNET CLOUD SYNC</div>;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 p-6 font-sans">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20"><LayoutDashboard className="w-8 h-8 text-white" /></div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">STARLINKNET <span className="text-indigo-500">WIFI & 5G</span></h1>
              <div className="flex items-center gap-3 mt-1">
                  <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase text-indigo-400 outline-none">
                      <option value="default-site">Main Operations</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <p className="text-[9px] text-gray-500 font-bold uppercase flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${routerInfo.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />{routerInfo.isOnline ? 'Live Link' : 'Offline'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-6 px-6 py-3 bg-[#11141b] rounded-2xl border border-gray-800">
               <div><p className="text-[8px] text-gray-500 font-black uppercase mb-0.5">Revenue</p><p className="text-sm font-black text-emerald-400">KES {metrics.totalRevenue || 0}</p></div>
               <div className="w-px bg-gray-800" />
               <div><p className="text-[8px] text-gray-500 font-black uppercase mb-0.5">Leases</p><p className="text-sm font-black text-indigo-400">{activeSessions.length}</p></div>
            </div>
            <button onClick={() => router.push('/admin/login')} className="bg-[#1a1d25] p-3.5 rounded-xl border border-gray-800"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>

        <FinancialHUD />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-lg group hover:border-indigo-500/30 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hardware Identity</p>
                    <button onClick={handleReboot} className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-red-500/20"><Zap size={8} /> Nuke</button>
                </div>
                <div className="space-y-4">
                    <div><h4 className="text-xl font-black text-white">{routerInfo.boardName}</h4><p className="text-[10px] text-gray-600 font-bold uppercase">OS v{routerInfo.version}</p></div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[8px] font-black uppercase text-gray-500"><span>CPU Load</span><span>{routerInfo.cpu}%</span></div>
                        <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${routerInfo.cpu}%` }} /></div>
                    </div>
                    <div className="pt-2 border-t border-gray-800/50 flex justify-between items-center">
                        <p className="text-[8px] text-gray-500 uppercase font-black">Uptime</p><p className="text-xs font-black text-indigo-400">{routerInfo.uptime}</p>
                    </div>
                </div>
            </div>
            <div className="md:col-span-2"><TrafficGraph /></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[{fn:()=>setShowLogs(!showLogs),icon:List,txt:'Logs',sub:showLogs?'On':'Watch'},{fn:handleToggleAdBlock,icon:ShieldAlert,txt:'Clean',sub:adBlockEnabled?'Active':'DNS'},{fn:()=>setShowRoguePanel(!showRoguePanel),icon:ShieldAlert,txt:'Rogues',sub:rogueDevices.length+' Found'},{fn:handleGhostBuster,icon:LayoutDashboard,txt:'Ghost',sub:lastCleanup||'Clean'},{fn:handleRogueSniper,icon:ShieldAlert,txt:'Sniper',sub:lastSniperScan||'Scan'}].map((btn,i)=>(
                <button key={i} onClick={btn.fn} className="bg-[#11141b] p-4 rounded-2xl border border-gray-800 hover:border-indigo-500/50 flex items-center gap-3">
                    <btn.icon className="w-5 h-5 text-indigo-500" /><div className="text-left"><p className="text-[10px] font-black uppercase text-white">{btn.txt}</p><p className="text-[8px] text-gray-500 uppercase">{btn.sub}</p></div>
                </button>
            ))}
        </div>

        {showLogs && (
            <div className="bg-black rounded-3xl border border-indigo-500/30 overflow-hidden mb-8 animate-in slide-in-from-top-4">
                <div className="bg-gray-900 px-6 py-3 border-b border-gray-800 flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Router Console</span>
                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[8px] font-black text-emerald-500 uppercase">Live Stream</span></div>
                </div>
                <div className="p-6 h-64 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar bg-[#05070a]">
                    {routerLogs.map((log, i) => <div key={i} className="flex gap-4 group"><span className="text-gray-600 shrink-0">{log.time}</span><span className="text-indigo-500/70 shrink-0">[{log.topics}]</span><span className="text-gray-300 group-hover:text-white">{log.message}</span></div>)}
                </div>
            </div>
        )}

        <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl min-h-[500px]">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Active Network Leases</h3>
                <button onClick={handleExportCSV} className="bg-gray-900 px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 border border-gray-800"><Download size={12} /> CSV Export</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800">
                        <tr><th className="p-4">Voucher</th><th className="p-4">Uptime</th><th className="p-4">Time Left</th><th className="p-4">Usage</th><th className="p-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/30">
                        {activeSessions.map(s => (
                            <tr key={s.id} className="hover:bg-indigo-500/[0.03] transition-all">
                                <td className="p-4"><p className="text-indigo-400 font-bold text-sm">{s.voucherCode}</p><p className="text-[8px] opacity-40 uppercase">{s.macAddress}</p></td>
                                <td className="p-4 text-emerald-400 font-black tracking-widest uppercase">{s.uptime}</td>
                                <td className="p-4 text-amber-500 font-black tracking-widest uppercase">{sessionTimers[s.id] || s.timeLeft}</td>
                                <td className="p-4 text-gray-400 font-mono text-[10px]">{((parseInt(s.bytesIn)+parseInt(s.bytesOut))/(1024*1024)).toFixed(1)} MB</td>
                                <td className="p-4 text-right flex gap-2 justify-end">
                                    <button onClick={()=>handleInspectUser(s)} className="text-[9px] font-black uppercase text-indigo-400">Inspect</button>
                                    <button onClick={()=>handleKickUser(s.voucherCode)} className="text-[9px] font-black uppercase text-red-500">Kick</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {inspectingUser && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md">
                <div className="bg-[#0f1218] border border-indigo-500/20 w-full max-w-xl rounded-[40px] p-8 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Support X-Ray</h2>
                        <button onClick={() => setInspectingUser(null)} className="p-3 bg-gray-900 rounded-2xl"><XCircle className="w-6 h-6 text-gray-500" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-gray-950 p-6 rounded-3xl border border-gray-800"><p className="text-[9px] font-black text-gray-600 uppercase mb-2">Live Ping</p><p className="text-lg font-black text-white">{inspectData?.ping?.alive ? inspectData.ping.avgRtt : '---'}</p></div>
                        <div className="bg-gray-950 p-6 rounded-3xl border border-gray-800"><p className="text-[9px] font-black text-gray-600 uppercase mb-2">Usage</p><p className="text-lg font-black text-white">{inspectData ? ((parseInt(inspectData['bytes-in'])+parseInt(inspectData['bytes-out']))/(1024*1024)).toFixed(1)+' MB' : '---'}</p></div>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-6 text-center uppercase font-bold">{inspectingUser.macAddress} • {inspectingUser.ipAddress}</p>
                    <div className="flex gap-4">
                        <button onClick={()=>{handleExtendTime(inspectingUser.voucherCode); setInspectingUser(null);}} className="flex-1 bg-emerald-600 py-4 rounded-2xl font-black uppercase text-[10px]">+15M FREE</button>
                        <button onClick={()=>{handleKickUser(inspectingUser.voucherCode); setInspectingUser(null);}} className="flex-1 bg-red-600 py-4 rounded-2xl font-black uppercase text-[10px]">TERMINATE</button>
                    </div>
                </div>
            </div>
        )}

        <style jsx global>{`
          html, body { background-color: #0a0c10 !important; color: #f3f4f6 !important; margin: 0; padding: 0; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 10px; }
        `}</style>
      </div>
    </div>
  );
}
