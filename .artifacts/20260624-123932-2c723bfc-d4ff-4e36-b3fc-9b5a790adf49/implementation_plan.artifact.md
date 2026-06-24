# Fix Payment Processing Issue

The system is receiving payments but failing to provision vouchers, leading to a "Payment Pending" loop.

## Proposed Changes

### Configuration
Update the `.env.local` to ensure the Paystack webhook URL is correct and pointing to the proper endpoint.

### Webhook Handling
Fix `app/api/webhooks/paystack-secure-9942/route.ts` to ensure it correctly identifies the successful payment and provisions the voucher on the MikroTik router.

#### [route.ts](file:///C:/Users/hp/Desktop/fulifi/fulifi/app/api/webhooks/paystack-secure-9942/route.ts)
- Add more logging to debug the webhook payload.
- Verify the `secret` key handling (ensuring it matches Paystack settings).
- Ensure `createMikrotikVoucher` is called with correct parameters.

### Frontend Polling
Ensure the polling logic in `app/page.tsx` correctly handles the response from `/api/pay/verify`.

## Verification Plan

### Manual Verification
1. Check **ngrok** logs while performing a test payment to see if the webhook is received.
2. Manually trigger the webhook using `curl` with a mock payload (if possible without a valid signature for testing logic).
3. Check the **MikroTik logs** to see if a voucher is created after a successful payment simulation.
4. Check the **Prisma database** (via `npx prisma studio`) to see if the `payment` status changes to `active`.
