// One-time, read-only staging connection check. No passwords, URL or DB data logged.
// This code is inert outside the exact authorized staging Render service.
const STAGING_SERVICE_ID='srv-dbib14gm7kps73cd1440';
const APPROVED_STAGING_DB_HOST='dpg-dbihntl9fdbs73dmumrg-a';
const APPROVED_STAGING_DB_NAME='vanguardbio_membership_staging';
export async function probeStagingDatabase(env=process.env,{Pool}={}) {
  if(env.RENDER_SERVICE_ID!==STAGING_SERVICE_ID)return {status:'skipped'};
  if(env.MEMBERSHIP_ENABLED==='true')return {status:'skipped_auth_enabled'};
  if(!env.DATABASE_URL)return {status:'missing_connection'};
  let url;
  try {url=new URL(env.DATABASE_URL)} catch{return {status:'invalid_connection'};}
  if(!['postgres:','postgresql:'].includes(url.protocol)
     ||url.hostname!==APPROVED_STAGING_DB_HOST
     ||url.pathname!==('/'+APPROVED_STAGING_DB_NAME))
    return {status:'unapproved_target'};
  const poolFactory=Pool || (await import('pg')).default.Pool;
  const pool=new poolFactory({connectionString:env.DATABASE_URL,ssl:false,max:1,connectionTimeoutMillis:4000,idleTimeoutMillis:1000});
  try {
    const result=await pool.query('SELECT current_database() AS db');
    return {status:result.rows?.[0]?.db===APPROVED_STAGING_DB_NAME?'connected':'unapproved_target'};
  } catch {return {status:'connection_failed'};} finally {await pool.end().catch(()=>{});}
}
