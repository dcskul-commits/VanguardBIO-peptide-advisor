// WP06-C3: explicitly triggered, one-time, STAGING-ONLY schema initialization.
// Not imported on normal startup. No auth users, secrets, URLs or SQL results logged.
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {getMigrations} from 'better-auth/db/migration';
import {buildMembershipAuth} from './membership-core.js';

const STAGING_SERVICE='srv-dbib14gm7kps73cd1440';
const STAGING_DATABASE_HOST='dpg-dbihntl9fdbs73dmumrg-a';
const STAGING_DATABASE_NAME='vanguardbio_membership_staging';
export function assertSchemaMigrationTarget(env=process.env) {
  if(env.RENDER_SERVICE_ID!==STAGING_SERVICE || env.MEMBERSHIP_ENABLED==='true' ||
     env.WP06_APPLY_SCHEMA!=='approved-20261031')
    throw Error('staging-only schema migration not authorized in this runtime');
  const url=new URL(env.DATABASE_URL||'https://invalid.local');
  if(!['postgres:','postgresql:'].includes(url.protocol) ||
      url.hostname!==STAGING_DATABASE_HOST ||
      url.pathname!=='/'+STAGING_DATABASE_NAME ||
      (url.port && url.port!=='5432'))
    throw Error('schema migration target must be the exact staging Postgres instance');
}
export async function initializeApprovedStagingSchema(env=process.env) {
  assertSchemaMigrationTarget(env);
  const pool=new pg.Pool({connectionString:env.DATABASE_URL,ssl:false,max:2,connectionTimeoutMillis:4000});
  try {
    const sql="SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'";
    const before=(await pool.query(sql)).rows.map(r=>r.table_name);
    // Staging was verified empty. Never migrate an unexpected existing database.
    if(before.length!==0)throw Error('schema initialization requires empty staging database');
    const auth=buildMembershipAuth({
      database:pool,baseURL:'https://vanguardbio-peptide-advisor-staging.onrender.com',
      secret:randomBytes(32).toString('hex'),
      trustedOrigins:['https://g2uectlusc.preview.c37.airoapp.ai'],
      sendEmail:async()=>{throw Error('mail disabled during schema initialization');}
    });
    const {runMigrations}=await getMigrations(auth.options);
    await runMigrations();
    const after=new Set((await pool.query(sql)).rows.map(r=>r.table_name));
    for(const table of ['user','session','account','verification']){
      if(!after.has(table))throw Error('missing required auth table');
    }
    return {status:'initialized',requiredTables:4};
  } finally {await pool.end();}
}
