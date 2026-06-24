'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, TrendingUp, Activity, Router, LogOut, Settings,
  XCircle, Zap, Wifi, Clock, Database, Smartphone,
  CheckCircle2, ShieldAlert, Cpu, HardDrive, LayoutDashboard,
  Download, List, Printer, Plus, AlertTriangle, ArrowUpRight,
  Search, MessageSquare, Globe
} from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>({ totalRevenue: 0 });
  const [offers, setOffers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [deviceConnections, setDeviceConnections] = useState<any[]>([]);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [routerInfo, setRouterInfo] = useState<any>({ cpu: 0, memory: '0', uptime: '0s', isOnline: false });
  const [ledger, setLedger] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState('default-site');
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [speedLogs, setSpeedLogs] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [showGlobal, setShowGlobal] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ bannerText: '', bannerType: 'info', blockTethering: false });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBulkScreen, setShowBulkScreen] = useState(false);
  const router = useRouter();

  // Form states
  const [formData, setFormData] = useState({
    id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M', data_limit_mb: '', max_devices: '1', expiry_mode: 'CONTINUOUS'
  });
  const [bulkGen, setBulkGen] = useState({ package_id: '', batch_size: '20' });
  const [generatedBatch, setGeneratedBatch] = useState<any[]>([]);
  const [newSite, setNewSite] = useState({ name: '', location: '', routerHost: '', routerUser: '', routerPass: '' });
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => setDebugLog(prev => [msg, ...prev].slice(0, 10));

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const headers = { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' };

      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url, { headers });
          if (res.status === 401) { router.push('/admin/login'); return null; }
          if (!res.ok) return null;
          const text = await res.text();
          if (text.includes('<!DOCTYPE')) return null;
          return JSON.parse(text);
        } catch (e) { return null; }
      };

      const [metr, offr, sess, sys, sett, ledg, ana, sitList, alrts, bckps, glob, spd, devCon, conStat] = await Promise.all([
        safeFetch(`/api/admin/metrics?siteId=${selectedSite}`),
        safeFetch(`/api/admin/offers?siteId=${selectedSite}`),
        safeFetch(`/api/admin/router/active-users?siteId=${selectedSite}`),
        safeFetch(`/api/admin/router/system-info?siteId=${selectedSite}`),
        safeFetch('/api/admin/settings'),
        safeFetch(`/api/admin/ledger?siteId=${selectedSite}`),
        safeFetch(`/api/admin/analytics/revenue?siteId=${selectedSite}`),
        safeFetch('/api/admin/sites'),
        safeFetch(`/api/admin/alerts?siteId=${selectedSite}`),
        safeFetch(`/api/admin/backup?siteId=${selectedSite}`),
        safeFetch('/api/admin/analytics/global'),
        safeFetch('/api/admin/network/speedtest'),
        safeFetch(`/api/device-connection?action=active&siteId=${selectedSite}`),
        safeFetch(`/api/device-connection?action=stats&siteId=${selectedSite}`)
      ]);

      if (metr) setMetrics(metr);
      if (offr) setOffers(offr);
      if (sess) setActiveSessions(sess);
      if (sett) setSystemSettings(sett);
      if (ledg) setLedger(ledg);
      if (devCon) setDeviceConnections(devCon.devices || []);
      if (conStat) setConnectionStats(conStat);

      // Mock analytics if null for the chart demo
      if (ana) {
        setAnalytics(ana);
      } else {
        setAnalytics({
          daily: [
            { date: 'Mon', revenue: 450 },
            { date: 'Tue', revenue: 890 },
            { date: 'Wed', revenue: 1200 },
            { date: 'Thu', revenue: 750 },
            { date: 'Fri', revenue: 2100 },
            { date: 'Sat', revenue: 3200 },
            { date: 'Sun', revenue: 2800 }
          ],
          totalRevenue: 11390
        });
      }

      if (sitList) setSites(sitList);
      if (alrts) setSecurityAlerts(alrts);
      if (bckps) setBackups(bckps);
      if (glob) setGlobalStats(glob);
      if (spd) setSpeedLogs(spd);

      if (sys && !sys.error) {
        setRouterInfo({
          cpu: parseInt(sys['cpu-load']) || 0,
          memory: sys['free-memory'] ? `${(parseInt(sys['free-memory']) / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
          uptime: sys.uptime || '0s',
          isOnline: true,
          boardName: sys['board-name'] || 'RouterBoard',
          version: sys.version || '7.x',
          model: sys.model || 'Unknown',
          name: sys.name || 'MikroTik'
        });
      } else {
        setRouterInfo(prev => ({ ...prev, isOnline: false }));
      }
    } catch (err) {
      console.error("Dashboard refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSite, router]);

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => {
    const int = setInterval(() => fetchData(false), 20000);
    return () => clearInterval(int);
  }, [fetchData]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) alert("✅ Announcement Published!");
      else {
        const data = await res.json();
        alert(`❌ Failed to publish: ${data.error || 'Unknown error'}`);
      }
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
        body: JSON.stringify({ ...formData, siteId: selectedSite, maxDevices: parseInt(formData.max_devices) })
      });
      if (res.ok) {
        alert("✅ Package Saved!");
        setFormData({ id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M', data_limit_mb: '', max_devices: '1', expiry_mode: 'CONTINUOUS' });
        fetchData(false);
      } else alert("❌ Save failed.");
    } catch (err) { alert("❌ Connection failed."); }
    finally { setActionLoading(false); }
  };

  const handleKickUser = async (username: string) => {
    if(!confirm(`Disconnect user: ${username}?`)) return;
    try {
      await fetch('/api/admin/router/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, siteId: selectedSite })
      });
      fetchData(false);
    } catch (e) { alert("Action failed."); }
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
        const res = await fetch(`/api/admin/backup?siteId=${selectedSite}`, { method: 'POST' });
        if (res.ok) {
            alert("✅ Cloud Backup Successful!");
            fetchData(false);
        } else alert("❌ Backup failed.");
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleScanSecurity = async () => {
    setActionLoading(true);
    try {
        const res = await fetch(`/api/admin/network/scan-rogue?siteId=${selectedSite}`, { method: 'POST' });
        if (res.ok) {
            alert("✅ Airspace Scan Complete!");
            fetchData(false);
        } else alert("❌ Scan failed.");
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleExtendTime = async (voucherCode: string) => {
    const mins = prompt("Add minutes (e.g. 30):", "30");
    if (!mins) return;
    try {
      const res = await fetch('/api/admin/router/extend-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voucherCode, minutes: parseInt(mins), siteId: selectedSite })
      });
      if (res.ok) fetchData(false);
    } catch (e) {}
  };

  const handleRunSpeedTest = async () => {
    setActionLoading(true);
    try {
        const res = await fetch('/api/admin/network/speedtest', { method: 'POST' });
        if (res.ok) fetchData(false);
    } catch (e) {}
    finally { setActionLoading(false); }
  };

  const handleReconcile = async () => {
    const ref = prompt("Enter Transaction Reference:");
    if (!ref) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: ref, siteId: selectedSite })
      });
      if (res.ok) {
          alert("Success! Session provisioned.");
          fetchData(false);
      } else {
        const data = await res.json();
        alert(data.error || "Transaction not found or already used.");
      }
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleGenerateBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
        const res = await fetch('/api/admin/vouchers/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                package_id: bulkGen.package_id,
                batch_size: bulkGen.batch_size,
                siteId: selectedSite
            })
        });
        const data = await res.json();
        if (res.ok) {
            setGeneratedBatch(data.vouchers);
            alert(`✅ ${data.count} Vouchers Generated Successfully!`);
        } else alert(`❌ Error: ${data.error}`);
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleBroadcast = async () => {
    const msg = prompt("Enter Marketing Message (sent via WhatsApp):", "Special Offer! 10% off on weekly passes today.");
    if (!msg) return;
    setActionLoading(true);
    try {
        const res = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, siteId: selectedSite })
        });
        const data = await res.json();
        if (res.ok) alert(`✅ Broadcast sent to ${data.count} customers!`);
        else alert(`❌ Broadcast failed: ${data.error}`);
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  const handleResendVoucherByRef = async (ref: string, phone: string) => {
    if (!confirm(`Resend voucher to ${phone}?`)) return;
    try {
        await fetch(`/api/admin/resend?reference=${ref}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        alert("Resend triggered.");
    } catch (e) {}
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchData(false);
      } else {
        const data = await res.json();
        alert(`❌ Delete failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert("❌ Network error while deleting package.");
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
        const res = await fetch('/api/admin/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSite)
        });
        if (res.ok) {
            alert("✅ New Site Added!");
            setShowSiteForm(false);
            setNewSite({ name: '', location: '', routerHost: '', routerUser: '', routerPass: '' });
            fetchData(false);
        } else alert("❌ Error adding site.");
    } catch (e) { alert("Network error."); }
    finally { setActionLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <Zap className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <div className="text-white text-sm font-black uppercase tracking-[0.3em] animate-pulse">STARLINKNET CLOUD SYNC</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 p-6 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto">
        {/* HEADER SECTION */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-xl shadow-indigo-500/20">
            <LayoutDashboard className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">STARLINKNET <span className="text-indigo-500">WIFI</span></h1>
            <div className="flex items-center gap-3 mt-1">
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase text-indigo-400 outline-none focus:border-indigo-500 cursor-pointer"
                >
                    <option value="default-site">Main Operations</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => setShowSiteForm(!showSiteForm)} className="text-[9px] text-gray-500 hover:text-white uppercase font-black tracking-widest flex items-center gap-1">
                    <Plus className="w-2.5 h-2.5" /> Site
                </button>
                <div className="w-px h-3 bg-gray-800" />
                <button onClick={() => setShowGlobal(!showGlobal)} className={`text-[9px] uppercase font-black tracking-widest flex items-center gap-1.5 ${showGlobal ? 'text-indigo-400' : 'text-gray-500 hover:text-white'}`}>
                    <Globe className="w-3 h-3" /> Global View
                </button>
                <div className="w-px h-3 bg-gray-800" />
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${routerInfo.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {routerInfo.isOnline ? 'Live Link' : 'System Offline'}
                </p>
                <button
                  onClick={async () => {
                    addLog("Starting Connection Test...");
                    try {
                      const res = await fetch(`/api/admin/router/test-connection?siteId=${selectedSite}&t=${Date.now()}`);
                      const data = await res.json();

                      if (data.success) {
                        addLog("✅ Connection Success!");
                        alert(`✅ ${data.message || 'Connected!'}\n\nHost: ${data.configUsed?.host}\nMode: ${data.configUsed?.mode}`);
                      } else {
                        addLog(`❌ Fail: ${data.error}`);
                        let msg = `❌ Connection Failed\n\nError: ${data.error}\n\nTip: ${data.tip}`;
                        if (data.error?.includes("AUTH_FAILED")) {
                            msg = `⚠️ PASSWORD MISMATCH\n\nYour router is rejecting the login.\n\nFIX: Run this in MikroTik Terminal:\n/user set admin password=Hazy.123`;
                        }
                        alert(msg);

                        // Run diagnostics if failed
                        try {
                          addLog("Running port diagnostics...");
                          const portRes = await fetch(`/api/admin/router/debug-port?host=${data.configUsed?.host}&port=${data.configUsed?.port}`);
                          const portData = await portRes.json();
                          addLog(`Port Debug: ${portData.message}`);
                        } catch (e) {}
                      }
                      fetchData(false);
                    } catch (err) {
                      addLog("❌ API unreachable");
                      alert("❌ Could not reach the API service. Make sure Next.js is running.");
                    }
                  }}
                  className="text-[8px] bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded border border-gray-700 font-black uppercase text-indigo-400 ml-2"
                >
                  Test Connection
                </button>
            </div>
            {/* DEBUG CONSOLE */}
            {debugLog.length > 0 && (
                <div className="mt-4 p-3 bg-black/80 rounded-xl border border-indigo-500/20 font-mono text-[9px] text-indigo-300">
                    <div className="flex justify-between items-center mb-1">
                        <span className="uppercase font-black text-indigo-500">System Logs</span>
                        <button onClick={() => setDebugLog([])} className="text-gray-500 hover:text-white">Clear</button>
                    </div>
                    {debugLog.map((log, i) => <div key={i} className="mb-0.5 opacity-80">{`> ${log}`}</div>)}
                </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:flex-none flex gap-6 px-6 py-3 bg-[#11141b] rounded-2xl border border-gray-800 shadow-inner">
             <div><p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Net Revenue</p><p className="text-sm font-black text-emerald-400">KES {metrics.totalRevenue || 0}</p></div>
             <div className="w-px bg-gray-800" />
             <div><p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Leases</p><p className="text-sm font-black text-indigo-400">{activeSessions.length}</p></div>
          </div>
          <button onClick={handleBroadcast} className="bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white p-3.5 rounded-xl border border-amber-500/20 transition-all group" title="Bulk WhatsApp Broadcast">
            <MessageSquare className="w-5 h-5" />
          </button>
          <button onClick={() => setShowBulkScreen(!showBulkScreen)} className="bg-gray-800 p-3.5 rounded-xl hover:bg-gray-700 transition-all border border-gray-700 group">
            {showBulkScreen ? <LayoutDashboard className="w-5 h-5 text-gray-400 group-hover:text-white" /> : <Printer className="w-5 h-5 text-gray-400 group-hover:text-white" />}
          </button>
          <button onClick={() => router.push('/admin/login')} className="bg-[#1a1d25] p-3.5 rounded-xl hover:text-red-400 transition-colors border border-gray-800"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {showSiteForm && (
          <div className="mb-8 p-6 bg-gray-900/50 rounded-3xl border border-gray-800 animate-in slide-in-from-top-4 duration-300">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2"><Globe className="w-3 h-3" /> Register New Deployment Site</h3>
              <form onSubmit={handleAddSite} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <input type="text" placeholder="Site Name" className="bg-black/40 border border-gray-800 p-3 rounded-xl text-xs" value={newSite.name} onChange={e=>setNewSite({...newSite, name:e.target.value})} required />
                  <input type="text" placeholder="Location" className="bg-black/40 border border-gray-800 p-3 rounded-xl text-xs" value={newSite.location} onChange={e=>setNewSite({...newSite, location:e.target.value})} />
                  <input type="text" placeholder="Router IP/Host" className="bg-black/40 border border-gray-800 p-3 rounded-xl text-xs" value={newSite.routerHost} onChange={e=>setNewSite({...newSite, routerHost:e.target.value})} required />
                  <input type="text" placeholder="Router User" className="bg-black/40 border border-gray-800 p-3 rounded-xl text-xs" value={newSite.routerUser} onChange={e=>setNewSite({...newSite, routerUser:e.target.value})} />
                  <button type="submit" disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-500 p-3 rounded-xl text-[10px] font-black uppercase">Add Site</button>
              </form>
          </div>
      )}

      {showGlobal && (
          <div className="mb-10 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-6 duration-500">
              <div className="md:col-span-1 bg-gradient-to-br from-indigo-900/40 to-black border border-indigo-500/20 p-6 rounded-3xl">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Network-Wide Revenue</p>
                  <p className="text-3xl font-black text-white">KES {globalStats?.totalRevenue || 0}</p>
                  <p className="text-[9px] text-gray-500 font-bold mt-2 uppercase">All Sites Combined</p>
              </div>
              <div className="md:col-span-3 bg-[#11141b] border border-gray-800 p-6 rounded-3xl flex items-center gap-8 overflow-x-auto">
                  {globalStats?.sites?.map((s: any) => (
                      <div key={s.id} className="min-w-[150px]">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{s.name}</p>
                          <p className="text-lg font-black text-white">KES {s.revenue}</p>
                          <div className="flex items-center gap-2 mt-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <p className="text-[8px] font-bold text-gray-400 uppercase">{s.activeUsers} Active</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {!showBulkScreen ? (
        <div className="space-y-8 animate-in fade-in duration-700">
          {/* --- REVENUE & NETWORK STATS --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-3xl text-white shadow-xl shadow-indigo-500/10 border border-white/5 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] opacity-70 uppercase tracking-widest font-black">Total Revenue</p>
                <h3 className="text-4xl font-black mt-2">KSh {metrics?.totalRevenue?.toLocaleString() || '0'}</h3>
                <p className="text-[10px] mt-2 opacity-60 font-medium">Processed via Safaricom Daraja API</p>
              </div>
              <TrendingUp className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
            </div>

            <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-lg relative overflow-hidden">
               <div className="relative z-10">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Active Performance</p>
                <div className="mt-4 flex items-end gap-1 h-12">
                  {analytics?.daily?.map((d: any, i: number) => (
                    <div
                      key={i}
                      className="flex-1 bg-indigo-500/40 rounded-t-sm hover:bg-indigo-500 transition-all cursor-help relative group"
                      style={{ height: `${Math.min(100, (d.revenue / 4000) * 100)}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-[8px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
                        {d.date}: KES {d.revenue}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] mt-2 text-gray-600 font-medium uppercase tracking-tighter">7-Day Revenue Trend</p>
              </div>
            </div>

            <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-lg group hover:border-indigo-500/30 transition-all">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Hardware Identity</p>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${routerInfo.isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {routerInfo.isOnline ? 'System Linked' : 'Offline'}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <h4 className="text-xl font-black text-white">{routerInfo.boardName || 'Router'}</h4>
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">OS v{routerInfo.version || '7.1'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-gray-500 uppercase font-black">Uptime</p>
                    <p className="text-xs font-black text-indigo-400">{routerInfo.uptime || '0s'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[8px] font-black uppercase text-gray-500">
                    <span>CPU Load</span>
                    <span className={routerInfo.cpu > 80 ? 'text-red-500' : 'text-emerald-500'}>{routerInfo.cpu}%</span>
                  </div>
                  <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${routerInfo.cpu > 80 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${routerInfo.cpu}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-gray-800/50">
                   <div className="flex-1">
                     <p className="text-[8px] text-gray-600 uppercase font-black">RAM Available</p>
                     <p className="text-xs font-black text-white">{routerInfo.memory || '0 MB'}</p>
                   </div>
                   <Activity className={`w-4 h-4 ${routerInfo.isOnline ? 'text-emerald-500 animate-pulse' : 'text-gray-700'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* --- SYSTEM HEALTH & TOOLS --- */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button onClick={handleRunSpeedTest} className="bg-[#11141b] p-4 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition-all flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-white">Speed Test</p>
                <p className="text-[8px] text-gray-500 uppercase">Check Bandwidth</p>
              </div>
            </button>
            <button onClick={handleScanSecurity} className="bg-[#11141b] p-4 rounded-2xl border border-gray-800 hover:border-red-500/50 transition-all flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-white">Airspace Scan</p>
                <p className="text-[8px] text-gray-500 uppercase">Rogue AP Detection</p>
              </div>
            </button>
            <button onClick={handleCreateBackup} className="bg-[#11141b] p-4 rounded-2xl border border-gray-800 hover:border-emerald-500/50 transition-all flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-500" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-white">Cloud Backup</p>
                <p className="text-[8px] text-gray-500 uppercase">Save Config</p>
              </div>
            </button>
            <button onClick={handleReconcile} className="bg-[#11141b] p-4 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition-all flex items-center gap-3">
              <ArrowUpRight className="w-5 h-5 text-indigo-500" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-white">Reconcile</p>
                <p className="text-[8px] text-gray-500 uppercase">Manual Provision</p>
              </div>
            </button>
          </div>

          {/* PACKAGE OFFERS LIST */}
          <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
              <span className="text-indigo-500 text-lg">📦</span> Manage Active Packages
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {offers.length === 0 ? (
                <p className="col-span-full text-center py-8 text-gray-600 italic text-xs">No packages found. Create one using the form below.</p>
              ) : (
                offers.map((offer) => (
                  <div key={offer.id} className="p-4 border border-gray-800 rounded-2xl bg-gray-900/40 shadow-sm flex flex-col justify-between group hover:border-indigo-500/30 transition-all">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-lg text-gray-200 group-hover:text-indigo-400 transition-colors">{offer.name}</h4>
                        <button
                          onClick={() => setFormData({
                            id: offer.id,
                            name: offer.name,
                            durationMin: String(offer.durationMin || 60),
                            price: String(offer.price),
                            download_limit: offer.download_limit || '5M',
                            upload_limit: offer.upload_limit || '5M',
                            data_limit_mb: String(offer.dataLimitMB || ''),
                            max_devices: String(offer.max_devices || 1),
                            expiry_mode: offer.expiry_mode || 'CONTINUOUS'
                          })}
                          className="text-[10px] text-indigo-400 hover:text-white font-black uppercase"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-sm text-gray-500">Duration: {offer.duration}</p>
                      <p className="text-xl font-extrabold text-emerald-400 mt-2">KSh {offer.price}</p>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase font-black tracking-tighter">
                        🚀 {offer.speedLimit || `${offer.uploadLimit}/${offer.downloadLimit}`} | 📱 {offer.max_devices} Dev | 💾 {offer.dataLimitMB ? `${offer.dataLimitMB}MB` : 'Unlimited'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteOffer(offer.id)}
                      className="mt-4 w-full bg-red-950/20 text-red-500 hover:bg-red-600 hover:text-white transition-colors duration-150 py-2.5 rounded-xl text-[10px] font-black uppercase border border-red-500/10"
                    >
                      🗑️ Delete Package
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <form onSubmit={handleCreateOffer} className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden group text-xs">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-3">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Package Architect</h3>
                        {formData.id && (
                          <button
                            type="button"
                            onClick={() => setFormData({ id: '', name: '', durationMin: '60', price: '', download_limit: '5M', upload_limit: '5M', data_limit_mb: '', max_devices: '1', expiry_mode: 'CONTINUOUS' })}
                            className="text-[10px] text-gray-500 hover:text-white font-black uppercase"
                          >
                            Cancel Edit
                          </button>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[8px] text-gray-600 uppercase font-black ml-1">Plan Display Name</label>
                            <input type="text" placeholder="e.g. 24HRS UNLIMITED" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black ml-1">Price (KES)</label>
                                <input type="number" placeholder="50" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black ml-1">Runtime (Mins)</label>
                                <input type="number" placeholder="1440" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none" value={formData.durationMin} onChange={e=>setFormData({...formData, durationMin:e.target.value})} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black ml-1">Download (e.g. 5M)</label>
                                <input type="text" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none" value={formData.download_limit} onChange={e=>setFormData({...formData, download_limit:e.target.value})} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-gray-600 uppercase font-black ml-1">Upload (e.g. 2M)</label>
                                <input type="text" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none" value={formData.upload_limit} onChange={e=>setFormData({...formData, upload_limit:e.target.value})} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] text-indigo-400 uppercase font-black ml-1">Data Limit (MB)</label>
                                <input type="number" placeholder="0 for Unlimited" className="w-full bg-gray-950 border border-gray-800 p-3.5 rounded-2xl text-white outline-none" value={formData.data_limit_mb} onChange={e=>setFormData({...formData, data_limit_mb:e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-indigo-400 uppercase font-black ml-1">Device Sharing</label>
                                <select className="w-full bg-gray-950 border border-gray-800 p-3 rounded-2xl text-white outline-none" value={formData.max_devices} onChange={e=>setFormData({...formData, max_devices:e.target.value})}>
                                    <option value="1">Solo Pass</option><option value="2">Duo Sharing</option><option value="5">Group/Office</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" disabled={actionLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all">
                          {formData.id ? 'UPDATE PACKAGE' : 'COMMIT TO CLOUD'}
                        </button>
                    </div>
                </form>

                <div className="bg-[#11141b] p-6 rounded-3xl border border-gray-800 shadow-xl">
                    <h3 className="text-sm font-black uppercase text-white mb-6 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Network Broadcast</h3>
                    <textarea className="w-full bg-gray-950 border border-gray-800 p-4 rounded-2xl text-xs text-white outline-none h-24 focus:border-amber-500 transition-all" placeholder="Enter urgent maintenance message..." value={systemSettings.bannerText} onChange={e => setSystemSettings({...systemSettings, bannerText: e.target.value})} />
                    <button onClick={handleUpdateSettings} disabled={actionLoading} className="w-full bg-amber-600 hover:bg-amber-500 mt-3 p-3.5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-amber-900/10 transition-all">Publish Live</button>
                </div>

                {/* DEVICE CONNECTIONS TRACKING */}
                <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-white tracking-widest"><Wifi className="w-5 h-5 text-emerald-500" /> Device Connection Logs</h3>
                        {connectionStats && (
                            <div className="flex gap-4">
                                <div className="text-right">
                                    <p className="text-[7px] text-gray-500 uppercase font-black">Active Now</p>
                                    <p className="text-xs font-black text-emerald-500">{connectionStats.activeConnections}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[7px] text-gray-500 uppercase font-black">Total Today</p>
                                    <p className="text-xs font-black text-white">{connectionStats.totalConnections}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800">
                                <tr>
                                    <th className="p-4 tracking-widest">Device / MAC</th>
                                    <th className="p-4 tracking-widest">IP Address</th>
                                    <th className="p-4 tracking-widest">Voucher</th>
                                    <th className="p-4 text-right tracking-widest">Connected</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {deviceConnections?.map(d => (
                                    <tr key={d.id} className="hover:bg-emerald-500/[0.03] transition-all">
                                        <td className="p-4">
                                            <p className="text-white font-bold">{d.deviceName || 'Unknown Device'}</p>
                                            <p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">{d.macAddress}</p>
                                        </td>
                                        <td className="p-4 text-gray-400 font-mono text-[10px]">{d.ipAddress}</td>
                                        <td className="p-4 text-indigo-400 font-bold uppercase">{d.voucherCode || '—'}</td>
                                        <td className="p-4 text-right text-gray-500 font-bold">{new Date(d.connectedAt).toLocaleTimeString()}</td>
                                    </tr>
                                ))}
                                {deviceConnections.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-gray-700 italic font-black uppercase tracking-[0.2em] text-[9px]">No recent device activity logged</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RECENT TRANSACTIONS */}
                <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                    <h3 className="text-sm font-black flex items-center gap-2 uppercase text-white mb-8 tracking-widest"><TrendingUp className="w-5 h-5 text-indigo-500" /> Recent Transactions</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800">
                                <tr>
                                    <th className="p-4 tracking-widest">Reference</th>
                                    <th className="p-4 tracking-widest">Amount</th>
                                    <th className="p-4 tracking-widest">Status</th>
                                    <th className="p-4 text-right tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {metrics.recentPayments?.map((p: any) => (
                                    <tr key={p.id} className="hover:bg-indigo-500/[0.03] transition-all">
                                        <td className="p-4">
                                            <p className="text-white font-bold text-xs">{p.transactionRef || 'N/A'}</p>
                                            <p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">{p.phoneNumber || 'NO PHONE'}</p>
                                        </td>
                                        <td className="p-4 text-emerald-400 font-black">KES {p.amount}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                              onClick={() => handleResendVoucherByRef(p.transactionRef, p.phoneNumber)}
                                              className="text-[9px] font-black uppercase text-indigo-400 hover:text-white"
                                            >
                                                Resend
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!metrics.recentPayments || metrics.recentPayments.length === 0) && <tr><td colSpan={4} className="p-12 text-center text-gray-700 italic font-black uppercase tracking-[0.2em] text-[9px]">No recent payments</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-8 text-xs">
                {/* ACTIVE SESSIONS TABLE */}
                <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl min-h-[500px]">
                    <h3 className="text-sm font-black flex items-center gap-2 uppercase text-white mb-8 tracking-widest"><Users className="w-5 h-5 text-indigo-500" /> Active Network Leases</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800">
                                <tr><th className="p-4 tracking-widest">Identity</th><th className="p-4 tracking-widest">Uptime</th><th className="p-4 tracking-widest">Package</th><th className="p-4 text-right tracking-widest">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {activeSessions?.map(s => (
                                    <tr key={s.id} className="hover:bg-indigo-500/[0.03] transition-all">
                                        <td className="p-4"><p className="text-indigo-400 font-bold text-sm">{s.voucherCode}</p><p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">{s.macAddress}</p></td>
                                        <td className="p-4 text-emerald-400 font-black tracking-widest uppercase">{s.uptime}</td>
                                        <td className="p-4 text-gray-600 font-bold uppercase">{s.packageName}</td>
                                        <td className="p-4 text-right flex gap-2 justify-end">
                                            <button onClick={() => handleExtendTime(s.voucherCode)} className="bg-indigo-600/5 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all">+TIME</button>
                                            <button onClick={() => handleKickUser(s.voucherCode)} className="bg-red-600/5 text-red-500 hover:bg-red-600 hover:text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all">KICK</button>
                                        </td>
                                    </tr>
                                ))}
                                {activeSessions.length === 0 && <tr><td colSpan={4} className="p-24 text-center text-gray-700 italic font-black uppercase tracking-[0.3em] text-[10px]">Awaiting Hardware Connections</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DEVICE CONNECTIONS TRACKING */}
                <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-white tracking-widest"><Wifi className="w-5 h-5 text-emerald-500" /> Device Connection Logs</h3>
                        {connectionStats && (
                            <div className="flex gap-4">
                                <div className="text-right">
                                    <p className="text-[7px] text-gray-500 uppercase font-black">Active Now</p>
                                    <p className="text-xs font-black text-emerald-500">{connectionStats.activeConnections}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[7px] text-gray-500 uppercase font-black">Total Today</p>
                                    <p className="text-xs font-black text-white">{connectionStats.totalConnections}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800">
                                <tr>
                                    <th className="p-4 tracking-widest">Device / MAC</th>
                                    <th className="p-4 tracking-widest">IP Address</th>
                                    <th className="p-4 tracking-widest">Voucher</th>
                                    <th className="p-4 text-right tracking-widest">Connected</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {deviceConnections?.map(d => (
                                    <tr key={d.id} className="hover:bg-emerald-500/[0.03] transition-all">
                                        <td className="p-4">
                                            <p className="text-white font-bold">{d.deviceName || 'Unknown Device'}</p>
                                            <p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">{d.macAddress}</p>
                                        </td>
                                        <td className="p-4 text-gray-400 font-mono text-[10px]">{d.ipAddress}</td>
                                        <td className="p-4 text-indigo-400 font-bold uppercase">{d.voucherCode || '—'}</td>
                                        <td className="p-4 text-right text-gray-500 font-bold">{new Date(d.connectedAt).toLocaleTimeString()}</td>
                                    </tr>
                                ))}
                                {deviceConnections.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-gray-700 italic font-black uppercase tracking-[0.2em] text-[9px]">No recent device activity logged</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RECENT TRANSACTIONS */}
                <div className="bg-[#11141b] p-8 rounded-3xl border border-gray-800 shadow-2xl">
                    <h3 className="text-sm font-black flex items-center gap-2 uppercase text-white mb-8 tracking-widest"><TrendingUp className="w-5 h-5 text-indigo-500" /> Recent Transactions</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-950/50 text-[9px] text-gray-600 uppercase font-black border-b border-gray-800">
                                <tr>
                                    <th className="p-4 tracking-widest">Reference</th>
                                    <th className="p-4 tracking-widest">Amount</th>
                                    <th className="p-4 tracking-widest">Status</th>
                                    <th className="p-4 text-right tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {metrics.recentPayments?.map((p: any) => (
                                    <tr key={p.id} className="hover:bg-indigo-500/[0.03] transition-all">
                                        <td className="p-4">
                                            <p className="text-white font-bold text-xs">{p.transactionRef || 'N/A'}</p>
                                            <p className="text-[8px] font-black opacity-40 uppercase tracking-tighter">{p.phoneNumber || 'NO PHONE'}</p>
                                        </td>
                                        <td className="p-4 text-emerald-400 font-black">KES {p.amount}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                              onClick={() => handleResendVoucherByRef(p.transactionRef, p.phoneNumber)}
                                              className="text-[9px] font-black uppercase text-indigo-400 hover:text-white"
                                            >
                                                Resend
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!metrics.recentPayments || metrics.recentPayments.length === 0) && <tr><td colSpan={4} className="p-12 text-center text-gray-700 italic font-black uppercase tracking-[0.2em] text-[9px]">No recent payments</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#11141b] p-10 rounded-3xl border border-gray-800 shadow-2xl max-w-5xl mx-auto animate-in zoom-in text-xs">
            <h2 className="text-2xl font-black mb-2 text-white uppercase tracking-tighter">Bulk Voucher Matrix</h2>
            <form onSubmit={handleGenerateBulk} className="flex flex-col md:flex-row gap-6 bg-gray-950 p-8 rounded-3xl mb-10 border border-gray-800">
                <div className="flex-1">
                    <label className="text-[10px] text-gray-600 font-black uppercase mb-3 block">Plan Tier</label>
                    <select className="w-full bg-[#1a1d25] border border-gray-800 p-4 rounded-2xl text-white outline-none focus:border-indigo-500" value={bulkGen.package_id} onChange={e => setBulkGen({...bulkGen, package_id: e.target.value})} required>
                        <option value="">-- Choose Package --</option>
                        {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                </div>
                <div className="md:w-32">
                    <label className="text-[10px] text-gray-600 font-black uppercase mb-3 block">Quantity</label>
                    <input type="number" className="w-full bg-[#1a1d25] border border-gray-800 p-4 rounded-2xl text-white outline-none" value={bulkGen.batch_size} onChange={e => setBulkGen({...bulkGen, batch_size: e.target.value})} required />
                </div>
                <button type="submit" disabled={actionLoading} className="bg-indigo-600 hover:bg-indigo-500 px-10 rounded-2xl font-black uppercase text-[10px] h-[53px] self-end shadow-xl shadow-indigo-900/20">GENERATE</button>
            </form>

            {generatedBatch.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between no-print">
                      <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-emerald-900/10 transition-all flex items-center gap-2">
                        <Printer className="w-4 h-4" /> Print Vouchers
                      </button>
                      <p className="text-[10px] text-gray-500 font-bold uppercase italic">Print preview shows professional branding</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-8 bg-white rounded-3xl voucher-grid shadow-2xl overflow-hidden">
                        {generatedBatch.map((v, i) => (
                            <div key={i} className="border-2 border-dashed border-indigo-100 p-5 text-center rounded-2xl text-black voucher-card relative overflow-hidden bg-white">
                                <div className="absolute top-0 right-0 p-1 bg-indigo-600 text-white text-[5px] font-black uppercase rounded-bl-lg">ORIGINAL</div>
                                <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1">STARLINKNET.WIFI</p>
                                <div className="w-8 h-8 bg-indigo-50/50 rounded-full mx-auto mb-2 flex items-center justify-center">
                                  <Wifi className="w-3 h-3 text-indigo-300" />
                                </div>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-tighter mb-1">Access Code</p>
                                <p className="text-2xl font-mono font-black border-y-2 border-indigo-50 my-2 py-3 tracking-widest text-indigo-900">{v.code}</p>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                  <p className="text-[7px] font-black text-gray-500 uppercase">{v.packageName}</p>
                                  <p className="text-[7px] font-black text-indigo-500 uppercase">VALID 24H</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      <style jsx global>{`
        body { background-color: #0a0c10 !important; margin: 0; padding: 0; }
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
  );
}
