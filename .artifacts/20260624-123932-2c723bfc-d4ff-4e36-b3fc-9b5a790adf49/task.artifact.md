# Task List

- [/] Investigate the "Payment Pending" issue
	- [x] Check `.env.local` for correct webhook URLs
	- [ ] Check `app/api/callback/route.ts` for M-Pesa/Paystack logic
	- [ ] Check `app/api/portal/check-payment/route.ts` (or similar) to see how the frontend polls for status
	- [ ] Verify if the webhook is actually reaching the server (ngrok logs)
- [ ] Fix Callback Logic
	- [ ] Ensure the voucher is created on the router upon payment success
	- [ ] Ensure the database is updated to reflect the successful payment
- [ ] Verify Fix
	- [ ] Run a test payment flow
	- [ ] Confirm voucher appears on MikroTik and user is logged in
