# Fix Database Connection Failure (Supabase IPv4 Compatibility)

The application is experiencing `PrismaClientInitializationError` because it's attempting to connect to the Supabase database via a host/port combination that is unreachable from the current network (Safaricom Kenya). Specifically, direct connections via `db.mkcwwrxwfhjpafiiqvzq.supabase.co:5432` fail because they are IPv6-only, and connections to the pooler on port `6543` are being timed out (likely blocked by the ISP).

Research has confirmed that the Supabase pooler host `aws-0-us-east-1.pooler.supabase.com` is reachable and accepting connections on port `5432`.

## Proposed Changes

### Environment Configuration

Update `.env` and `.env.local` to use the pooler host on port `5432` for both `DATABASE_URL` and `DIRECT_URL`. This ensures compatibility with IPv4 networks and bypasses port blocks.

#### [.env](file:///C:/Users/hp/AndroidStudioProjects/mynet/.env)
#### [.env.local](file:///C:/Users/hp/AndroidStudioProjects/mynet/.env.local)

- Change `DATABASE_URL` port from `6543` to `5432`.
- Change `DIRECT_URL` port from `6543` to `5432`.
- Ensure `pgbouncer=true` is removed when using port `5432` (Session Mode) to avoid potential connection issues if not strictly required, OR keep it if Transaction Mode is desired (though Transaction Mode usually requires 6543). *Correction: Supabase pooler on 5432 is Session Mode, which is safer for debugging connection issues.*

```diff
-DATABASE_URL="postgresql://postgres.mkcwwrxwfhjpafiiqvzq:CKkGLUUiRbPxICLq@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connect_timeout=10"
-DIRECT_URL="postgresql://postgres.mkcwwrxwfhjpafiiqvzq:CKkGLUUiRbPxICLq@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=10"
+DATABASE_URL="postgresql://postgres.mkcwwrxwfhjpafiiqvzq:CKkGLUUiRbPxICLq@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=10"
+DIRECT_URL="postgresql://postgres.mkcwwrxwfhjpafiiqvzq:CKkGLUUiRbPxICLq@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=10"
```

### Prisma Initialization

#### [prisma.ts](file:///C:/Users/hp/AndroidStudioProjects/mynet/lib/prisma.ts)

- Add more descriptive logging during initialization to help verify which URL is actually being used by the runtime.

```diff
     const dbUrl = process.env.DATABASE_URL || 'not-set';
     const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
-    console.log(`[Prisma] Initializing with URL: ${maskedUrl}`);
+    console.log(`[Prisma] Initializing with URL: ${maskedUrl} (Mode: ${process.env.NODE_ENV})`);
```

## Verification Plan

### Automated Tests
1.  Run `npx prisma db pull` to verify that Prisma can connect to the database and introspect the schema.
    - Command: `npx prisma db pull`
2.  Run the application in development mode and check the logs for successful initialization and successful completion of the "Default site init" query.
    - Command: `npm run dev`

### Manual Verification
1.  Observe the terminal output for the `[Prisma] Initializing with URL:` log and confirm it shows port `5432`.
2.  Trigger a request to an endpoint that uses the database (e.g., `/api/admin/settings`) and verify it returns `200 OK` without database errors.
