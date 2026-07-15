"use client";

import React, { useState, useEffect, useRef } from 'react';
import { XCircle, CheckCircle2, ShieldAlert, Zap, Wifi, Phone, Clock, Monitor } from 'lucide-react';

export default function PayPage() {
  // 1. STATE DECLARATIONS (Ordered for logic flow)
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

  // Free Trial States
  const [trialPhoneNumber, setTrialPhoneNumber] = useState("");
  const [showTrialPhoneInput, setShowTrialPhoneInput] = useState(false);

  // Router variables
  const [mac, setMac] = useState("");
  const [ip, setIp] = useState("");
  const [siteId, setSiteId] = useState("default-site");
  const [linkLogin, setLinkLogin] = useState("");
  const [linkOrig, setLinkOrig] = useState("");

  // Live Timer States
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [showTvConnect, setShowTvConnect] = useState(false);
  const [tvMac, setTvMac] = useState("");
  const [showRefer, setShowRefer] = useState(false);
  const [referPhone, setReferPhone] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 2. CORE LOGIC (Effects)
  useEffect(() => {
    // A. Capture Router Vars from URL
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

    // B. Check for redirect return (Active payment session from Paystack)
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      setActiveReference(reference);
      localStorage.setItem('active_checkout_ref', reference);
      setIsWaitingForPin(true);
      pollVerification(reference);
    }

    // C. Fetch Plans & Banner
    const initData = async () => {
      try {
        const [plansRes, settingsRes] = await Promise.all([
            fetch(`/api/admin/offers?siteId=${urlSiteId}`),
            fetch('/api/admin/settings').catch(() => null)
        ]);

        if (plansRes.ok) {
            const data = await plansRes.json();
            if (Array.isArray(data)) {
                setBundlePlans(data);
                if (data.length > 0) setSelectedPlan(data[0]);
            }
        }

        if (settingsRes && settingsRes.ok) {
            const data = await settingsRes.json();
            if (data?.bannerText) setSystemBanner({ text: data.bannerText, type: data.bannerType });
        }
      } catch (err) {
        console.error("Init fetch crash:", err);
      } finally {
        setFetching(false);
      }
    };
    initData();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Countdown timer for PIN screen
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isWaitingForPin && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isWaitingForPin, countdown]);

  // 3. HELPER FUNCTIONS
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

  const pollVerification = async (ref: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pay/verify?reference=${ref}`);
        const data = await res.json();
        if (data.success) {
          setPurchasedVoucher(data.voucherCode);
          setIsSuccess(true);
          setIsWaitingForPin(false);
          setLoading(false);
          localStorage.removeItem('active_checkout_ref');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setTimeout(() => setShowRefer(true), 3000);
          loginRouter(data.voucherCode);
        } else if (data.status === 'failed') {
          setStatus({ success: false, message: `❌ Payment failed: ${data.message || 'Cancelled'}` });
          setIsWaitingForPin(false);
          setLoading(false);
          localStorage.removeItem('active_checkout_ref');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (e) {}
    }, 3000);
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

      if (data.authorization_url) {
          window.location.href = data.authorization_url;
      } else {
          setActiveReference(data.reference);
          setIsWaitingForPin(true);
          setCountdown(60);
          pollVerification(data.reference);
      }
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
      setLoading(false);
    }
  };

  const handleFreeTrial = async () => {
    if (loading) return;
    if (!showTrialPhoneInput) {
        setShowTrialPhoneInput(true);
        return;
    }
    if (!trialPhoneNumber || trialPhoneNumber.length < 10) {
        setStatus({ success: false, message: "⚠️ Please enter your phone number to start trial." });
        return;
    }
    setLoading(true); setStatus(null);
    try {
        const res = await fetch('/api/pay/free-trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mac, ip, siteId, phoneNumber: trialPhoneNumber }),
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

  const handleRebind = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setStatus(null);
    try {
      const res = await fetch('/api/auth/rebind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            voucherCode: rebindValue.length < 10 ? rebindValue : undefined,
            phoneNumber: rebindValue.length >= 10 ? rebindValue : undefined,
            mac, ip, siteId
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ success: true, message: "Welcome back! Reconnecting..." });
        setTimeout(() => loginRouter(data.voucherCode), 2000);
      } else throw new Error(data.error || "No active session.");
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
    } finally { setLoading(false); }
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

  // 4. RENDERING
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
          <div style={{ textAlign: "center", padding: "60px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ backgroundColor: "#ecfdf5", padding: "24px", borderRadius: "50%", marginBottom: "24px" }}>
              <CheckCircle2 style={{ color: "#10b981", width: "80px", height: "80px" }} />
            </div>
            <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#111827", marginBottom: "16px" }}>Payment Received!</h1>
            <p style={{ color: "#4b5563", fontSize: "16px", marginBottom: "32px" }}>
              Your internet is being activated...
            </p>

            <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "16px", width: "100%", marginBottom: "40px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: "800", textTransform: "uppercase", marginBottom: "8px" }}>Auto-Login Code</p>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "#111827", letterSpacing: "2px" }}>{purchasedVoucher}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                {!showTvConnect ? (
                    <button onClick={() => setShowTvConnect(true)} style={{ width: "100%", backgroundColor: "#1e293b", color: "#fff", padding: "16px", borderRadius: "14px", border: "none", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>📺 Connect a Smart TV</button>
                ) : (
                    <form onSubmit={handleTvConnect} style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", width: "100%" }}>
                        <input type="text" placeholder="TV MAC Address" value={tvMac} onChange={e => setTvMac(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "10px", outline: "none" }} required />
                        <button type="submit" style={{ width: "100%", backgroundColor: "#334155", color: "white", padding: "12px", borderRadius: "10px", border: "none", fontWeight: "700" }}>Connect TV</button>
                    </form>
                )}
                {!showRefer ? (
                    <button onClick={() => setShowRefer(true)} style={{ width: "100%", backgroundColor: "#f5f3ff", color: "#6366f1", padding: "16px", borderRadius: "14px", border: "1px solid #e0e7ff", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>🎁 Gift 30 mins to a Friend</button>
                ) : (
                    <form onSubmit={handleReferral} style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", width: "100%" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input type="tel" placeholder="07XXXXXXXX" value={referPhone} onChange={e => setReferPhone(e.target.value)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px" }} required />
                            <button type="submit" style={{ backgroundColor: "#6366f1", color: "white", padding: "12px 20px", borderRadius: "10px", border: "none", fontWeight: "700" }}>Send</button>
                        </div>
                    </form>
                )}
            </div>
          </div>
        ) : (
          <>
            {systemBanner && (
              <div style={{ width: "100%", backgroundColor: systemBanner.type === 'maintenance' ? '#fff1f2' : '#f0f9ff', border: `1px solid ${systemBanner.type === 'maintenance' ? '#fecdd3' : '#bae6fd'}`, padding: "14px 20px", borderRadius: "14px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <Zap size={18} color={systemBanner.type === 'maintenance' ? '#e11d48' : '#0284c7'} />
                <p style={{ color: systemBanner.type === 'maintenance' ? '#9f1239' : '#0369a1', fontSize: "13px", fontWeight: "600", margin: 0 }}>{systemBanner.text}</p>
              </div>
            )}

            <h1 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "700", color: "#1e293b", fontSize: "38px", letterSpacing: "-1.5px" }}>
              STARLINKNET.<span style={{ color: "#6366f1" }}>WIFI</span>
            </h1>

            <div style={{ backgroundColor: "#f0fdf4", color: "#10b981", padding: "4px 12px", borderRadius: "100px", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", gap: "5px", margin: "0 auto 32px", width: "fit-content", border: "1px solid #dcfce7" }}>
              ● LINK ACTIVE
            </div>

            {activeTimer && (
              <div style={{ marginBottom: "32px", backgroundColor: "#111827", padding: "20px", borderRadius: "20px", width: "100%" }}>
                <p style={{ fontSize: "9px", color: "#9ca3af", fontWeight: "800", textTransform: "uppercase", margin: 0 }}>Remaining Time</p>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#10b981", marginTop: "2px" }}>{activeTimer}</div>
              </div>
            )}

            {isWaitingForPin ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <h3 style={{ color: "#111827", fontSize: "22px", fontWeight: "800" }}>Check Your Phone</h3>
                <p style={{ color: "#6b7280", fontSize: "15px", marginTop: "8px" }}>Enter M-Pesa PIN on your phone</p>
                <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "16px", margin: "24px 0", fontSize: "42px", fontWeight: "900", color: "#4f46e5" }}>
                  00:{countdown.toString().padStart(2, '0')}
                </div>
                <button onClick={() => pollVerification(activeReference!)} style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "16px", borderRadius: "12px", border: "none", fontWeight: "800", marginBottom: "16px" }}>I already entered my PIN</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                  {fetching ? <div style={{textAlign:"center"}}>Loading...</div> : bundlePlans.map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", borderRadius: "14px",
                      border: selectedPlan?.id === plan.id ? "3px solid #6366f1" : "1px solid #f1f5f9", cursor: "pointer", backgroundColor: "#fff"
                    }}>
                      <div>
                        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "18px" }}>{plan.name}</div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>{plan.duration} | High-speed</div>
                      </div>
                      <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "19px" }}>{plan.price} KES</div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handlePayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <input type="tel" required placeholder="M-Pesa Number (07...)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "16px", outline: "none" }} />

                  <button type="submit" disabled={loading} style={{ width: "100%", backgroundColor: loading ? "#9ca3af" : "#111827", color: "#ffffff", padding: "18px", borderRadius: "12px", border: "none", fontSize: "16px", fontWeight: "800" }}>
                    {loading ? "Please wait..." : `Pay KES ${selectedPlan?.price || ''}`}
                  </button>

                  {showTrialPhoneInput && (
                    <input type="tel" placeholder="Phone for 10-Min Trial" value={trialPhoneNumber} onChange={e => setTrialPhoneNumber(e.target.value)}
                        style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "2px solid #bbf7d0", fontSize: "16px", outline: "none", backgroundColor: "#f0fdf4" }} />
                  )}

                  <button type="button" onClick={handleFreeTrial} disabled={loading} style={{ width: "100%", backgroundColor: "#f0fdf4", color: "#16a34a", padding: "16px", borderRadius: "12px", border: "2px dashed #bbf7d0", fontSize: "15px", fontWeight: "700" }}>
                    {showTrialPhoneInput ? "🚀 Start 10 Minutes Now" : "🎁 Get 10 Minutes FREE Trial"}
                  </button>
                </form>

                <div style={{ marginTop: "24px", textAlign: "center" }}>
                    {!showRebind ? (
                        <button onClick={() => setShowRebind(true)} style={{ background: "none", border: "none", color: "#4f46e5", fontSize: "13px", fontWeight: "700" }}>Already paid? Reconnect</button>
                    ) : (
                        <form onSubmit={handleRebind} style={{ borderTop: "1px solid #f3f4f6", paddingTop: "20px", display: "flex", gap: "8px" }}>
                            <input type="text" placeholder="Code or Phone" value={rebindValue} onChange={e => setRebindValue(e.target.value)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb" }} />
                            <button type="submit" style={{ backgroundColor: "#4f46e5", color: "white", padding: "10px 20px", borderRadius: "10px", border: "none" }}>Go</button>
                        </form>
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

        <div style={{ marginTop: "40px", textAlign: "center" }}>
            <a href="tel:0769345599" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", backgroundColor: "#2563eb", color: "#ffffff", padding: "16px", borderRadius: "12px", textDecoration: "none", fontWeight: "800" }}>
                📞 Support: 0769345599
            </a>
        </div>
      </div>
    </div>
  );
}
