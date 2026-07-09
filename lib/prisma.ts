import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }: { operation: string; model: string; args: any; query: (args: any) => Promise<any> }) {
        const start = Date.now();
        try {
          return await query(args);
        } catch (error: any) {
          console.error(`[Prisma Error] ${model}.${operation} failed:`, error.message);
          if (error.message?.includes('connection') || error.message?.includes('reached')) {
            console.error(`[Prisma Database Error] Critical connection failure in ${model}.${operation}`);
          }
          throw error;
        } finally {
          const end = Date.now();
          if (end - start > 5000) {
            console.warn(`[Prisma Slow Query] ${model}.${operation} took ${end - start}ms`);
          }
        }
      },
    },
  });
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// In Next.js dev, we use a global variable to preserve the Prisma instance
// across hot-reloads.
const getPrisma = () => {
  if (!globalThis.prismaGlobal) {
    const dbUrl = process.env.DATABASE_URL || 'not-set';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`[Prisma] Initializing with URL: ${maskedUrl} (Mode: ${process.env.NODE_ENV})`);

    globalThis.prismaGlobal = prismaClientSingleton()

    // Auto-initialize Default Site (Skip during build time to avoid errors)
    if (process.env.NEXT_PHASE !== 'phase-production-build' && process.env.NODE_ENV !== 'test') {
      globalThis.prismaGlobal.site.upsert({
        where: { id: 'default-site' },
        update: {},
        create: { id: 'default-site', name: 'Main Operations' }
      }).catch(e => {
        // Only log if it's not a missing env var error (expected during some build phases)
        if (!e.message?.includes('DATABASE_URL')) {
          console.warn("[Prisma] Default site init failed:", e.message);
        }
      });
    }
  }
  return globalThis.prismaGlobal
}

export const prisma = getPrisma()

/**
 * Bulletproof Query Wrapper: Retries once on transient failures
 * Optimized for Supabase/Postgres connection resets.
 */
export async function prismaRetry<T>(queryFn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;
      const isNetworkError =
        error.message?.toLowerCase().includes('connection') ||
        error.message?.toLowerCase().includes('timeout') ||
        error.message?.toLowerCase().includes('pool') ||
        error.message?.toLowerCase().includes('reached') ||
        error.message?.toLowerCase().includes('broken pipe');

      if (isNetworkError) {
        console.warn(`[Prisma Database] Connection failure, retrying (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1))); // Incremental backoff
        continue;
      }
      throw error;
    }
  }
  console.error("[Prisma Database] Fatal exhaustion of retries.");
  throw lastError;
}
