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
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ backgroundColor: "#ffffff", padding: "32px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", minHeight: "100vh", boxShadow: "0 0 40px rgba(0,0,0,0.03)", position: "relative" }}>

        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "60px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ backgroundColor: "#ecfdf5", padding: "24px", borderRadius: "50%", marginBottom: "24px" }}><CheckCircle2 style={{ color: "#10b981", width: "80px", height: "80px" }} /></div>
            <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#111827", marginBottom: "16px" }}>Payment Received!</h1>
            <p style={{ color: "#4b5563", fontSize: "18px", marginBottom: "32px" }}>Your internet is being activated...</p>
            <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "16px", width: "100%", marginBottom: "20px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: "800", textTransform: "uppercase" }}>Your Voucher Code</p>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "#111827" }}>{purchasedVoucher}</div>
            </div>

            <div style={{ width: "100%", marginBottom: "40px" }}>
                {!showRefer ? (
                    <button onClick={() => setShowRefer(true)} style={{ width: "100%", backgroundColor: "#f5f3ff", color: "#4f46e5", padding: "14px", borderRadius: "12px", border: "1px solid #ddd6fe", fontWeight: "800", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} className="hover-scale">
                        🎁 Refer a friend & get 30 mins FREE
                    </button>
                ) : (
                    <form onSubmit={handleReferral} style={{ backgroundColor: "#f9fafb", padding: "16px", borderRadius: "16px", border: "1px solid #e5e7eb" }}>
                        <p style={{ fontSize: "11px", color: "#4b5563", fontWeight: "700", marginBottom: "12px" }}>Enter friend's phone number to get 30 mins added instantly!</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input type="tel" placeholder="07XXXXXXXX" value={referPhone} onChange={e => setReferPhone(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px" }} required />
                            <button type="submit" style={{ backgroundColor: "#4f46e5", color: "white", padding: "12px 20px", borderRadius: "8px", border: "none", fontWeight: "800", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} className="hover-scale">Get Gift</button>
                        </div>
                    </form>
                )}
            </div>
            <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid #f3f4f6", borderTop: "3px solid #10b981" }}></div>
          </div>
        ) : (
          <>
            <h1 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "900", color: "#111827", fontSize: "38px" }}>Starlinknet.<span style={{ color: "#4f46e5" }}>WIFI</span></h1>

            {!mac && !isWaitingForPin && !status?.success && (
                <div style={{ backgroundColor: "#fff7ed", border: "1px solid #ffedd5", padding: "16px", borderRadius: "12px", marginBottom: "24px", textAlign: "center" }}>
                    <ShieldAlert style={{ color: "#f97316", width: "24px", height: "24px", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: "12px", color: "#9a3412", fontWeight: "700" }}>Device ID missing. Please turn your Wi-Fi OFF and ON again.</p>
                </div>
            )}

            {systemBanner && (
              <div style={{ backgroundColor: systemBanner.type === 'maintenance' ? '#fef2f2' : '#f5f3ff', border: '1px solid #ddd6fe', padding: '12px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap style={{ width: '16px', color: '#6366f1' }} />
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#4338ca', margin: 0 }}>{systemBanner.text}</p>
              </div>
            )}

            {tunnelBlocked ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <ShieldAlert style={{ color: "#f59e0b", width: "64px", height: "64px", margin: "0 auto 20px" }} />
                <h3 style={{ fontSize: "20px" }}>Connection Interrupted</h3>
                <a href="/api/admin/offers" target="_blank" style={{ display: "block", marginTop: "24px", backgroundColor: "#4f46e5", color: "white", padding: "16px", borderRadius: "12px", textDecoration: "none", fontWeight: "800" }}>Confirm Connection</a>
              </div>
            ) : isWaitingForPin ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div className="spinner"></div>
                <h3 style={{ marginTop: "24px", fontWeight: "800" }}>Check Your Phone</h3>
                <p style={{ color: "#6b7280" }}>Enter M-Pesa PIN on your phone</p>
                <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "16px", margin: "24px 0" }}>
                  <div style={{ fontSize: "42px", fontWeight: "900", color: "#4f46e5" }}>00:{countdown.toString().padStart(2, '0')}</div>
                </div>
                <button onClick={handleManualCheck} style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "18px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", marginBottom: "12px", transition: "all 0.2s" }} className="hover-scale">I already entered my PIN</button>
                <button
                  onClick={() => {
                    localStorage.removeItem('active_checkout_ref');
                    localStorage.removeItem('active_checkout_time');
                    setIsWaitingForPin(false);
                    setActiveReference(null);
                    window.location.href = window.location.pathname; // Clear URL params too
                  }}
                  style={{ width: "100%", backgroundColor: "transparent", color: "#6b7280", padding: "14px", borderRadius: "12px", fontWeight: "700", cursor: "pointer", border: "1px solid #e5e7eb", transition: "all 0.2s" }}
                  className="hover-scale"
                >
                  Cancel & Start Over
                </button>
              </div>
            ) : (
              <>
                <p style={{ textAlign: "center", color: "#6b7280", fontSize: "14px", marginBottom: "32px" }}>Choose a plan and connect instantly</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                  {fetching ? (
                    <div style={{ textAlign: "center" }}><div className="spinner" style={{ width: "24px", height: "24px", margin: "0 auto" }}></div></div>
                  ) : bundlePlans.map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", borderRadius: "14px", border: selectedPlan?.id === plan.id ? "2px solid #4f46e5" : "1px solid #f3f4f6", cursor: "pointer", backgroundColor: selectedPlan?.id === plan.id ? "#f5f3ff" : "#fff" }}>
                      <div>
                        <div style={{ fontWeight: "800", color: "#1f2937" }}>{plan.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>{plan.duration} | High-speed</div>
                      </div>
                      <div style={{ fontWeight: "900", color: "#111827" }}>{plan.price} KES</div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handlePayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginLeft: "4px" }}>Email for Receipt (Optional)</label>
                    <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb" }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginLeft: "4px" }}>M-Pesa Phone Number</label>
                    <input type="tel" required placeholder="07XXXXXXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb" }} />
                  </div>

                  <button type="submit" disabled={loading} style={{ width: "100%", backgroundColor: loading ? "#9ca3af" : "#111827", color: "#ffffff", padding: "20px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", marginTop: "10px", transition: "all 0.2s" }} className="hover-scale">
                    {loading ? "Initializing..." : `Pay KES ${selectedPlan?.price || ''}`}
                  </button>
                </form>

                <div style={{ marginTop: "24px", textAlign: "center" }}>
                    {!showRebind ? (
                        <button onClick={() => setShowRebind(true)} style={{ background: "none", border: "none", color: "#4f46e5", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Already paid? Reconnect or Check Balance</button>
                    ) : (
                        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "20px" }}>
                            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                                <input type="text" placeholder="Code or Phone" value={rebindValue} onChange={e => setRebindValue(e.target.value)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px" }} />
                                <button onClick={handleCheckStatus} disabled={checkingStatus} style={{ backgroundColor: "#f3f4f6", color: "#111827", padding: "12px 20px", borderRadius: "10px", border: "none", fontWeight: "700", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }} className="hover-scale">
                                    {checkingStatus ? "..." : "Balance"}
                                </button>
                            </div>

                            {statusInfo && (
                                <div style={{ backgroundColor: "#f5f3ff", padding: "12px", borderRadius: "12px", marginBottom: "16px", textAlign: "left", border: "1px solid #ddd6fe" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#6366f1", textTransform: "uppercase" }}>Plan</span>
                                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#111827" }}>{statusInfo.packageName}</span>
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

                            <button onClick={() => { setShowRebind(false); setStatusInfo(null); }} style={{ marginTop: "12px", background: "none", border: "none", color: "#9ca3af", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
                        </div>
                    )}
                </div>
              </>
            )}
          </>
        )}

        {status && (
          <div style={{ marginTop: "24px", padding: "14px", borderRadius: "10px", textAlign: "center", fontSize: "14px", fontWeight: "600", backgroundColor: status.success ? "#ecfdf5" : "#fef2f2", color: status.success ? "#059669" : "#dc2626" }}>
            {status.message}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginTop: "40px" }}>
          {!isSuccess && !isWaitingForPin && (
            <div style={{ marginBottom: "24px" }}>
              <button
                onClick={handleFreeTrial}
                style={{ width: "100%", backgroundColor: "#f9fafb", color: "#6b7280", padding: "16px", borderRadius: "12px", border: "1px dashed #d1d5db", fontWeight: "700", fontSize: "14px", cursor: "pointer", transition: "all 0.2s" }}
                className="hover-scale"
              >
                🎁 Try 10 Minutes for Free
              </button>
            </div>
          )}
          <div style={{ height: "1px", backgroundColor: "#f3f4f6", margin: "0 -32px" }} />
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
