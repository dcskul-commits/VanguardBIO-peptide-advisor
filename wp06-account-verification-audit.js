// One-time WP06 staging-only, read-only account verification audit.
// No email, credentials, tokens, or individual DB rows are ever logged.
import pg from 'pg';
import { createHash } from 'node:crypto';
const STAGING_ID='srv-dbib14gm7kps73cd1440';
const DB_HOST='dpg-dbihntl9fdbs73dmumrg-a';
const DB_NAME='vanguardbio_membership_staging';
const APPROVED_ACCOUNT_SHA256='49d8657339e140e14ab5b6501cf2ab7ed0444516b7b1ee07944ec1accbd3efed';
export async function auditStagingEmailVerification(env=process.env,{Pool}={}) {
  if(env.RENDER_SERVICE_ID!==STAGING_ID) return {status:'skipped'};
  let url;
  try{url=new URL(env.DATABASE_URL||'')}catch{return {status:'connection_not_configured'};}
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!==DB_HOST||url.pathname!=='/'+DB_NAME)
    return {status:'target_rejected'};
  const PoolImpl=Pool||(await import('pg')).default.Pool;
  const db=new PoolImpl({connectionString:env.DATABASE_URL,ssl:false,max:1,connectionTimeoutMillis:4000});
  try {
    const result=await db.query('SELECT email, "emailVerified" FROM "user"');
    const match=result.rows.filter(row=>createHash('sha256').update(String(row.email).toLowerCase().trim()).digest('hex')===APPROVED_ACCOUNT_SHA256);
    if(match.length!==1)return {status:match.length===0?'not_found':'duplicate_records'};
    return {status:'found',emailVerified:match[0].emailVerified===true};
  } catch {return {status:'query_failed'};} finally {await db.end().catch(()=>{});}
}
