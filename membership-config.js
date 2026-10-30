// WP06-C2: explicit staging-only fail-closed configuration. Never log secrets.
const STAGING_HOST = 'vanguardbio-peptide-advisor-staging.onrender.com';
const PROD_HOST = 'vanguardbio-peptide-advisor.onrender.com';
const PROD_ORIGIN = 'https://you.vanguardbio.ai';
const STAGING_DB_INTERNAL_HOST = 'dpg-dbihntl9fdbs73dmumrg-a';
export function membershipEnabled(env=process.env) { return env.MEMBERSHIP_ENABLED === 'true'; }
export function membershipAccess(origin, method, env=process.env) {
  if (!membershipEnabled(env)) return { allowed: false, status: 404 };
  const trusted = env.MEMBERSHIP_PREVIEW_ORIGIN;
  if (!trusted || trusted === PROD_ORIGIN || !/^https:\/\/[a-z0-9-]+\.preview\.c[0-9]+\.airoapp\.ai$/.test(trusted))
    return {allowed:false,status:503};
  if (origin && origin !== trusted) return { allowed:false,status:403 };
  if (!origin && !['GET','HEAD'].includes(method)) return {allowed:false,status:403};
  return {allowed:true,status:200,origin:origin===trusted?origin:null};
}
export function validateMembershipConfig(env=process.env) {
  if (env.MEMBERSHIP_ENV !== 'staging') throw Error('staging membership mode required');
  if (env.MEMBERSHIP_ENABLED !== 'true') throw Error('membership not enabled');
  if (!env.BETTER_AUTH_URL) throw Error('auth base URL not configured');
  const authURL = new URL(env.BETTER_AUTH_URL);
  if (authURL.protocol !== 'https:' || authURL.hostname !== STAGING_HOST || authURL.pathname !== '/')
    throw Error('auth URL must be existing staging Render service');
  if (authURL.hostname === PROD_HOST) throw Error('production auth target prohibited');
  const dbURL = new URL(env.DATABASE_URL || 'https://invalid.local');
  if (!['postgres:','postgresql:'].includes(dbURL.protocol) || !dbURL.hostname || !dbURL.pathname || dbURL.pathname==='/')
    throw Error('staging Postgres DATABASE_URL required');
  // Reject any other database destination even if the service was misconfigured.
  // Render's private host is tied to the independently provisioned staging DB ID.
  if (dbURL.hostname !== STAGING_DB_INTERNAL_HOST || dbURL.port && dbURL.port !== '5432')
    throw Error('database must use the approved staging PostgreSQL internal host');
  if (env.MEMBERSHIP_DATABASE_ROLE !== 'staging')
    throw Error('explicit staging database role required');
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw Error('BETTER_AUTH_SECRET must be at least 32 characters');
  if (!env.MEMBERSHIP_PREVIEW_ORIGIN || !/^https:\/\/[a-z0-9-]+\.preview\.c[0-9]+\.airoapp\.ai$/.test(env.MEMBERSHIP_PREVIEW_ORIGIN))
    throw Error('exact Airo preview origin required');
  if (env.MEMBERSHIP_PREVIEW_ORIGIN === PROD_ORIGIN)
    throw Error('production Airo origin is not a preview');
  if (!env.RESEND_API_KEY || !env.MEMBERSHIP_EMAIL_FROM)
    throw Error('verified transactional email provider required');
  // Before provisioning: manually review host/instance ID and PostgreSQL grants.
  // A URL and environment variable cannot independently prove the target DB is staging.
  return Object.freeze({authURL:authURL.origin,previewOrigin:env.MEMBERSHIP_PREVIEW_ORIGIN});
}
