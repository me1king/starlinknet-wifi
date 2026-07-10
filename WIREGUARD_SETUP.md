# WireGuard Setup Summary

This tunnel replaces Tailscale and allows your server to talk to the MikroTik router 24/7.

## IPs
- **VPS (Server)**: `10.0.0.1`
- **MikroTik (Router)**: `10.0.0.2`

## Status
- [x] VPS Public Key generated
- [x] MikroTik Public Key generated
- [x] Local environment updated to `10.0.0.2`
- [x] Production environment updated to `10.0.0.2`

## Final Step
Ensure the VPS configuration is active by running:
```bash
sudo wg-quick up wg0
```
Then verify connection:
```bash
ping 10.0.0.2
```
