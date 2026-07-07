import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // SQLite Specific pooling
    // SQLite doesn't have a traditional pool like PG, but we can set busy timeout
  }).$extends({
    query: {
      async $allOperations({ operation, model, args, query }: { operation: string; model: string; args: any; query: (args: any) => Promise<any> }) {
        const start = Date.now();
        try {
          return await query(args);
        } catch (error: any) {
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
    globalThis.prismaGlobal = prismaClientSingleton()
    // Auto-initialize Default Site
    globalThis.prismaGlobal.site.upsert({
      where: { id: 'default-site' },
      update: {},
      create: { id: 'default-site', name: 'Main Operations' }
    }).catch(e => console.warn("[Prisma] Default site init failed (usually okay if DB not ready)"));
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
