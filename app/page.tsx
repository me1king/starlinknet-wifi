"use client";

import React, { useState, useEffect, useRef } from 'react';
import { XCircle, CheckCircle2, ShieldAlert, Zap, Wifi, Phone, Clock, Monitor } from 'lucide-react';

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
  const [countdown, setCountdown] = useState(60);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [systemBanner, setSystemBanner] = useState<{ text: string, type: string } | null>(null);

  // High-Concurrency Optimization: Local Storage Caching
  useEffect(() => {
    const cachedPlans = localStorage.getItem('wifi_plans_cache');
    if (cachedPlans) {
      try {
        const data = JSON.parse(cachedPlans);
        setBundlePlans(data);
        if (data.length > 0) setSelectedPlan(data[0]);
        setFetching(false);
      } catch (e) {}
    }
  }, []);

  // New Live Timer & Success Features
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [showTvConnect, setShowTvConnect] = useState(false);
  const [tvMac, setTvMac] = useState("");
  const [showRefer, setShowRefer] = useState(false);
  const [referPhone, setReferPhone] = useState("");

  // Router variables
  const [mac, setMac] = useState("");
  const [ip, setIp] = useState("");
  const [siteId, setSiteId] = useState("default-site");
  const [linkLogin, setLinkLogin] = useState("");
  const [linkOrig, setLinkOrig] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Capture Router Vars
    const params = new URLSearchParams(window.location.search);
    const urlMac = params.get('mac') || localStorage.getItem('last_mac') || "";
    const urlIp = params.get('ip') || localStorage.getItem('last_ip') || "";
    const urlSiteId = params.get('siteId') || "default-site";

    setMac(urlMac);
    setIp(urlIp);
    setSiteId(urlSiteId);

    if (urlMac) {
        localStorage.setItem('last_mac', urlMac);
        checkActiveSession(urlMac, urlSiteId);

        // Handle Referral Link
        const referredBy = params.get('referredBy');
        if (referredBy) {
            fetch('/api/refer/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ referrerVoucher: referredBy, refereeMac: urlMac, siteId: urlSiteId }),
            }).catch(() => {});
        }
    }
    if (urlIp) localStorage.setItem('last_ip', urlIp);

    setLinkLogin(params.get('link-login') || params.get('link-login-only') || "");
    setLinkOrig(params.get('link-orig') || "");

    // 2. Check for redirect return (Active payment session from Paystack)
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      setActiveReference(reference);
      localStorage.setItem('active_checkout_ref', reference);
      if (urlMac) localStorage.setItem('last_mac', urlMac);
      setIsWaitingForPin(true);
      pollVerification(reference);
    }

    // 3. Fetch Plans
    const fetchPlans = async () => {
      try {
        const res = await fetch(`/api/admin/offers?siteId=${urlSiteId}`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        const text = await res.text();
        if (text.toLowerCase().includes('<!doctype html>') || text.toLowerCase().includes('<html')) {
          setTunnelBlocked(true);
          return;
        }

        const data = JSON.parse(text);
        if (res.ok && Array.isArray(data)) {
          setBundlePlans(data);
          localStorage.setItem('wifi_plans_cache', JSON.stringify(data)); // Cache for speed
          if (data.length > 0 && !selectedPlan) setSelectedPlan(data[0]);
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
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data && data.bannerText && data.bannerText.trim() !== "") {
          setSystemBanner({ text: data.bannerText, type: data.bannerType });
        }
      } catch (err) {}
    };
    fetchBanner();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const checkActiveSession = async (id: string, sId: string) => {
    try {
        const res = await fetch(`/api/auth/status?id=${id}&siteId=${sId}`);
        const data = await res.json();
        if (data.active) {
            setStatusInfo(data);
            setActiveTimer(data.remaining);
            startLiveTimer(id, sId);
        }
    } catch (e) {}
  };

  const startLiveTimer = (id: string, sId: string) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(async () => {
        try {
            const res = await fetch(`/api/auth/status?id=${id}&siteId=${sId}`);
            const data = await res.json();
            if (data.active) {
                setActiveTimer(data.remaining);
                setStatusInfo(data);
            } else {
                setActiveTimer(null);
                setStatusInfo(null);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            }
        } catch (e) {}
    }, 10000);
  };

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWaitingForPin && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isWaitingForPin, countdown]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !selectedPlan) return;
    setLoading(true); setStatus(null);

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber, email, packageId: selectedPlan.id, mac, ip, siteId }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error. Raw response:", text);
        throw new Error(text.slice(0, 100) || "Server error.");
      }

      if (!res.ok) throw new Error(data.error || "Payment failed");

      if (data.status === "success") {
        if (data.authorization_url) {
          if (data.reference) {
            localStorage.setItem('active_checkout_ref', data.reference);
            localStorage.setItem('last_mac', mac);
          }
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

  const pollVerification = async (ref: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const check = async () => {
      try {
        const res = await fetch(`/api/pay/verify?reference=${ref}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        const text = await res.text();
        if (text.toLowerCase().includes('<html')) return;

        const data = JSON.parse(text);
        if (data.success || data.redirectNeeded) {
          console.log("Payment Verified! Switching to Success Screen...");
          setPurchasedVoucher(data.voucherCode);
          setIsSuccess(true);
          setIsWaitingForPin(false);
          setLoading(false);
          localStorage.removeItem('active_checkout_ref');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

          // Force instant login
          loginRouter(data.voucherCode);

          // Show referral gift box immediately
          setShowRefer(true);
        } else if (data.status === 'failed') {
          setStatus({ success: false, message: `❌ Payment failed: ${data.message || 'Cancelled'}` });
          setIsWaitingForPin(false);
          setLoading(false); // Fix hang
          localStorage.removeItem('active_checkout_ref');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    pollIntervalRef.current = setInterval(check, 2000);
    check();
  };

  const handleFreeTrial = async () => {
    if (loading) return;
    if (!mac) {
        setStatus({ success: false, message: "⚠️ Device ID missing. Reconnect Wi-Fi to start trial." });
        return;
    }
    setLoading(true); setStatus(null);
    try {
        const res = await fetch('/api/pay/free-trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mac, ip, siteId }),
        });
        const data = await res.json();
        if (res.ok) {
            setPurchasedVoucher(data.voucherCode);
            setStatus({ success: true, message: "Free trial activated! Connecting..." });
            setTimeout(() => {
                setIsSuccess(true);
                loginRouter(data.voucherCode);
            }, 1500);
        } else {
            setStatus({ success: false, message: data.error || "Trial limit reached." });
        }
    } catch (e) {
        setStatus({ success: false, message: "Trial failed. Try later." });
    } finally { setLoading(false); }
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
        if (res.ok) {
            alert("📺 TV Connected Successfully!");
            setShowTvConnect(false);
        }
    } catch (e) {} finally { setLoading(false); }
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
        if (res.ok) {
            alert("✅ Gift Sent! Your friend will get 30 minutes free.");
            setShowRefer(false);
        }
    } catch (e) {} finally { setLoading(false); }
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

  const handleManualCheck = () => {
    if (activeReference) pollVerification(activeReference);
  };

  const handleRebind = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setTimeout(() => loginRouter(data.voucherCode), 15000);
      } else {
        throw new Error(data.error || "No active session.");
      }
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{
        backgroundColor: "#ffffff",
        padding: "32px",
        width: "100%",
        maxWidth: "480px",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        boxShadow: "0 0 40px rgba(0,0,0,0.03)",
        position: "relative"
      }}>
        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "40px 20px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ backgroundColor: "#10b981", color: "white", width: "100%", padding: "16px", borderRadius: "12px", marginBottom: "32px", fontWeight: "900", textTransform: "uppercase", fontSize: "18px" }}>
                ✅ Payment Confirmed!
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: "900", color: "#111827", marginBottom: "8px" }}>You are Online! 🚀</h1>
            <p style={{ color: "#4b5563", fontSize: "14px", marginBottom: "24px" }}>
              Your internet has been activated. If not connected, click below:
            </p>

            <button
                onClick={() => loginRouter(purchasedVoucher)}
                style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "18px", borderRadius: "14px", border: "none", fontWeight: "900", fontSize: "16px", marginBottom: "32px", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
                CONNECT TO INTERNET
            </button>

            <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "16px", width: "100%", marginBottom: "40px", border: "2px dashed #cbd5e1" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", fontWeight: "800", textTransform: "uppercase", marginBottom: "8px" }}>Your WiFi Access Code</p>
              <div style={{ fontSize: "36px", fontStyle: "normal", fontWeight: "900", color: "#111827", letterSpacing: "4px" }}>{purchasedVoucher}</div>
            </div>

            {/* LIVE COUNTDOWN TIMER */}
            {activeTimer && (
              <div style={{ marginBottom: "32px", backgroundColor: "#111827", padding: "24px", borderRadius: "24px", width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
                    <Clock size={14} color="#10b981" />
                    <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>Session Active</p>
                </div>
                <div style={{ fontSize: "36px", fontWeight: "900", color: "#10b981", textAlign: "center" }}>{activeTimer}</div>
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
                    <p style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600", margin: 0 }}>Plan: {statusInfo?.packageName}</p>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
                {!showTvConnect ? (
                    <button onClick={() => setShowTvConnect(true)} style={{ width: "100%", backgroundColor: "#1e293b", color: "#fff", padding: "16px", borderRadius: "14px", border: "none", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>📺 Connect a Smart TV</button>
                ) : (
                    <form onSubmit={handleTvConnect} style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", width: "100%" }}>
                        <input type="text" placeholder="TV MAC Address" value={tvMac} onChange={e => setTvMac(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "10px", outline: "none" }} required />
                        <button type="submit" style={{ width: "100%", backgroundColor: "#334155", color: "white", padding: "12px", borderRadius: "10px", border: "none", fontWeight: "700" }}>Connect TV</button>
                    </form>
                )}

                {/* AUTOMATED REFERRAL BOX */}
                <div style={{ width: "100%" }}>
                    <div style={{ textAlign: "left", marginBottom: "12px", padding: "0 8px" }}>
                        <p style={{ fontSize: "14px", fontWeight: "800", color: "#6366f1", margin: 0 }}>🎁 SURPRISE GIFT!</p>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Gift 30 mins to a friend for FREE</p>
                    </div>
                    <form onSubmit={handleReferral} style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "20px", border: "2px solid #e0e7ff", width: "100%" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input type="tel" placeholder="Friend's Phone" value={referPhone} onChange={e => setReferPhone(e.target.value)} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" }} required />
                            <button type="submit" style={{ backgroundColor: "#6366f1", color: "white", padding: "12px 20px", borderRadius: "12px", border: "none", fontWeight: "700" }}>SEND</button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid #f3f4f6", borderTop: "3px solid #10b981", marginTop: "32px" }}></div>
          </div>
        ) : (
          <>
            {/* SYSTEM COMMUNICATION BANNER */}
            {systemBanner && (
              <div style={{
                width: "100%",
                backgroundColor: systemBanner.type === 'maintenance' ? '#fff1f2' : '#f0f9ff',
                border: `1px solid ${systemBanner.type === 'maintenance' ? '#fecdd3' : '#bae6fd'}`,
                padding: "14px 20px",
                borderRadius: "14px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                animation: "pulse-subtle 2s infinite ease-in-out"
              }}>
                <Zap size={18} color={systemBanner.type === 'maintenance' ? '#e11d48' : '#0284c7'} />
                <p style={{
                  color: systemBanner.type === 'maintenance' ? '#9f1239' : '#0369a1',
                  fontSize: "13px",
                  fontWeight: "600",
                  margin: 0,
                  lineHeight: "1.4"
                }}>
                  {systemBanner.text}
                </p>
              </div>
            )}

            <h1 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "700", color: "#1e293b", fontSize: "38px", letterSpacing: "-1.5px" }}>
              STARLINKNET.<span style={{ color: "#6366f1" }}>WIFI</span>
            </h1>

            <div style={{
              backgroundColor: "#f0fdf4",
              color: "#10b981",
              padding: "4px 12px",
              borderRadius: "100px",
              fontSize: "10px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "1px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              marginBottom: "32px",
              border: "1px solid #dcfce7",
              width: "fit-content",
              margin: "0 auto 32px"
            }}>
              <span style={{ fontSize: "12px" }}>●</span> LINK ACTIVE
            </div>

            {/* LIVE COUNTDOWN TIMER (LANDING) */}
            {activeTimer && (
              <div style={{ marginBottom: "32px", backgroundColor: "#111827", padding: "20px", borderRadius: "20px", width: "100%", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <p style={{ fontSize: "9px", color: "#9ca3af", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>Remaining Time</p>
                        <div style={{ fontSize: "24px", fontWeight: "900", color: "#10b981", marginTop: "2px" }}>{activeTimer}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "9px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", margin: 0 }}>Active Plan</p>
                        <p style={{ fontSize: "12px", color: "#fff", fontWeight: "700", marginTop: "2px" }}>{statusInfo?.packageName}</p>
                    </div>
                </div>
              </div>
            )}

            {tunnelBlocked ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <ShieldAlert style={{ color: "#f59e0b", width: "64px", height: "64px", margin: "0 auto 20px" }} />
                <h3 style={{ color: "#111827", fontSize: "20px" }}>Connection Interrupted</h3>
                <a
                  href="/api/admin/offers"
                  target="_blank"
                  style={{ display: "block", marginTop: "24px", backgroundColor: "#4f46e5", color: "white", padding: "16px", borderRadius: "12px", textDecoration: "none", fontWeight: "800" }}
                >
                  Confirm Connection
                </a>
              </div>
            ) : isWaitingForPin ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div className="spinner"></div>
                <h3 style={{ marginTop: "24px", color: "#111827", fontSize: "22px", fontWeight: "800" }}>Check Your Phone</h3>
                <p style={{ color: "#6b7280", fontSize: "15px", marginTop: "8px" }}>Enter M-Pesa PIN on your phone</p>

                <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "16px", margin: "24px 0" }}>
                  <div style={{ fontSize: "42px", fontWeight: "900", color: "#4f46e5" }}>
                    00:{countdown.toString().padStart(2, '0')}
                  </div>
                </div>

                <button
                  onClick={handleManualCheck}
                  style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "16px", borderRadius: "12px", border: "none", fontWeight: "800", marginBottom: "16px", cursor: "pointer" }}
                >
                  I already entered my PIN
                </button>
                <button
                  onClick={() => {
                      setIsWaitingForPin(false);
                      setLoading(false);
                      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  }}
                  style={{ width: "100%", background: "none", border: "none", color: "#9ca3af", fontSize: "13px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}
                >
                  Start Again / Cancel
                </button>
              </div>
            ) : (
              <>
                {!mac && (
                    <div style={{
                        backgroundColor: "#fff7ed",
                        border: "1px solid #ffedd5",
                        padding: "12px",
                        borderRadius: "10px",
                        marginBottom: "24px",
                        textAlign: "center"
                    }}>
                        <p style={{ fontSize: "11px", color: "#9a3412", fontWeight: "700", margin: 0 }}>
                            ⚠️ Device not identified. Please toggle Wi-Fi if planning to buy.
                        </p>
                    </div>
                )}

                <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px", marginBottom: "32px", fontWeight: "600" }}>Choose a plan and connect instantly</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                  {fetching ? <div style={{textAlign:"center"}}><div className="spinner" style={{width:"24px", height:"24px"}}></div></div> : bundlePlans.map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", borderRadius: "14px",
                      border: selectedPlan?.id === plan.id ? "3px solid #6366f1" : "1px solid #f1f5f9",
                      cursor: "pointer", backgroundColor: "#fff",
                      transition: "all 0.2s ease",
                      boxShadow: selectedPlan?.id === plan.id ? "0 4px 12px rgba(99, 102, 241, 0.1)" : "none",
                      transform: selectedPlan?.id === plan.id ? "scale(1.01)" : "scale(1)"
                    }}>
                      <div>
                        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "18px", letterSpacing: "-0.3px" }}>{plan.name}</div>
                        <div style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "400", marginTop: "1px" }}>{plan.duration} | High-speed</div>
                      </div>
                      <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "19px" }}>{plan.price} KES</div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handlePayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#4b5563", marginBottom: "6px", textTransform: "uppercase" }}>Email (For Receipt)</label>
                    <input type="email" placeholder="e.g., customer@gmail.com" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "16px", outline: "none", backgroundColor: "#f9fafb" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#4b5563", marginBottom: "6px", textTransform: "uppercase" }}>M-Pesa Number</label>
                    <input type="tel" required placeholder="07XXXXXXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "16px", outline: "none", backgroundColor: "#f9fafb" }} />
                  </div>

                  <button type="submit" disabled={loading} className="glow-button" style={{
                    width: "100%", backgroundColor: loading ? "#9ca3af" : "#111827", color: "#ffffff", padding: "18px",
                    borderRadius: "12px", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", transition: "all 0.2s"
                  }}>
                    {loading ? "Initializing..." : `Pay KES ${selectedPlan?.price || ''}`}
                  </button>

                  <div style={{ position: "relative", textAlign: "center", margin: "10px 0" }}>
                    <div style={{ borderTop: "1px solid #e5e7eb", position: "absolute", top: "50%", width: "100%" }}></div>
                    <span style={{ backgroundColor: "#ffffff", padding: "0 10px", color: "#9ca3af", fontSize: "12px", fontWeight: "600", position: "relative" }}>OR</span>
                  </div>

                  <button type="button" onClick={handleFreeTrial} disabled={loading} style={{
                    width: "100%", backgroundColor: "#f0fdf4", color: "#16a34a", padding: "16px",
                    borderRadius: "12px", border: "2px dashed #bbf7d0", fontSize: "15px", fontWeight: "700", cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    {loading ? "Please wait..." : "🎁 Get 10 Minutes FREE Trial"}
                  </button>
                </form>

                <div style={{ marginTop: "24px", textAlign: "center" }}>
                    {!showRebind ? (
                        <button
                            onClick={() => setShowRebind(true)}
                            style={{ background: "none", border: "none", color: "#4f46e5", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                        >
                            Already paid? Reconnect device
                        </button>
                    ) : (
                        <form onSubmit={handleRebind} style={{ borderTop: "1px solid #f3f4f6", paddingTop: "20px" }}>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                    type="text"
                                    placeholder="Code or Phone"
                                    value={rebindValue}
                                    onChange={e => setRebindValue(e.target.value)}
                                    style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px" }}
                                />
                                <button
                                    type="submit"
                                    style={{ backgroundColor: "#4f46e5", color: "white", padding: "10px 20px", borderRadius: "10px", border: "none", fontWeight: "700" }}
                                >
                                    Go
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRebind(false)}
                                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "11px", marginTop: "10px" }}
                            >
                                Cancel
                            </button>
                        </form>
                    )}
                </div>
              </>
            )}
          </>
        )}

        {status && (
          <div style={{
            marginTop: "24px", padding: "14px", borderRadius: "10px", textAlign: "center", fontSize: "14px", fontWeight: "600",
            backgroundColor: status.success ? "#ecfdf5" : "#fef2f2",
            color: status.success ? "#059669" : "#dc2626",
            border: `1px solid ${status.success ? "#d1fae5" : "#fee2e2"}`
          }}>
            {status.message}
          </div>
        )}

        <div style={{ marginTop: "40px" }}>
            <div style={{ height: "1px", backgroundColor: "#f3f4f6", margin: "0 -32px" }} />
            <div style={{ marginTop: "32px", textAlign: "center" }}>
                <a href="tel:0769345599" className="glow-button" style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    backgroundColor: "#2563eb", color: "#ffffff", padding: "16px", borderRadius: "12px",
                    textDecoration: "none", fontWeight: "800", fontSize: "15px"
                }}>
                    📞 Contact Customer Care
                </a>
            </div>
        </div>
      </div>

      <style jsx>{`
        .spinner { width: 48px; height: 48px; border: 4px solid #f3f4f6; border-top: 4px solid #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .glow-button {
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .glow-button:hover {
          transform: translateY(-1px);
        }

        .glow-button:active {
          transform: scale(0.98);
        }

        @keyframes pulse-subtle {
          0% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.005); }
          100% { opacity: 0.9; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
