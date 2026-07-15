'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  const [deviceConnections, setDeviceConnections] = useState<any[]>([]);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [routerInfo, setRouterInfo] = useState<any>({ cpu: 0, memory: '0', uptime: '0s', isOnline: false });
  const [ledger, setLedger] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState('default-site');
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [speedLogs, setSpeedLogs] = useState<any[]>([]);
  const [latencyLogs, setLatencyLogs] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [showGlobal, setShowGlobal] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ bannerText: '', bannerType: 'info', blockTethering: false });
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomers, setShowCustomers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBulkScreen, setShowBulkScreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [liveTraffic, setLiveTraffic] = useState({ rx: 0, tx: 0 });
  const router = useRouter();

  // Form states
  const [formData, setFormData] = useState({
    id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M', data_limit_mb: '0', max_devices: '1', expiry_mode: 'CONTINUOUS'
  });
  const [bulkGen, setBulkGen] = useState({ package_id: '', batch_size: '20' });
  const [generatedBatch, setGeneratedBatch] = useState<any[]>([]);
  const [newSite, setNewSite] = useState({ name: '', location: '', routerHost: '', routerUser: '', routerPass: '' });
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [sessionTimers, setSessionTimers] = useState<Record<string, string>>({});
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);
  const [lastSniperScan, setLastSniperScan] = useState<string | null>(null);
  const [inspectingUser, setInspectingUser] = useState<any>(null);
  const [inspectData, setInspectData] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [routerLogs, setRouterLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [adBlockEnabled, setAdBlockEnabled] = useState(false);
  const [trafficHistory, setTrafficHistory] = useState<any[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<any>({ today: 0, week: 0, month: 0, projected: 0, last7Days: [] });
  const [systemHealth, setSystemHealth] = useState<any>({ database: 'online', router: 'online', whatsapp: 'online', paystack: 'online', webhook: 'online' });
  const [deviceStats, setDeviceStats] = useState<any[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);

  const [rogueDevices, setRogueDevices] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState('ALL');
  const [showRoguePanel, setShowRoguePanel] = useState(false);

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
      trend.push({
        date: d.toISOString().split('T')[0],
        amount: 0
      });
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

    const averageDailyRev = monthRev / currentDayOfMonth;
    const projectedMonthRev = averageDailyRev * daysInMonth;

    setRevenueMetrics({
        today: todayRev,
        week: weekRev,
        month: monthRev,
        projected: projectedMonthRev,
        last7Days: trend
    });
  }, []);

  // AUDIO CUES
  const playSound = (type: 'success' | 'alert') => {
    try {
        const audio = new Audio(type === 'success'
            ? 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'
            : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {}
  };

  // NOTIFICATIONS
  const sendNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Helper to decrement MikroTik time format (HH:MM:SS)
  const decrementTime = (timeStr: string) => {
    if (!timeStr || timeStr === 'Unlimited' || timeStr === 'offline') return timeStr;
    try {
      const parts = timeStr.split(':').map(Number);
      let totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
      if (totalSeconds <= 0) return "00:00:00";
      totalSeconds--;
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } catch (e) { return timeStr; }
  };

  // Live Timer Effect: Ticks every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTimers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          next[id] = decrementTime(next[id]);
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const addLog = (msg: string) => setDebugLog(prev => [msg, ...prev].slice(0, 10));

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const headers = {};

      const safeFetch = async (url: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(url, { headers, signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.status === 401) { router.push('/admin/login'); return null; }
          if (!res.ok) return null;
          const text = await res.text();
          if (text.includes('<!DOCTYPE')) return null;
          try { return JSON.parse(text); } catch (e) { return null; }
        } catch (e) { return null; }
      };

      const metr = await safeFetch(`/api/admin/metrics?siteId=${selectedSite}`);
      if (metr) {
          if (metrics.totalRevenue > 0 && metr.totalRevenue > metrics.totalRevenue) {
              playSound('success');
              sendNotification("💰 New Payment Success!", `Total Revenue: KES ${metr.totalRevenue}`);
          }
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
            if (sys && !sys.error) {
                const cpu = parseInt(sys['cpu-load']) || 0;
                if (cpu > 90 && routerInfo.cpu <= 90) {
                    playSound('alert');
                    sendNotification("⚠️ High Router Load", `CPU Usage is at ${cpu}%. Performance may be degraded.`);
                }
                setRouterInfo({
                    cpu,
                    memory: sys['free-memory'] ? `${(parseInt(sys['free-memory']) / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
                    uptime: sys.uptime || '0s',
                    isOnline: true,
                    boardName: sys['board-name'] || 'RouterBoard',
                    version: sys.version || '7.x',
                    model: sys.model || 'Unknown',
                    name: sys.name || 'MikroTik'
                });
            } else setRouterInfo((prev: any) => ({ ...prev, isOnline: false }));
        }),
        safeFetch(`/api/admin/analytics/revenue?siteId=${selectedSite}`).then(ana => {
            if (ana && ana.dailyStats) {
                const chartData = Object.entries(ana.dailyStats).map(([date, amount]) => {
                    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                    return { date: dayName, revenue: amount };
                }).slice(-7);
                setAnalytics({ ...ana, daily: chartData });
            } else if (ana) setAnalytics(ana);
        }),
        safeFetch('/api/admin/sites').then(sitList => { if (sitList) setSites(sitList); }),
        safeFetch(`/api/admin/whatsapp/customers?siteId=${selectedSite}`).then(custData => {
            if (custData && custData.success) setCustomers(custData.customers);
        }),
        safeFetch(`/api/device-connection?action=active&siteId=${selectedSite}`).then(devCon => {
            if (devCon) setDeviceConnections(devCon.devices || []);
        }),
        safeFetch(`/api/device-connection?action=stats&siteId=${selectedSite}`).then(conStat => {
            if (conStat) setConnectionStats(conStat);
        }),
        safeFetch(`/api/admin/network/ping?siteId=${selectedSite}`).then(lat => { if (lat) setLatencyLogs(lat); }),
        safeFetch(`/api/admin/settings`).then(sett => { if (sett) setSystemSettings(sett); }),
        safeFetch(`/api/admin/ledger?siteId=${selectedSite}`).then(ledg => { if (ledg) setLedger(ledg); }),
        safeFetch(`/api/admin/system-health`).then(health => { if (health && health.systems) setSystemHealth(health.systems); }),
        safeFetch(`/api/admin/analytics/devices`).then(devBrands => { if (devBrands) setDeviceStats(devBrands); })
      ]);
    } catch (err) {
    } finally { setLoading(false); }
  }, [selectedSite, router, metrics.totalRevenue, calculateFinancials, routerInfo.cpu]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  // TIMELINE GENERATOR
  useEffect(() => {
    if (ledger.length > 0) {
        const events = ledger.slice(0, 10).map(l => ({
            time: new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon: l.amount > 0 ? <DollarSign size={10} className="text-emerald-500" /> : <Wifi size={10} className="text-indigo-400" />,
            title: l.amount > 0 ? `Payment: KES ${l.amount}` : `Access: ${l.voucherCode || 'Voucher'}`,
            desc: l.resultDesc || 'Network event logged'
        }));
        setActivityTimeline(events);
    }
  }, [ledger]);

  // Traffic polling
  useEffect(() => {
    const fetchTraffic = async () => {
      try {
        const res = await fetch(`/api/admin/router/traffic?siteId=${selectedSite}`, { signal: AbortSignal.timeout(5000) });
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
    fetchTraffic();
    return () => clearInterval(int);
  }, [selectedSite]);

  const handleExportCSV = () => {
    try {
      const data = activeSessions.map(s => ({
        Voucher: s.voucherCode, MAC: s.macAddress, IP: s.ipAddress,
        Uptime: s.uptime, TimeLeft: s.timeLeft,
        UsageMB: ((parseInt(s.bytesIn || '0') + parseInt(s.bytesOut || '0')) / (1024 * 1024)).toFixed(2),
        Package: s.packageName
      }));
      if (data.length === 0) return alert("No data to export");
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `StarlinkNet_Users_${Date.now()}.csv`; a.click();
    } catch (e) { alert("Export failed."); }
  };

  const handleExportData = (format: 'json' | 'excel') => {
    if (format === 'json') {
        const blob = new Blob([JSON.stringify({ revenue: revenueMetrics, sessions: activeSessions, history: connectionHistory }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `StarlinkNet_Full_Export_${Date.now()}.json`; a.click();
    } else {
        alert("📊 Excel Export starting...");
        handleExportCSV();
    }
  };

  const handleReboot = async () => {
    if (!confirm("⚠️ WARNING: Reboot router? Proceed?")) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/router/reboot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: selectedSite }) });
      if (res.ok) alert("🚀 Reboot signal sent!");
    } catch (e) { alert("❌ Reboot command failed."); }
    finally { setActionLoading(false); }
  };

  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone) return;
    setActionLoading(true);
    try {
        const res = await fetch('/api/admin/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: manualPhone, siteId: selectedSite, forceByPhone: true }) });
        if (res.ok) { alert("✅ Manual connection processed!"); setManualPhone(''); fetchData(false); }
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleToggleAdBlock = async () => {
    const nextState = !adBlockEnabled;
    setActionLoading(true);
    try {
        const res = await fetch('/api/admin/router/dns-block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: selectedSite, enabled: nextState }) });
        if (res.ok) { setAdBlockEnabled(nextState); alert(nextState ? "🛡️ Clean Web Active!" : "🌐 Standard DNS Restored."); }
    } catch (e) { alert("Action failed."); }
    finally { setActionLoading(false); }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/offers', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, siteId: selectedSite, maxDevices: parseInt(formData.max_devices) })
      });
      if (res.ok) { alert("✅ Package Saved!"); setFormData({ id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M', data_limit_mb: '0', max_devices: '1', expiry_mode: 'CONTINUOUS' }); fetchData(false); }
    } catch (err) { alert("❌ Connection failed."); }
    finally { setActionLoading(false); }
  };

  const handleKickUser = async (username: string) => {
    if(!confirm(`Disconnect user: ${username}?`)) return;
    try {
      await fetch('/api/admin/router/kick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, siteId: selectedSite }) });
      fetchData(false);
    } catch (e) { alert("Action failed."); }
  };

  const handleExtendTime = async (voucherCode: string) => {
    const mins = prompt("Add minutes (e.g. 30):", "30");
    if (!mins) return;
    try {
      const res = await fetch('/api/admin/router/extend-time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voucherCode, minutes: parseInt(mins), siteId: selectedSite }) });
      if (res.ok) fetchData(false);
    } catch (e) {}
  };

  const handleBlockDevice = async (macAddress: string, voucherCode?: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY block device ${macAddress}?`)) return;
    try {
        const res = await fetch('/api/admin/router/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ macAddress, voucherCode, siteId: selectedSite }) });
        if (res.ok) { alert("✅ Device Blacklisted!"); fetchData(false); }
    } catch (e) { alert("Action failed."); }
  };

  const SystemHealthMatrix = () => (
    <div className="grid grid-cols-5 gap-2 mb-8 no-print">
        {Object.entries(systemHealth).map(([key, status]: any) => (
            <div key={key} className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${status === 'online' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20 animate-pulse'}`}>
                <div className={`w-1.5 h-1.5 rounded-full mb-2 ${status === 'online' ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-red-500 shadow-sm shadow-red-500'}`} />
                <p className="text-[8px] font-black uppercase text-gray-400 tracking-tighter">{key}</p>
                <p className={`text-[10px] font-black uppercase ${status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>{status}</p>
            </div>
        ))}
    </div>
  );

  const FinancialHUD = () => {
    const formatKES = (val: number) => `KES ${Math.round(val).toLocaleString()}`;
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#11141b] border border-gray-800 p-5 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                <div className="relative z-10"><p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Today</p><p className="text-xl font-black text-emerald-400">{formatKES(revenueMetrics.today)}</p></div>
                <div className="absolute bottom-0 left-0 w-full h-10 opacity-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenueMetrics.last7Days}><YAxis hide domain={['dataMin', 'dataMax']} /><Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="bg-[#11141b] border border-gray-800 p-5 rounded-3xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                <div className="relative z-10"><p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">This Week</p><p className="text-xl font-black text-white">{formatKES(revenueMetrics.week)}</p></div>
                <div className="absolute bottom-0 left-0 w-full h-10 opacity-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenueMetrics.last7Days}><YAxis hide domain={['dataMin', 'dataMax']} /><Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="bg-[#11141b] border border-gray-800 p-5 rounded-3xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                <div className="relative z-10"><p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">This Month</p><p className="text-xl font-black text-white">{formatKES(revenueMetrics.month)}</p></div>
                <div className="absolute bottom-0 left-0 w-full h-10 opacity-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenueMetrics.last7Days}><YAxis hide domain={['dataMin', 'dataMax']} /><Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            </div>
            <div className="bg-[#11141b] border border-purple-900/30 p-5 rounded-3xl relative overflow-hidden group hover:border-purple-500/50 transition-all shadow-lg shadow-purple-900/5">
                <div className="relative z-10"><p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-1">Est. Month End</p><p className="text-xl font-black text-purple-400">{formatKES(revenueMetrics.projected)}</p></div>
                <div className="absolute bottom-0 left-0 w-full h-10 opacity-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenueMetrics.last7Days}><YAxis hide domain={['dataMin', 'dataMax']} /><Line type="monotone" dataKey="amount" stroke="#a855f7" strokeWidth={3} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
            </div>
        </div>
    );
  };

  const TrafficGraph = () => {
    const maxVal = Math.max(...trafficHistory.map(h => Math.max(h.rx, h.tx)), 1000000);
    const height = 120; const width = 400;
    const getPoints = (key: 'rx' | 'tx') => trafficHistory.map((h, i) => `${(i / 19) * width},${height - (h[key] / maxVal) * height}`).join(' ');
    return (
        <div className="bg-black/40 rounded-2xl p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-3"><p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Live Bandwidth (Mbps)</p><div className="flex gap-4"><span className="text-[8px] font-black text-emerald-500 uppercase flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> RX</span><span className="text-[8px] font-black text-indigo-500 uppercase flex items-center gap-1"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> TX</span></div></div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                <line x1="0" y1="0" x2={width} y2="0" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2,2" /><line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2,2" /><line x1="0" y1={height} x2={width} y2={height} stroke="#374151" strokeWidth="1" />
                <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" points={getPoints('rx')} className="transition-all duration-500" />
                <polyline fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" points={getPoints('tx')} className="transition-all duration-500" />
            </svg>
        </div>
    );
  };

  const RevenueHeatmap = () => {
    const hours = Array.from({length: 24}, (_, i) => i);
    const hourlyData = new Array(24).fill(0);
    metrics.recentPayments?.forEach((p: any) => { const h = new Date(p.createdAt || Date.now()).getHours(); hourlyData[h] += p.amount; });
    const maxRev = Math.max(...hourlyData, 100);
    return (
        <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-xl">
            <h3 className="text-[10px] font-black uppercase text-indigo-400 mb-4 tracking-widest">Revenue Density (24H)</h3>
            <div className="h-32 flex items-end gap-1 px-1">{hours.map(h => { const height = (hourlyData[h] / maxRev) * 100; return (<div key={h} className="flex-1 group relative"><div className={`w-full rounded-t-sm transition-all duration-500 ${hourlyData[h] > 0 ? 'bg-indigo-500/40 hover:bg-indigo-500' : 'bg-gray-900/30'}`} style={{ height: `${Math.max(5, height)}%` }} /><div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-950 px-2 py-1 rounded text-[8px] font-black border border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">{h}:00 - KES {hourlyData[h]}</div></div>);})}</div>
        </div>
    );
  };

  if (loading) return (<div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center gap-6"><div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" /><div className="text-white text-sm font-black uppercase tracking-[0.3em] animate-pulse">MISSION CONTROL INITIALIZING</div></div>);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 p-6 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto">
        <SystemHealthMatrix />
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl"><LayoutDashboard className="w-8 h-8 text-white" /></div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">STARLINKNET <span className="text-indigo-500">WIFI & 5G</span></h1>
              <div className="flex items-center gap-3 mt-1">
                  <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase text-indigo-400 outline-none"><option value="default-site">Main Operations</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${routerInfo.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />{routerInfo.isOnline ? 'Live Link' : 'System Offline'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4"><button onClick={()=>setShowBulkScreen(!showBulkScreen)} className="bg-gray-800 p-3.5 rounded-xl hover:bg-gray-700 transition-all border border-gray-800 group">{showBulkScreen ? <LayoutDashboard className="w-5 h-5 text-gray-400" /> : <Printer className="w-5 h-5 text-gray-400" />}</button><button onClick={() => router.push('/admin/login')} className="bg-[#1a1d25] p-3.5 rounded-xl hover:text-red-400 border border-gray-800"><LogOut className="w-5 h-5" /></button></div>
        </header>

        {!showBulkScreen ? (
          <div className="space-y-8 animate-in fade-in duration-700">
            <FinancialHUD />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><TrafficGraph /></div>
                <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 flex flex-col justify-between">
                    <div><h3 className="text-[10px] font-black uppercase text-gray-500 mb-4 tracking-widest flex items-center gap-2"><Activity size={12} className="text-emerald-500" /> Internet Health</h3><div className="space-y-4"><div className="flex justify-between items-center"><span className="text-[10px] font-bold text-gray-400 uppercase">Provider</span><span className="text-[10px] font-black text-white uppercase flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Starlink Connected</span></div><div className="flex justify-between items-center border-t border-gray-800 pt-3"><span className="text-[10px] font-bold text-gray-400 uppercase">Success Rate</span><span className="text-[10px] font-black text-emerald-400">99.7%</span></div></div></div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><RevenueHeatmap /><div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-xl"><h3 className="text-[10px] font-black uppercase text-indigo-400 mb-6 tracking-widest">Device Manufacturers</h3><div className="grid grid-cols-2 gap-4 h-32 content-center">{deviceStats.slice(0, 4).map((brand, i) => (<div key={i} className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-gray-800/50"><span className="text-[10px] font-black text-gray-300 uppercase">{brand.name}</span><span className="text-[10px] font-black text-indigo-500">{brand.value}%</span></div>))}</div></div></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl h-full">
                        <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-500" /> Mission Control Feed</h3><div className="flex gap-2"><button onClick={()=>handleExportData('json')} className="p-2 bg-gray-900 text-gray-500 rounded-lg border border-gray-800"><Database size={12}/></button></div></div>
                        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-gray-800">
                            {activityTimeline.map((item, i) => (<div key={i} className="flex gap-6 relative group"><div className={`w-6 h-6 rounded-full flex items-center justify-center relative z-10 border-2 border-[#11141b] ${i === 0 ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-gray-800'}`}>{item.icon}</div><div className="flex-1 bg-black/20 p-4 rounded-2xl border border-gray-800/50 hover:border-indigo-500/30 transition-all"><div className="flex justify-between items-start mb-1"><p className="text-xs font-black text-white uppercase">{item.title}</p><span className="text-[8px] font-bold text-gray-600 uppercase">{item.time}</span></div><p className="text-[9px] text-gray-500 font-medium leading-relaxed uppercase">{item.desc}</p></div></div>))}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-xl group hover:border-indigo-500/30 transition-all">
                        <div className="flex justify-between items-start mb-4"><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hardware Node</p><button onClick={handleReboot} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all">REBOOT</button></div>
                        <div className="space-y-4"><div><h4 className="text-xl font-black text-white">{routerInfo.boardName}</h4><p className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">v{routerInfo.version}</p></div><div className="space-y-2"><div className="flex justify-between text-[8px] font-black uppercase text-gray-500"><span>CPU Load</span><span>{routerInfo.cpu}%</span></div><div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${routerInfo.cpu}%` }} /></div></div></div>
                    </div>
                    <form onSubmit={handleCreateOffer} className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-2xl text-[10px]"><h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 border-b border-gray-800 pb-3">Offer Architect</h3><div className="space-y-4"><input type="text" placeholder="Plan Name" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} required /><div className="grid grid-cols-2 gap-3"><input type="number" placeholder="Price" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} required /><input type="number" placeholder="Mins" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white" value={formData.durationMin} onChange={e=>setFormData({...formData, durationMin:e.target.value})} required /></div><button type="submit" disabled={actionLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20">SAVE OFFER</button></div></form>
                </div>
            </div>

            {/* ACTIVE TABLE */}
            <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl min-h-[500px]">
                <div className="flex justify-between items-center mb-8"><div><h3 className="text-sm font-black flex items-center gap-2 uppercase text-white tracking-widest"><Users className="w-5 h-5 text-indigo-500" /> Active Network Leases</h3></div><button onClick={handleExportCSV} className="bg-gray-900 hover:bg-gray-800 text-gray-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 border border-gray-800"><Download size={12} /> Export CSV</button></div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800"><tr><th className="p-4 tracking-widest">Identity</th><th className="p-4 tracking-widest">Uptime</th><th className="p-4 tracking-widest">Time Left</th><th className="p-4 tracking-widest">Data</th><th className="p-4 text-right tracking-widest">Action</th></tr></thead><tbody className="divide-y divide-gray-800/30">{activeSessions.map(s => (<tr key={s.id} className="hover:bg-indigo-500/[0.03] transition-all"><td className="p-4"><p className="text-indigo-400 font-bold text-sm">{s.voucherCode}</p><p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">{s.macAddress}</p></td><td className="p-4 text-emerald-400 font-black tracking-widest uppercase">{s.uptime}</td><td className="p-4"><span className={`font-black tracking-widest uppercase ${sessionTimers[s.id]?.startsWith('00:0') ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>{sessionTimers[s.id] || s.timeLeft || 'Unlimited'}</span></td><td className="p-4 text-gray-400 font-mono text-[10px]">{((parseInt(s.bytesIn || '0') + parseInt(s.bytesOut || '0')) / (1024 * 1024)).toFixed(1)} MB</td><td className="p-4 text-right flex gap-2 justify-end"><button onClick={() => handleExtendTime(s.voucherCode)} className="bg-indigo-600/5 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all">+TIME</button><button onClick={() => handleKickUser(s.voucherCode)} className="bg-red-600/5 text-red-500 hover:bg-red-600 hover:text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all">KICK</button></td></tr>))}</tbody></table></div>
            </div>
          </div>
        ) : (
          <div className="bg-[#11141b] p-10 rounded-3xl border border-gray-800 shadow-2xl max-w-5xl mx-auto animate-in zoom-in text-xs">
              <h2 className="text-2xl font-black mb-10 text-white uppercase tracking-tighter">Bulk Voucher Matrix</h2>
              <form onSubmit={handleGenerateBulk} className="flex flex-col md:flex-row gap-6 bg-gray-950 p-8 rounded-3xl mb-10 border border-gray-800"><div className="flex-1"><label className="text-[10px] text-gray-600 font-black uppercase mb-3 block">Plan Tier</label><select className="w-full bg-[#1a1d25] border border-gray-800 p-4 rounded-2xl text-white outline-none focus:border-indigo-500" value={bulkGen.package_id} onChange={e => setBulkGen({...bulkGen, package_id: e.target.value})} required><option value="">-- Choose Package --</option>{offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div><div className="md:w-32"><label className="text-[10px] text-gray-600 font-black uppercase mb-3 block">Quantity</label><input type="number" className="w-full bg-[#1a1d25] border border-gray-800 p-4 rounded-2xl text-white outline-none" value={bulkGen.batch_size} onChange={e => setBulkGen({...bulkGen, batch_size: e.target.value})} required /></div><button type="submit" disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-500 px-10 rounded-2xl font-black uppercase text-[10px] h-[53px] self-end shadow-xl shadow-indigo-900/20">GENERATE</button></form>
              {generatedBatch.length > 0 && (<div className="space-y-6"><div className="flex items-center justify-between no-print"><button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-emerald-900/10 transition-all flex items-center gap-2"><Printer className="w-4 h-4" /> Print Vouchers</button></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-8 bg-white rounded-3xl voucher-grid shadow-2xl overflow-hidden">{generatedBatch.map((v, i) => (<div key={i} className="border-2 border-dashed border-indigo-100 p-5 text-center rounded-2xl text-black voucher-card relative overflow-hidden bg-white"><div className="absolute top-0 right-0 p-1 bg-indigo-600 text-white text-[5px] font-black uppercase rounded-bl-lg">ORIGINAL</div><p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1">STARLINKNET.WIFI</p><div className="w-8 h-8 bg-indigo-50/50 rounded-full mx-auto mb-2 flex items-center justify-center"><Wifi className="wifi-icon w-3 h-3 text-indigo-300" /></div><p className="text-sm font-bold text-gray-400 uppercase tracking-tighter mb-1">Access Code</p><p className="text-2xl font-mono font-black border-y-2 border-indigo-50 my-2 py-3 tracking-widest text-indigo-900">{v.code}</p><div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100"><p className="text-[7px] font-black text-gray-500 uppercase">{v.packageName}</p><p className="text-[7px] font-black text-indigo-500 uppercase">VALID 24H</p></div></div>))}</div></div>)}
          </div>
        )}

        {inspectingUser && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md">
                <div className="bg-[#0f1218] border border-indigo-500/20 w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-r from-indigo-900/50 to-black p-8 flex justify-between items-center border-b border-gray-800"><div><h2 className="text-2xl font-black text-white uppercase tracking-tighter">Support X-Ray</h2><p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1">Live Router Diagnostics</p></div><button onClick={() => setInspectingUser(null)} className="p-3 bg-gray-900 rounded-2xl hover:bg-gray-800 transition-colors"><XCircle className="w-6 h-6 text-gray-500" /></button></div>
                    <div className="p-8 space-y-8"><div className="flex items-center gap-6"><div className="p-5 bg-indigo-500/10 rounded-3xl"><Smartphone className="w-10 h-10 text-indigo-500" /></div><div className="flex-1"><p className="text-xl font-black text-white">{inspectingUser.voucherCode}</p><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{inspectingUser.macAddress} • {inspectingUser.ipAddress}</p></div><div className="text-right"><div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${inspectData ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500 animate-pulse'}`}>{inspectLoading ? 'Scanning...' : 'Connected'}</div></div></div><div className="grid grid-cols-2 gap-4"><div className="bg-gray-950 p-6 rounded-3xl border border-gray-800"><p className="text-[9px] font-black text-gray-600 uppercase mb-2">Live Router Ping</p><div className="flex items-center gap-3"><Activity className={`w-5 h-5 ${inspectData?.ping?.alive ? 'text-emerald-500' : 'text-gray-700'}`} /><p className="text-lg font-black text-white">{inspectData?.ping?.alive ? `${inspectData.ping.avgRtt}` : '---'}</p></div></div><div className="bg-gray-950 p-6 rounded-3xl border border-gray-800"><p className="text-[9px] font-black text-gray-600 uppercase mb-2">Session Traffic</p><div className="flex items-center gap-3"><ArrowUpRight className="w-5 h-5 text-indigo-500" /><p className="text-lg font-black text-white">{inspectData ? `${((parseInt(inspectData['bytes-in']) + parseInt(inspectData['bytes-out'])) / (1024*1024)).toFixed(1)} MB` : '---'}</p></div></div></div><div className="grid grid-cols-2 gap-4 pt-4"><button onClick={() => { handleExtendTime(inspectingUser.voucherCode); setInspectingUser(null); }} className="bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-3xl font-black uppercase text-[11px] shadow-lg shadow-emerald-900/10 transition-all flex flex-col items-center gap-2"><Zap className="w-5 h-5" /><span>Add 15m Free</span></button><button onClick={() => handleVipBypass(inspectingUser.macAddress)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-3xl font-black uppercase text-[11px] shadow-lg shadow-indigo-900/10 transition-all flex flex-col items-center gap-2"><Globe className="w-5 h-5" /><span>VIP Bypass</span></button></div></div>
                </div>
            </div>
        )}

        <style jsx global>{`
          html, body { background-color: #0a0c10 !important; color: #f3f4f6 !important; margin: 0; padding: 0; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 10px; }
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; color: black !important; padding: 0 !important; }
            .voucher-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; }
            .voucher-card { border: 1px solid #ddd !important; break-inside: avoid; }
          }
        `}</style>
      </div>
    </div>
  );
}
