/**
 * Generates MikroTik RouterOS commands to set up the Walled Garden.
 * Run this and copy-paste the output into the MikroTik Terminal.
 */

const PORTAL_DOMAIN = (process.env.NEXT_PUBLIC_BASE_URL || "oil-cinnamon-starfish.ngrok-free.dev")
    .replace('https://', '')
    .replace('http://', '')
    .split('/')[0];

const domains = [
    PORTAL_DOMAIN,
    "*.paystack.com",
    "*.paystack.co",
    "*.pstk.co",
    "*.green-api.com",
    "*.google.com",
    "*.gstatic.com",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "*.safaricom.co.ke", // M-Pesa icons/resources if any
    "*.ngrok-free.dev"  // If using ngrok
];

console.log("# === STARLINKNET.WIFI WALLED GARDEN SETUP ===");
console.log("# Copy and paste the following commands into your MikroTik Terminal:\n");

console.log("/ip hotspot walled-garden");
domains.forEach(domain => {
    console.log(`add dst-host=${domain} action=allow comment="Starlinknet.WIFI Dependency"`);
});

console.log("\n/ip hotspot walled-garden ip");
console.log(`add dst-host=${PORTAL_DOMAIN} action=accept comment="Starlinknet.WIFI Portal"`);

console.log("\n# Done! Your Walled Garden is now configured.");
