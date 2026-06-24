const fs = require('fs');
const path = require('path');

// Configuration - Edit these or use environment variables
const PORTAL_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://oil-cinnamon-starfish.ngrok-free.dev";
const OUTPUT_FILE = path.join(__dirname, '../public/mikrotik_login.html');

const template = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Starlinknet.WIFI - Redirecting</title>
    <meta http-equiv="refresh" content="0; url=${PORTAL_URL}?mac=$(mac)&ip=$(ip)&siteId=$(identity)&link-login=$(link-login-only)&link-orig=$(link-orig)">
    <meta http-equiv="pragma" content="no-cache">
    <meta http-equiv="expires" content="-1">
    <style>
        body {
            background: #0a0c10;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }
        .loader {
            border: 4px solid rgba(99, 102, 241, 0.1);
            border-top: 4px solid #6366f1;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .box { padding: 20px; }
        h2 { font-size: 20px; font-weight: 800; margin-bottom: 10px; }
        p { color: #9ca3af; font-size: 14px; }
        a { color: #6366f1; text-decoration: none; font-weight: 700; }
    </style>
</head>
<body>
    <div class="box">
        <h2>STARLINKNET.<span style="color:#6366f1">WIFI</span></h2>
        <div class="loader"></div>
        <p>Syncing your device with the billing gateway...</p>
        <p style="font-size: 12px; margin-top: 20px;">
            If you are not redirected, <a href="${PORTAL_URL}?mac=$(mac)&ip=$(ip)&siteId=$(identity)&link-login=$(link-login-only)&link-orig=$(link-orig)">click here</a>.
        </p>
    </div>
</body>
</html>`;

console.log(`[Generator] Creating MikroTik login.html with Portal URL: ${PORTAL_URL}`);
fs.writeFileSync(OUTPUT_FILE, template);
console.log(`[Generator] Done! File saved to: ${OUTPUT_FILE}`);
console.log(`[Generator] Instructions: Upload this file to your MikroTik 'hotspot' folder as 'login.html'`);
