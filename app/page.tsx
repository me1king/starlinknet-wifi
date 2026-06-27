"use client";

import React, { useState, useEffect, useRef } from 'react';
import { XCircle, CheckCircle2, ShieldAlert, Zap } from 'lucide-react';

export default function PayPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [bundlePlans, setBundlePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [tunnelBlocked, setTunnelBlocked] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isWaitingForPin, setIsWaitingForPin] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [purchasedVoucher, setPurchasedVoucher] = useState("");
  const [showRebind, setShowRebind] = useState(false);
  const [rebindValue, setRebindValue] = useState("");
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const [referPhone, setReferPhone] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [showTvConnect, setShowTvConnect] = useState(false);
  const [tvMac, setTvMac] = useState("");
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [systemBanner, setSystemBanner] = useState<{ text: string, type: string } | null>(null);

  // Router variables
  const [mac, setMac] = useState("");
  const [ip, setIp] = useState("");
  const [siteId, setSiteId] = useState("default-site");
  const [linkLogin, setLinkLogin] = useState("");
  const [linkOrig, setLinkOrig] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Capture Router Vars
    const params = new URLSearchParams(window.location.search);
    const urlMac = params.get('mac') || localStorage.getItem('last_mac') || "";
    const urlIp = params.get('ip') || localStorage.getItem('last_ip') || "";
    const urlSiteId = params.get('siteId') || "default-site";

    setMac(urlMac);
    setIp(urlIp);
    setSiteId(urlSiteId);

    if (urlMac) localStorage.setItem('last_mac', urlMac);
    if (urlIp) localStorage.setItem('last_ip', urlIp);

    setLinkLogin(params.get('link-login') || params.get('link-login-only') || "");
    setLinkOrig(params.get('link-orig') || "");

    // Check if MAC is missing - Critical for Hotspot
    if (!urlMac && !params.get('reference')) {
        setStatus({
            success: false,
            message: "⚠️ System could not identify your device. Please DISCONNECT from Wi-Fi and RECONNECT to see the billing page properly."
        });
    }

    // 2. Local Storage Session Backup (Resiliency) & Auto-Reconnect
    const savedRef = localStorage.getItem('active_checkout_ref');
    const savedMac = localStorage.getItem('last_mac');
    const savedTime = localStorage.getItem('active_checkout_time');

    const triggerAutoReconnect = async (currentMac: string) => {
      try {
        console.log("[Auto-Reconnect] Checking for active session for MAC:", currentMac);
        const res = await fetch(`/api/auth/rebind`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mac: currentMac, ip: urlIp, siteId: urlSiteId }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          console.log("[Auto-Reconnect] Session found, logging in...");
          loginRouter(data.voucherCode);
        }
      } catch (err) {
        console.error("[Auto-Reconnect] Failed:", err);
      }
    };

    if (urlMac) {
      triggerAutoReconnect(urlMac);
    }

    // Only auto-resume if the session is less than 15 minutes old
    const isStale = savedTime && (Date.now() - parseInt(savedTime)) > 15 * 60 * 1000;

    if (savedRef && !isStale && (!urlMac || savedMac === urlMac)) {
      setActiveReference(savedRef);
      setIsWaitingForPin(true);
      pollVerification(savedRef);
    } else if (isStale) {
      // Clean up stale session
      localStorage.removeItem('active_checkout_ref');
      localStorage.removeItem('active_checkout_time');
    }

    // 3. Check for redirect return
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      setActiveReference(reference);
      localStorage.setItem('active_checkout_ref', reference);
      localStorage.setItem('active_checkout_time', Date.now().toString());
      if (urlMac) localStorage.setItem('last_mac', urlMac);
      setIsWaitingForPin(true);
      pollVerification(reference);
    }

    // 4. Fetch Plans
    const fetchPlans = async () => {
      try {
        // Log Portal Hit for Analytics
        const ua = navigator.userAgent;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
        const deviceType = isMobile ? "MOBILE" : "PC";

        fetch('/api/device-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                macAddress: urlMac || "VISITOR",
                ipAddress: urlIp || "0.0.0.0",
                deviceName: `${deviceType} - ${ua.split(')')[0].split('(')[1] || 'Guest'}`,
                status: 'PORTAL_HIT',
                siteId: urlSiteId
            })
        }).catch(() => {});

        const res = await fetch(`/api/admin/offers?siteId=${urlSiteId}`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
            'Accept': 'application/json'
          }
        });

        if (!res.ok) {
           console.error("Plans fetch failed with status:", res.status);
           return;
        }

        const text = await res.text();
        if (text.toLowerCase().includes('<!doctype html>')) {
          console.warn("Tunnel warning detected, retrying with headers...");
          setTunnelBlocked(true);
          return;
        }

        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            setBundlePlans(data);
            if (data.length > 0) setSelectedPlan(data[0]);
            setTunnelBlocked(false);
          }
        } catch (parseErr) {
          console.error("Failed to parse plans JSON:", text.substring(0, 100));
        }
      } catch (err) {
        console.error("Plans fetch crash:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchPlans();

    // Fetch System Banner
    const fetchBanner = async () => {
      try {
        const res = await fetch('/api/admin/settings', { headers: { 'ngrok-skip-browser-warning': 'true', 'Bypass-Tunnel-Reminder': 'true' } });
        const data = await res.json();
        if (data && data.bannerText && data.bannerText.trim() !== "") {
          setSystemBanner({ text: data.bannerText, type: data.bannerType });
        }
      } catch (err) {}
    };
    fetchBanner();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWaitingForPin && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isWaitingForPin, countdown]);

  const pollVerification = async (ref: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const check = async () => {
      try {
        const res = await fetch(`/api/pay/verify?reference=${ref}`);
        const data = await res.json();
        if (data.success) {
          setPurchasedVoucher(data.voucherCode);
          setIsSuccess(true);
          setIsWaitingForPin(false);
          localStorage.removeItem('active_checkout_ref');
          localStorage.removeItem('active_checkout_time');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setTimeout(() => loginRouter(data.voucherCode), 2000);
        } else if (data.status === 'failed') {
          setStatus({ success: false, message: `❌ Payment failed: ${data.message || 'Cancelled'}` });
          setIsWaitingForPin(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (e) {}
    };
    pollIntervalRef.current = setInterval(check, 2000);
    check();
  };

  const loginRouter = (code: string) => {
    if (linkLogin) {
      const form = document.createElement('form');
      form.method = 'POST'; form.action = linkLogin;
      const u = document.createElement('input'); u.type='hidden'; u.name='username'; u.value=code;
      const p = document.createElement('input'); p.type='hidden'; p.name='password'; p.value=code;
      const d = document.createElement('input'); d.type='hidden'; d.name='dst'; d.value=linkOrig || 'http://google.com';
      form.appendChild(u); form.appendChild(p); form.appendChild(d);
      document.body.appendChild(form); form.submit();
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !selectedPlan) return;
    setLoading(true); setStatus(null);

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, email, packageId: selectedPlan.id, mac, ip, siteId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      if (data.status === "success") {
        localStorage.setItem('active_checkout_time', Date.now().toString());
        if (data.authorization_url) {
          localStorage.setItem('active_checkout_ref', data.reference);
          localStorage.setItem('last_mac', mac);
          window.location.href = data.authorization_url;
        } else {
          setActiveReference(data.reference);
          setIsWaitingForPin(true);
          setCountdown(60);
          localStorage.setItem('active_checkout_ref', data.reference);
          localStorage.setItem('last_mac', mac);
          pollVerification(data.reference);
        }
      }
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (!activeReference) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/verify?reference=${activeReference}`);
      const data = await res.json();
      if (data.success) {
        setPurchasedVoucher(data.voucherCode);
        setIsSuccess(true);
        setIsWaitingForPin(false);
        localStorage.removeItem('active_checkout_ref');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setTimeout(() => loginRouter(data.voucherCode), 2000);
      } else {
        alert("Payment still pending. Please wait a few more seconds.");
      }
    } catch (e) {
      alert("Error verifying payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleTvConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tvMac || !purchasedVoucher) return;
    setLoading(true);
    try {
        const res = await fetch('/api/auth/connect-tv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tvMac, voucherCode: purchasedVoucher, siteId }),
        });
        const data = await res.json();
        if (res.ok) {
            alert("📺 TV Connected! Please check your TV now.");
            setShowTvConnect(false);
        } else alert(`❌ ${data.error}`);
    } catch (e) { alert("Connection error."); }
    finally { setLoading(false); }
  };

  const handleReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchasedVoucher || !referPhone) return;
    setLoading(true);
    try {
        const res = await fetch('/api/refer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrerVoucher: purchasedVoucher, referredPhone: referPhone }),
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ Success! 30 Minutes added to your voucher.");
            setShowRefer(false);
        } else alert(`❌ ${data.error}`);
    } catch (e) { alert("Connection error."); }
    finally { setLoading(false); }
  };

  const handleFreeTrial = async () => {
    if (loading) return;
    setLoading(true); setStatus(null);
    try {
      const res = await fetch('/api/pay/free-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, ip, siteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ success: true, message: "Free trial activated! Enjoy 10 mins." });
        setTimeout(() => loginRouter(data.voucherCode), 2000);
      } else {
        throw new Error(data.error || "Trial failed");
      }
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!rebindValue) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/auth/status?id=${rebindValue}&siteId=${siteId}`);
      const data = await res.json();
      if (data.active) {
        setStatusInfo(data);
      } else {
        setStatusInfo(null);
        alert("No active session found for this code/phone.");
      }
    } catch (e) {
      alert("Error checking status.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRebind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mac) {
      setStatus({ success: false, message: "❌ System cannot identify your device. Please turn your Wi-Fi OFF and ON again to continue." });
      return;
    }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch('/api/auth/rebind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherCode: rebindValue.length > 10 ? undefined : rebindValue,
          phoneNumber: rebindValue.length > 10 ? rebindValue : undefined,
          mac, ip, siteId
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ success: true, message: "Welcome back! Reconnecting..." });
        setTimeout(() => loginRouter(data.voucherCode), 2000);
      } else {
        throw new Error(data.error || "Could not find active session");
      }
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", backgroundColor: "#0a0c10", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ backgroundColor: "#0a0c10", padding: "32px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", minHeight: "100vh", boxShadow: "0 0 40px rgba(0,0,0,0.5)", position: "relative", color: "white" }}>

        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "60px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ backgroundColor: "#064e3b", padding: "24px", borderRadius: "50%", marginBottom: "24px" }}><CheckCircle2 style={{ color: "#10b981", width: "80px", height: "80px" }} /></div>
            <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#ffffff", marginBottom: "16px" }}>Payment Received!</h1>
            <p style={{ color: "#94a3b8", fontSize: "18px", marginBottom: "32px" }}>Your internet is being activated...</p>
            <div style={{ backgroundColor: "#11141b", padding: "20px", borderRadius: "16px", width: "100%", marginBottom: "20px", border: "1px solid #1f2937" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: "800", textTransform: "uppercase" }}>Your Voucher Code</p>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "#ffffff" }}>{purchasedVoucher}</div>
            </div>

            <div style={{ width: "100%", marginBottom: "20px" }}>
                {!showTvConnect ? (
                    <button onClick={() => setShowTvConnect(true)} style={{ width: "100%", backgroundColor: "#000", color: "#fff", padding: "14px", borderRadius: "12px", border: "none", fontWeight: "800", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        📺 Connect a Smart TV
                    </button>
                ) : (
                    <form onSubmit={handleTvConnect} style={{ backgroundColor: "#f9fafb", padding: "16px", borderRadius: "16px", border: "1px solid #e5e7eb" }}>
                        <p style={{ fontSize: "11px", color: "#4b5563", fontWeight: "700", marginBottom: "12px" }}>Enter your TV's MAC Address (found in TV Network Settings):</p>
                        <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={tvMac} onChange={e => setTvMac(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "12px" }} required />
                        <button type="submit" style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "12px", borderRadius: "10px", border: "none", fontWeight: "800", fontSize: "13px" }}>Get TV Online</button>
                        <button type="button" onClick={() => setShowTvConnect(false)} style={{ width: "100%", background: "none", border: "none", color: "#6b7280", marginTop: "8px", fontSize: "11px", fontWeight: "700" }}>Cancel</button>
                    </form>
                )}
            </div>

            <div style={{ width: "100%", marginBottom: "40px" }}>
                {!showRefer ? (
                    <button onClick={() => setShowRefer(true)} style={{ width: "100%", backgroundColor: "#11141b", color: "#4f46e5", padding: "14px", borderRadius: "12px", border: "1px solid #1f2937", fontWeight: "800", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} className="hover-scale">
                        🎁 Refer a friend & get 30 mins FREE
                    </button>
                ) : (
                    <form onSubmit={handleReferral} style={{ backgroundColor: "#11141b", padding: "16px", borderRadius: "16px", border: "1px solid #1f2937" }}>
                        <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", marginBottom: "12px" }}>Enter friend's phone number to get 30 mins added instantly!</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input type="tel" placeholder="07XXXXXXXX" value={referPhone} onChange={e => setReferPhone(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #1f2937", fontSize: "13px", backgroundColor: "#0a0c10", color: "white" }} required />
                            <button type="submit" style={{ backgroundColor: "#4f46e5", color: "white", padding: "12px 20px", borderRadius: "8px", border: "none", fontWeight: "800", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} className="hover-scale">Get Gift</button>
                        </div>
                    </form>
                )}
            </div>
            <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid #1f2937", borderTop: "3px solid #10b981" }}></div>
          </div>
        ) : (
          <>
            <h1 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "900", color: "#ffffff", fontSize: "38px" }}>Starlinknet.<span style={{ color: "#4f46e5" }}>WIFI</span></h1>

            {!mac && !isWaitingForPin && !status?.success && (
                <div style={{ backgroundColor: "#78350f", border: "1px solid #92400e", padding: "16px", borderRadius: "12px", marginBottom: "24px", textAlign: "center" }}>
                    <ShieldAlert style={{ color: "#fbbf24", width: "24px", height: "24px", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: "12px", color: "#fef3c7", fontWeight: "700" }}>Device ID missing. Please turn your Wi-Fi OFF and ON again.</p>
                </div>
            )}

            {systemBanner && (
              <div style={{ backgroundColor: systemBanner.type === 'maintenance' ? '#450a0a' : '#1e1b4b', border: '1px solid #312e81', padding: '12px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap style={{ width: '16px', color: '#6366f1' }} />
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#818cf8', margin: 0 }}>{systemBanner.text}</p>
              </div>
            )}

            {tunnelBlocked ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <ShieldAlert style={{ color: "#f59e0b", width: "64px", height: "64px", margin: "0 auto 20px" }} />
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#ffffff" }}>Connection Locked</h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "12px" }}>To see the plans, we need to unlock the secure connection.</p>
                <button
                  onClick={() => {
                    window.open('/api/admin/offers', '_blank');
                    setTunnelBlocked(false);
                    setTimeout(() => window.location.reload(), 1000);
                  }}
                  style={{ display: "block", width: "100%", marginTop: "24px", backgroundColor: "#4f46e5", color: "white", padding: "18px", borderRadius: "12px", textDecoration: "none", fontWeight: "800", border: "none", cursor: "pointer" }}
                >
                  Unlock Plans Now
                </button>
                <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "16px" }}>After clicking, a new tab will open. Close it and return here.</p>
              </div>
            ) : isWaitingForPin ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div className="spinner"></div>
                <h3 style={{ marginTop: "24px", fontWeight: "800", color: "#ffffff" }}>Check Your Phone</h3>
                <p style={{ color: "#94a3b8" }}>Enter M-Pesa PIN on your phone</p>
                <div style={{ backgroundColor: "#11141b", padding: "20px", borderRadius: "16px", margin: "24px 0", border: "1px solid #1f2937" }}>
                  <div style={{ fontSize: "42px", fontWeight: "900", color: "#4f46e5" }}>00:{countdown.toString().padStart(2, '0')}</div>
                </div>
                <button onClick={handleManualCheck} style={{ width: "100%", backgroundColor: "#1f2937", color: "white", padding: "18px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", marginBottom: "12px", transition: "all 0.2s" }} className="hover-scale">I already entered my PIN</button>
                <button
                  onClick={() => {
                    localStorage.removeItem('active_checkout_ref');
                    localStorage.removeItem('active_checkout_time');
                    setIsWaitingForPin(false);
                    setActiveReference(null);
                    window.location.href = window.location.pathname;
                  }}
                  style={{ width: "100%", backgroundColor: "transparent", color: "#94a3b8", padding: "14px", borderRadius: "12px", fontWeight: "700", cursor: "pointer", border: "1px solid #1f2937", transition: "all 0.2s" }}
                  className="hover-scale"
                >
                  Cancel & Start Over
                </button>
              </div>
            ) : (
              <>
                <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "14px", marginBottom: "32px" }}>Choose a plan and connect instantly</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "12px" }}>
                  {fetching ? (
                    <div style={{ textAlign: "center" }}><div className="spinner" style={{ width: "24px", height: "24px", margin: "0 auto" }}></div></div>
                  ) : bundlePlans.filter(p => p.id !== 'offer_tv' && !p.name.toLowerCase().includes('tv')).map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", borderRadius: "14px", border: selectedPlan?.id === plan.id ? "2px solid #4f46e5" : "1px solid #1f2937", cursor: "pointer", backgroundColor: selectedPlan?.id === plan.id ? "#11141b" : "#0f172a" }}>
                      <div>
                        <div style={{ fontWeight: "800", color: "#ffffff" }}>{plan.name}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>{plan.duration} | High-speed</div>
                      </div>
                      <div style={{ fontWeight: "900", color: "#ffffff" }}>{plan.price} KES</div>
                    </div>
                  ))}
                </div>

                {!fetching && bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv')) && (
                    <div
                      onClick={() => {
                        const tvPlan = bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv'));
                        if (tvPlan) setSelectedPlan(tvPlan);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "18px",
                        borderRadius: "14px",
                        border: selectedPlan?.id === bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv'))?.id ? "2px solid #4f46e5" : "1px solid #1f2937",
                        cursor: "pointer",
                        backgroundColor: selectedPlan?.id === bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv'))?.id ? "#11141b" : "#0f172a",
                        marginBottom: "32px",
                        position: "relative",
                        overflow: "hidden"
                      }}
                    >
                        <div style={{ position: "absolute", top: "8px", right: "-38px", backgroundColor: "#ef4444", color: "white", padding: "2px 45px", fontSize: "8px", fontWeight: "950", transform: "rotate(45deg)", letterSpacing: "1px", zIndex: 10 }}>HOT</div>

                        <div>
                            <div style={{ fontWeight: "800", color: "#ffffff" }}>{bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv'))?.name}</div>
                            <div style={{ fontSize: "12px", color: "#94a3b8" }}>{bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv'))?.duration} | 4K Streaming</div>
                        </div>
                        <div style={{ fontWeight: "900", color: "#ffffff", paddingRight: "15px" }}>{bundlePlans.find(p => p.id === 'offer_tv' || p.name.toLowerCase().includes('tv'))?.price} KES</div>
                    </div>
                )}

                <form onSubmit={handlePayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", marginLeft: "4px" }}>Email for Receipt (Optional)</label>
                    <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #1f2937", backgroundColor: "#0a0c10", color: "white" }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", marginLeft: "4px" }}>M-Pesa Phone Number</label>
                    <input type="tel" required placeholder="07XXXXXXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #1f2937", backgroundColor: "#0a0c10", color: "white" }} />
                  </div>

                  <button type="submit" disabled={loading} style={{ width: "100%", backgroundColor: loading ? "#1f2937" : "#4f46e5", color: "#ffffff", padding: "20px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", marginTop: "10px", transition: "all 0.2s" }} className="hover-scale">
                    {loading ? "Initializing..." : `Pay KES ${selectedPlan?.price || ''}`}
                  </button>
                </form>

                <div style={{ marginTop: "24px", textAlign: "center" }}>
                    {!showRebind ? (
                        <button onClick={() => setShowRebind(true)} style={{ background: "none", border: "none", color: "#4f46e5", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Already paid? Reconnect or Check Balance</button>
                    ) : (
                        <div style={{ borderTop: "1px solid #1f2937", paddingTop: "20px" }}>
                            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                                <input type="text" placeholder="Code or Phone" value={rebindValue} onChange={e => setRebindValue(e.target.value)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #1f2937", fontSize: "14px", backgroundColor: "#0a0c10", color: "white" }} />
                                <button onClick={handleCheckStatus} disabled={checkingStatus} style={{ backgroundColor: "#1f2937", color: "white", padding: "12px 20px", borderRadius: "10px", border: "none", fontWeight: "700", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} className="hover-scale">
                                    {checkingStatus ? "..." : "Balance"}
                                </button>
                            </div>

                            {statusInfo && (
                                <div style={{ backgroundColor: "#11141b", padding: "12px", borderRadius: "12px", marginBottom: "16px", textAlign: "left", border: "1px solid #1f2937" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#6366f1", textTransform: "uppercase" }}>Plan</span>
                                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#ffffff" }}>{statusInfo.packageName}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#6366f1", textTransform: "uppercase" }}>Remaining</span>
                                        <span style={{ fontSize: "14px", fontWeight: "900", color: "#4f46e5" }}>{statusInfo.remaining}</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={(e: any) => handleRebind(e)}
                                disabled={loading}
                                style={{ width: "100%", backgroundColor: "#4f46e5", color: "white", padding: "16px", borderRadius: "10px", border: "none", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", cursor: "pointer", transition: "all 0.2s" }}
                                className="hover-scale"
                            >
                                {loading ? "Reconnecting..." : "Reconnect This Device"}
                            </button>

                            <button onClick={() => { setShowRebind(false); setStatusInfo(null); }} style={{ marginTop: "12px", background: "none", border: "none", color: "#6b7280", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
                        </div>
                    )}
                </div>
              </>
            )}
          </>
        )}

        {status && (
          <div style={{ marginTop: "24px", padding: "14px", borderRadius: "10px", textAlign: "center", fontSize: "14px", fontWeight: "600", backgroundColor: status.success ? "#064e3b" : "#450a0a", color: status.success ? "#10b981" : "#f87171", border: "1px solid currentcolor" }}>
            {status.message}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginTop: "40px" }}>
          {!isSuccess && !isWaitingForPin && (
            <div style={{ marginBottom: "24px" }}>
              <button
                onClick={handleFreeTrial}
                style={{ width: "100%", backgroundColor: "#11141b", color: "#94a3b8", padding: "16px", borderRadius: "12px", border: "1px dashed #1f2937", fontWeight: "700", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }}
                className="hover-scale"
              >
                🎁 Try 10 Minutes for Free
              </button>
            </div>
          )}
          <div style={{ height: "1px", backgroundColor: "#1f2937", margin: "0 -32px" }} />
          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>Need help with your connection?</p>
            <a href="tel:0769345599" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", backgroundColor: "#2563eb", color: "#ffffff", padding: "18px", borderRadius: "12px", textDecoration: "none", fontWeight: "800", transition: "all 0.2s" }} className="hover-scale">📞 Contact Customer Care</a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .spinner { width: 48px; height: 48px; border: 4px solid #f3f4f6; border-top: 4px solid #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .hover-scale { transition: transform 0.2s, opacity 0.2s; }
        .hover-scale:hover { transform: translateY(-1px); opacity: 0.9; }
        .hover-scale:active { transform: scale(0.98); opacity: 0.8; }
        button:disabled { cursor: not-allowed; opacity: 0.6 !important; transform: none !important; }
      `}</style>
    </div>
  );
}
