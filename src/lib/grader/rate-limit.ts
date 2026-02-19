import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { GRADER_RATE_LIMIT } from '@/lib/constants';

/**
 * Hash IP + User-Agent into a privacy-preserving identity string.
 */
export function hashIdentity(ip: string, userAgent: string): string {
  return createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex');
}

/**
 * Check whether the given ipHash has exceeded the rate limit (uploads in last 24h).
 * Returns { allowed: boolean, remaining: number }.
 */
export async function checkRateLimit(
  ipHash: string
): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createServiceClient();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('cw_grader_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open — allow the request but log the error
    return { allowed: true, remaining: GRADER_RATE_LIMIT };
  }

  const used = count ?? 0;
  const remaining = Math.max(0, GRADER_RATE_LIMIT - used);

  return { allowed: used < GRADER_RATE_LIMIT, remaining };
}
