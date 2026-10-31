// WP08-B: one-time approved migration, staging database only.
// Does not modify existing membership tables or data; logs status only.
import pg from 'pg';
const STAGING_SERVICE='srv-dbib14gm7kps73cd1440';
const STAGING_DATABASE_HOST='dpg-dbihntl9fdbs73dmumrg-a';
const STAGING_DATABASE_NAME='vanguardbio_membership_staging';
const MIGRATION_FLAG='approved-wp08-b-20261031';
const createTable=`CREATE TABLE "saved_report" (
 "id" uuid PRIMARY KEY,
 "owner_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
 "title" varchar(120) NOT NULL,
 "body" text NOT NULL,
 "created_at" timestamptz NOT NULL,
 "updated_at" timestamptz NOT NULL,
 CONSTRAINT "saved_report_title_nonblank" CHECK (length(btrim("title"))>0),
 CONSTRAINT "saved_report_title_bound" CHECK (length("title")<=120),
 CONSTRAINT "saved_report_body_nonblank" CHECK (length(btrim("body"))>0),
 CONSTRAINT "saved_report_body_bound" CHECK (length("body")<=40000)
)`;
const createIndex=`CREATE INDEX "saved_report_owner_created_idx" ON "saved_report" ("owner_id","created_at" DESC,"id" DESC)`;
export function assertWp08MigrationTarget(env=process.env){
 if(env.RENDER_SERVICE_ID!==STAGING_SERVICE ||
    env.MEMBERSHIP_ENABLED!=='true' ||
    env.MEMBERSHIP_ENV!=='staging' ||
    env.MEMBERSHIP_DATABASE_ROLE!=='staging' ||
    env.WP08_APPLY_SCHEMA!==MIGRATION_FLAG)
   throw Error('WP08 migration not approved for this runtime');
 let url;
 try{url=new URL(env.DATABASE_URL||'')}catch{throw Error('Invalid DB URL');}
 if(!['postgres:','postgresql:'].includes(url.protocol) ||
    url.hostname!==STAGING_DATABASE_HOST ||
    url.pathname!=='/'+STAGING_DATABASE_NAME ||
    (url.port&&url.port!=='5432'))
   throw Error('WP08 migration target must be approved staging database');
}
async function verifySchema(client){
 const cols=(await client.query(`SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='saved_report'`)).rows;
 const expected={id:'uuid',owner_id:'text',title:'varchar',body:'text',created_at:'timestamptz',updated_at:'timestamptz'};
 if(cols.length!==6||Object.entries(expected).some(([k,v])=>!cols.some(r=>r.column_name===k&&r.udt_name===v)))
   throw Error('WP08 existing saved report schema does not match approved schema');
 const fk=(await client.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.saved_report'::regclass AND contype='f'`)).rows[0].n;
 if(fk!==1)throw Error('WP08 owner FK missing');
 const indexes=(await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='saved_report'`)).rows;
 if(!indexes.some(r=>r.indexname==='saved_report_owner_created_idx'))throw Error('WP08 owner index missing');
}
export async function initializeWp08SavedReportsSchema(env=process.env,PoolOverride){
 assertWp08MigrationTarget(env);
 const Pool=PoolOverride||pg.Pool;
 const pool=new Pool({connectionString:env.DATABASE_URL,ssl:false,max:1,connectionTimeoutMillis:4000});
 let client;
 try{
   client=await pool.connect();
   await client.query('BEGIN');
   // Only one migrations runner may change schema; lock is transaction-scoped.
   await client.query('SELECT pg_advisory_xact_lock($1)',[8240801]);
   const table=(await client.query(`SELECT to_regclass('public.saved_report') AS name`)).rows[0].name;
   if(table){
     await verifySchema(client);
     await client.query('COMMIT');
     return {status:'already_initialized'};
   }
   const user=(await client.query(`SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='user' AND column_name='id'`)).rows;
   if(user.length!==1||user[0].udt_name!=='text')throw Error('Auth user primary key shape mismatch');
   await client.query(createTable);
   await client.query(createIndex);
   await verifySchema(client);
   await client.query('COMMIT');
   return {status:'initialized'};
 }catch{
   if(client)await client.query('ROLLBACK').catch(()=>{});
   throw Error('WP08 schema migration failed closed');
 }finally{client?.release();await pool.end();}
}
