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

  const [trialPhoneNumber, setTrialPhoneNumber] = useState("");
  const [showTrialPhoneInput, setShowTrialPhoneInput] = useState(false);

  const [mac, setMac] = useState("");
  const [ip, setIp] = useState("");
  const [siteId, setSiteId] = useState("default-site");
  const [linkLogin, setLinkLogin] = useState("");
  const [linkOrig, setLinkOrig] = useState("");

  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [showTvConnect, setShowTvConnect] = useState(false);
  const [tvMac, setTvMac] = useState("");
  const [showRefer, setShowRefer] = useState(false);
  const [referPhone, setReferPhone] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
    }

    setLinkLogin(params.get('link-login') || params.get('link-login-only') || "");
    setLinkOrig(params.get('link-orig') || "");

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

  const checkActiveSession = async (id: string, sId: string) => {
    try {
        const res = await fetch(`/api/auth/status?id=${id}&siteId=${sId}`);
        const data = await res.json();
        if (data.active) {
            setStatusInfo(data);
            setActiveTimer(data.remaining);
        }
    } catch (e) {}
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
          loginRouter(data.voucherCode);
        } else if (data.status === 'failed') {
          setStatus({ success: false, message: `❌ Payment failed: ${data.message || 'Cancelled'}` });
          setIsWaitingForPin(false);
          setLoading(false);
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

      if (data.authorization_url) window.location.href = data.authorization_url;
      else {
          setActiveReference(data.reference);
          setIsWaitingForPin(true);
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
        } else setStatus({ success: false, message: data.error || "Trial limit reached." });
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
        body: JSON.stringify({ voucherCode: rebindValue, mac, ip, siteId }),
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

  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ backgroundColor: "#ffffff", padding: "32px", width: "100%", maxWidth: "480px", boxShadow: "0 0 40px rgba(0,0,0,0.03)" }}>

        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <CheckCircle2 style={{ color: "#10b981", width: "80px", height: "80px", margin: "0 auto 24px" }} />
            <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#111827" }}>Payment Received!</h1>
            <p style={{ color: "#4b5563", marginBottom: "32px" }}>Connecting you now...</p>
            <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "16px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: "800" }}>VOUCHER CODE</p>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "#111827" }}>{purchasedVoucher}</div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", gap: "8px", justifyContent: "center" }}>
                <div style={{ padding: "4px 10px", backgroundColor: "#f0fdf4", borderRadius: "6px", fontSize: "10px", fontWeight: "800", color: "#16a34a" }}>✅ ACTIVATED</div>
                <div style={{ padding: "4px 10px", backgroundColor: "#eff6ff", borderRadius: "6px", fontSize: "10px", fontWeight: "800", color: "#2563eb" }}>⚡ INSTANT</div>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "700", color: "#1e293b", fontSize: "38px" }}>
              STARLINKNET.<span style={{ color: "#6366f1" }}>WIFI</span>
            </h1>

            <div style={{ backgroundColor: "#f0fdf4", color: "#10b981", padding: "4px 12px", borderRadius: "100px", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", gap: "5px", margin: "0 auto 12px", width: "fit-content", border: "1px solid #dcfce7" }}>
              ● LINK ACTIVE
            </div>

            {/* USER INFO BAR */}
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "32px" }}>
                <div style={{ fontSize: "9px", fontWeight: "800", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Monitor size={10} /> {mac || 'Unknown Device'}
                </div>
                <div style={{ fontSize: "9px", fontWeight: "800", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                    <ShieldAlert size={10} /> SSL Encrypted
                </div>
            </div>

            {activeTimer && (
              <div style={{ marginBottom: "32px", backgroundColor: "#111827", padding: "20px", borderRadius: "20px", color: "#10b981", textAlign: "center" }}>
                <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "800", textTransform: "uppercase" }}>Time Remaining</p>
                <div style={{ fontSize: "28px", fontWeight: "900" }}>{activeTimer}</div>
              </div>
            )}

            {isWaitingForPin ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <h3 style={{ fontSize: "22px", fontWeight: "800" }}>Check Your Phone</h3>
                <p style={{ color: "#6b7280" }}>Enter M-Pesa PIN now</p>
                <div style={{ fontSize: "48px", fontWeight: "900", color: "#4f46e5", margin: "24px 0" }}>00:{countdown}</div>
                <button onClick={() => pollVerification(activeReference!)} style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "16px", borderRadius: "12px", border: "none", fontWeight: "800" }}>I have entered my PIN</button>
              </div>
            ) : (
              <>
                <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px", marginBottom: "24px", fontWeight: "600" }}>Choose a plan and connect instantly</p>

                {/* PLAN SELECTION GRID */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                  {fetching ? <div style={{textAlign:"center"}}>Loading plans...</div> : bundlePlans.map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", borderRadius: "16px",
                      border: selectedPlan?.id === plan.id ? "3px solid #6366f1" : "1px solid #f1f5f9",
                      cursor: "pointer", backgroundColor: "#fff", transition: "all 0.2s"
                    }}>
                      <div>
                        <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "18px" }}>{plan.name}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>{plan.duration || 'Unlimited'} | High Speed</div>
                      </div>
                      <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "20px" }}>{plan.price} KES</div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handlePayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", trackingSpacing: "0.05em" }}>Receipt Email (Gmail)</label>
                    <input type="email" placeholder="customer@gmail.com" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "16px", outline: "none", backgroundColor: "#f8fafc", transition: "border 0.2s" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "800", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", trackingSpacing: "0.05em" }}>M-Pesa Number</label>
                    <input type="tel" required placeholder="07XXXXXXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "16px", outline: "none", backgroundColor: "#f8fafc" }} />
                  </div>

                  <button type="submit" disabled={loading} style={{ width: "100%", backgroundColor: "#111827", color: "#ffffff", padding: "20px", borderRadius: "14px", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer", transition: "transform 0.1s" }}>
                    {loading ? "Processing..." : `Buy ${selectedPlan?.name || 'Plan'}`}
                  </button>

                  <div style={{ textAlign: "center", margin: "10px 0", color: "#94a3b8", fontSize: "12px", fontWeight: "600" }}>OR</div>

                  {showTrialPhoneInput && (
                    <input type="tel" placeholder="Phone for 10-Min Trial" value={trialPhoneNumber} onChange={e => setTrialPhoneNumber(e.target.value)}
                        style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #bbf7d0", fontSize: "16px", outline: "none", backgroundColor: "#f0fdf4" }} />
                  )}

                  <button type="button" onClick={handleFreeTrial} disabled={loading} style={{ width: "100%", backgroundColor: "#f0fdf4", color: "#16a34a", padding: "18px", borderRadius: "14px", border: "2px dashed #bbf7d0", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}>
                    {showTrialPhoneInput ? "🚀 Start 10 Minutes Free" : "🎁 Get 10 Minutes FREE Trial"}
                  </button>
                </form>

                <div style={{ marginTop: "32px", textAlign: "center" }}>
                    <button onClick={() => setShowRebind(true)} style={{ background: "none", border: "none", color: "#6366f1", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Already paid? Reconnect device</button>
                </div>
              </>
            )}
          </>
        )}

        {status && (
          <div style={{ marginTop: "24px", padding: "16px", borderRadius: "12px", textAlign: "center", fontSize: "14px", fontWeight: "700", backgroundColor: status.success ? "#ecfdf5" : "#fef2f2", color: status.success ? "#059669" : "#dc2626" }}>
            {status.message}
          </div>
        )}

        {/* TRUST BADGES */}
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "32px", opacity: 0.6 }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px" }}>🔒</div>
                <p style={{ fontSize: "8px", fontWeight: "900", color: "#64748b", marginTop: "4px" }}>SECURE PAYSTACK</p>
            </div>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px" }}>⚡</div>
                <p style={{ fontSize: "8px", fontWeight: "900", color: "#64748b", marginTop: "4px" }}>INSTANT START</p>
            </div>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "18px" }}>🛡️</div>
                <p style={{ fontSize: "8px", fontWeight: "900", color: "#64748b", marginTop: "4px" }}>FAIR USAGE</p>
            </div>
        </div>

        {/* SUPPORT & FAQ SECTION */}
        <div style={{ marginTop: "40px", borderTop: "1px solid #f1f5f9", paddingTop: "32px" }}>
            <h4 style={{ fontSize: "12px", fontWeight: "900", color: "#1e293b", marginBottom: "16px", textTransform: "uppercase" }}>Quick Support</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <a href="https://wa.me/254769345599" style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#25d366", color: "#fff", padding: "12px 20px", borderRadius: "12px", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>
                    <Phone size={16} /> WhatsApp Support
                </a>
                <a href="tel:0769345599" style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#111827", color: "#fff", padding: "12px 20px", borderRadius: "12px", textDecoration: "none", fontWeight: "700", fontSize: "14px" }}>
                    <Smartphone size={16} /> Call: 0769345599
                </a>
            </div>

            <div style={{ marginTop: "32px" }}>
                <h4 style={{ fontSize: "12px", fontWeight: "900", color: "#1e293b", marginBottom: "12px", textTransform: "uppercase" }}>Common Questions</h4>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.6" }}>
                    <p style={{ marginBottom: "8px" }}><strong>How long does it take?</strong> Activation is instant after PIN entry.</p>
                    <p style={{ marginBottom: "8px" }}><strong>I paid but I'm offline?</strong> Click 'Reconnect' below and enter your number.</p>
                </div>
            </div>

            <div style={{ marginTop: "32px", fontSize: "10px", color: "#cbd5e1", textAlign: "center" }}>
                <p>By connecting, you agree to our <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</p>
                <p style={{ marginTop: "8px" }}>© 2026 Starlinknet.WIFI • Powered by Cloud-M</p>
            </div>
        </div>
      </div>
    </div>
  );
}
