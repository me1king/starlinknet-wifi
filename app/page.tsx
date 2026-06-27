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

    // Check if MAC is missing
    if (!urlMac && !params.get('reference')) {
        setStatus({
            success: false,
            message: "⚠️ System could not identify your device. Please DISCONNECT from Wi-Fi and RECONNECT to see the billing page properly."
        });
    }

    // 2. Local Storage Session Backup (Resiliency)
    const savedRef = localStorage.getItem('active_checkout_ref');
    const savedMac = localStorage.getItem('last_mac');

    if (savedRef && (!urlMac || savedMac === urlMac)) {
      setActiveReference(savedRef);
      setIsWaitingForPin(true);
      pollVerification(savedRef);
    }

    // 3. Check for Paystack redirect return
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      setActiveReference(reference);
      localStorage.setItem('active_checkout_ref', reference);
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

        const text = await res.text();
        if (text.toLowerCase().includes('<!doctype html>') || text.toLowerCase().includes('<html')) {
          setTunnelBlocked(true);
          return;
        }

        const data = JSON.parse(text);
        if (res.ok && Array.isArray(data)) {
          setBundlePlans(data);
          if (data.length > 0) setSelectedPlan(data[0]);
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
        const res = await fetch('/api/admin/settings', {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true'
          }
        });
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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !selectedPlan) return;
    setLoading(true); setStatus(null);

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: JSON.stringify({ phoneNumber, email, packageId: selectedPlan.id, mac, ip, siteId }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error. Raw response:", text);
        throw new Error(text.slice(0, 100) || "Server returned an empty response. Please check if M-Pesa environment variables are set.");
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
            'ngrok-skip-browser-warning': 'true',
            'Bypass-Tunnel-Reminder': 'true',
            'Accept': 'application/json'
          }
        });
        const text = await res.text();
        if (text.toLowerCase().includes('<html')) return; // Ignore tunnel garbage

        const data = JSON.parse(text);
        if (data.success) {
          setPurchasedVoucher(data.voucherCode);
          setIsSuccess(true);
          setIsWaitingForPin(false);
          localStorage.removeItem('active_checkout_ref');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

          // trigger auto-login
          setTimeout(() => loginRouter(data.voucherCode), 2000);
        } else if (data.status === 'failed') {
          setStatus({ success: false, message: `❌ Payment failed: ${data.message || 'Cancelled'}` });
          setIsWaitingForPin(false);
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
        throw new Error(data.error || "Could not find active session");
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
          <div style={{ textAlign: "center", padding: "60px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div style={{ backgroundColor: "#ecfdf5", padding: "24px", borderRadius: "50%", marginBottom: "24px" }}>
              <CheckCircle2 style={{ color: "#10b981", width: "80px", height: "80px" }} />
            </div>
            <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#111827", marginBottom: "16px", letterSpacing: "-1px" }}>Payment Received!</h1>
            <p style={{ color: "#4b5563", fontSize: "18px", marginBottom: "32px", lineHeight: "1.5" }}>
              Successfully purchased your plan. Your internet is being activated...
            </p>

            <div style={{ backgroundColor: "#f3f4f6", padding: "20px", borderRadius: "16px", width: "100%", marginBottom: "40px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: "800", textTransform: "uppercase", marginBottom: "8px" }}>Your Voucher Code</p>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "#111827", letterSpacing: "2px" }}>{purchasedVoucher}</div>
            </div>

            <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid #f3f4f6", borderTop: "3px solid #10b981" }}></div>
            <p style={{ marginTop: "16px", fontSize: "13px", color: "#9ca3af", fontWeight: "600" }}>Redirecting to internet...</p>
          </div>
        ) : (
          <>
            <h1 style={{ textAlign: "center", marginBottom: "8px", fontWeight: "900", color: "#111827", fontSize: "38px", letterSpacing: "-1.5px" }}>
              Starlinknet.<span style={{ color: "#4f46e5" }}>WIFI</span>
            </h1>

            {!mac && !isWaitingForPin && !status?.success && (
                <div style={{
                    backgroundColor: "#fff7ed",
                    border: "1px solid #ffedd5",
                    padding: "16px",
                    borderRadius: "12px",
                    marginBottom: "24px",
                    textAlign: "center"
                }}>
                    <ShieldAlert style={{ color: "#f97316", width: "24px", height: "24px", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: "12px", color: "#9a3412", fontWeight: "700", lineHeight: "1.4" }}>
                        Device ID missing. If you pay now, we won't know which phone to activate.
                        <br/>
                        <span style={{ textDecoration: "underline" }}>Please turn your Wi-Fi OFF and ON again.</span>
                    </p>
                </div>
            )}

            {systemBanner && (
              <div style={{
                backgroundColor: systemBanner.type === 'maintenance' ? '#fef2f2' : systemBanner.type === 'warning' ? '#fffbeb' : '#f5f3ff',
                border: `1px solid ${systemBanner.type === 'maintenance' ? '#fecaca' : systemBanner.type === 'warning' ? '#fde68a' : '#ddd6fe'}`,
                padding: '12px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Zap style={{ width: '16px', color: systemBanner.type === 'maintenance' ? '#ef4444' : systemBanner.type === 'warning' ? '#f59e0b' : '#6366f1' }} />
                <p style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: systemBanner.type === 'maintenance' ? '#991b1b' : systemBanner.type === 'warning' ? '#92400e' : '#4338ca',
                  margin: 0
                }}>
                  {systemBanner.text}
                </p>
              </div>
            )}

            {tunnelBlocked ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <ShieldAlert style={{ color: "#f59e0b", width: "64px", height: "64px", margin: "0 auto 20px" }} />
                <h3 style={{ color: "#111827", fontSize: "20px" }}>Connection Interrupted</h3>
                <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "12px", lineHeight: "1.6" }}>
                  Please click the button below to verify your connection to the billing server.
                </p>
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
                  <div style={{ fontSize: "12px", color: "#6366f1", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px" }}>Waiting for confirmation</div>
                  <div style={{ fontSize: "42px", fontWeight: "900", color: "#4f46e5", marginTop: "4px" }}>
                    00:{countdown.toString().padStart(2, '0')}
                  </div>
                </div>

                <button
                  onClick={handleManualCheck}
                  style={{ width: "100%", backgroundColor: "#111827", color: "white", padding: "16px", borderRadius: "12px", border: "none", fontWeight: "800", marginBottom: "16px", cursor: "pointer" }}
                >
                  I already entered my PIN
                </button>
              </div>
            ) : (
              <>
                <p style={{ textAlign: "center", color: "#6b7280", fontSize: "14px", marginBottom: "32px", fontWeight: "500" }}>Choose a plan and connect instantly</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                  {fetching ? <div style={{textAlign:"center"}}><div className="spinner" style={{width:"24px", height:"24px"}}></div></div> : bundlePlans.map((plan) => (
                    <div key={plan.id} onClick={() => setSelectedPlan(plan)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", borderRadius: "14px",
                      border: selectedPlan?.id === plan.id ? "2px solid #4f46e5" : "1px solid #f3f4f6",
                      cursor: "pointer", backgroundColor: selectedPlan?.id === plan.id ? "#f5f3ff" : "#fff",
                      transition: "all 0.2s"
                    }}>
                      <div>
                        <div style={{ fontWeight: "800", color: "#1f2937", fontSize: "16px" }}>{plan.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>{plan.duration} | High-speed</div>
                      </div>
                      <div style={{ fontWeight: "900", color: "#111827", fontSize: "18px" }}>{plan.price} KES</div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handlePayment} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#4b5563", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Email Address (For Receipt)</label>
                    <input type="email" placeholder="e.g., customer@gmail.com" value={email} onChange={e => setEmail(e.target.value)}
                      style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "16px", outline: "none", backgroundColor: "#f9fafb" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#4b5563", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Enter Number</label>
                    <input type="tel" required placeholder="07XXXXXXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "16px", outline: "none", backgroundColor: "#f9fafb" }} />
                  </div>

                  <button type="submit" disabled={loading} style={{
                    width: "100%", backgroundColor: loading ? "#9ca3af" : "#111827", color: "#ffffff", padding: "18px",
                    borderRadius: "12px", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", transition: "all 0.2s"
                  }}>
                    {loading ? "Initializing..." : `Pay KES ${selectedPlan?.price || ''}`}
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
            {status.success ? <CheckCircle2 style={{display:"inline", width:"16px", marginRight:"8px"}}/> : <XCircle style={{display:"inline", width:"16px", marginRight:"8px"}}/>}
            {status.message}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginTop: "40px" }}>
          <div style={{ height: "1px", backgroundColor: "#f3f4f6", margin: "0 -32px" }} />
          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px", fontWeight: "600" }}>
              Need help with your connection?
            </p>
            <a
              href="tel:0769345599"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "16px",
                borderRadius: "12px",
                textDecoration: "none",
                fontWeight: "800",
                fontSize: "15px",
                boxShadow: "0 4px 6px rgba(37, 99, 235, 0.15)",
                transition: "all 0.2s ease"
              }}
            >
              📞 Contact Customer Care
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .spinner { width: 48px; height: 48px; border: 4px solid #f3f4f6; border-top: 4px solid #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
