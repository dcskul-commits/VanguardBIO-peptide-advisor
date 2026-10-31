// WP08-B integration test against disposable CI PostgreSQL. NO staging/production DB.
import assert from 'node:assert/strict';
import pg from 'pg';
import {Readable} from 'node:stream';
import {createTable,createIndex,assertWp08MigrationTarget} from './wp08-stage-schema.js';
import {handleSavedReports} from './wp08-saved-reports-api.js';

const url=process.env.CI_POSTGRES_URL;
assert.ok(url && new URL(url).hostname==='127.0.0.1' && new URL(url).pathname==='/wp08_ci',
 'Only disposable CI database permitted');
assert.throws(()=>assertWp08MigrationTarget({RENDER_SERVICE_ID:'production',DATABASE_URL:url,WP08_APPLY_SCHEMA:'approved-wp08-b-20261031'}));
const db=new pg.Pool({connectionString:url,max:2});
const env={RENDER_SERVICE_ID:'srv-dbib14gm7kps73cd1440',MEMBERSHIP_ENV:'staging',
 MEMBERSHIP_ENABLED:'true',WP08_SAVED_REPORTS_ENABLED:'true'};
const member=id=>({session:{id:'session-'+id},user:{id,emailVerified:true}});
async function invoke(method,path,session,body,origin='https://vanguardbio-peptide-advisor-staging.onrender.com'){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 req.method=method;req.url=path;req.headers={'content-type':'application/json',origin};
 const res={status:0,headers:{},response:'',
   writeHead(code,headers){this.status=code;this.headers=headers;},
   end(text){this.response=text??'';},
 };
 const handled=await handleSavedReports(req,res,{session,pool:db,env});
 assert.equal(handled,true);
 let json=null;try{json=JSON.parse(res.response)}catch{}
 return {status:res.status,headers:res.headers,json};
}
let count=0;
function check(name,condition){assert.ok(condition,name);count++;console.log('WP08_REPORT_CI '+JSON.stringify({check:name,passed:true}));}
try{
 await db.query('CREATE TABLE "user" ("id" text PRIMARY KEY)');
 await db.query(createTable);
 await db.query(createIndex);
 await db.query('INSERT INTO "user" ("id") VALUES ($1),($2)',['synthetic-a','synthetic-b']);
 let r=await invoke('GET','/api/member/reports',null);
 check('anonymous_denied',r.status===401);
 r=await invoke('POST','/api/member/reports',member('synthetic-a'),{title:'no-consent',body:'test',explicitSave:false});
 check('consent_required',r.status===400);
 r=await invoke('POST','/api/member/reports',member('synthetic-a'),{title:'A',body:'Synthetic educational report A',explicitSave:true});
 check('save_a',r.status===201&&r.json.report.id&&!('body'in r.json.report));
 const a=r.json.report.id;
 r=await invoke('POST','/api/member/reports',member('synthetic-b'),{title:'B',body:'Synthetic educational report B',explicitSave:true});
 check('save_b',r.status===201);
 const b=r.json.report.id;
 r=await invoke('GET','/api/member/reports',member('synthetic-a'));
 check('list_a_only',r.status===200&&r.json.reports.length===1&&r.json.reports[0].id===a);
 r=await invoke('GET','/api/member/reports',member('synthetic-b'));
 check('list_b_only',r.status===200&&r.json.reports.length===1&&r.json.reports[0].id===b);
 r=await invoke('GET','/api/member/reports/'+b,member('synthetic-a'));
 check('cross_read_denied',r.status===404);
 r=await invoke('DELETE','/api/member/reports/'+b,member('synthetic-a'));
 check('cross_delete_denied',r.status===404);
 r=await invoke('GET','/api/member/reports/'+a,member('synthetic-a'));
 check('own_read',r.status===200&&r.json.report.body==='Synthetic educational report A');
 r=await invoke('GET','/api/member/reports/'+b,member('synthetic-b'));
 check('other_member_unaffected',r.status===200);
 r=await invoke('GET','/api/member/reports', {...member('synthetic-a'),user:{id:'synthetic-a',emailVerified:false}});
 check('unverified_denied',r.status===401);
 r=await invoke('POST','/api/member/reports',member('synthetic-a'),{title:'X',body:'X',explicitSave:true,owner_id:'synthetic-b'});
 check('forged_owner_rejected',r.status===400);
 r=await invoke('GET','/api/member/reports/'+a+'?junk=1',member('synthetic-a'));
 check('unknown_query_rejected',r.status===400);
 r=await invoke('GET','/api/member/reports',member('synthetic-a'));
 check('no_report_body_in_list',r.status===200&&!JSON.stringify(r.json).includes('Synthetic educational report A'));
 r=await invoke('DELETE','/api/member/reports/'+a,member('synthetic-a'));
 check('own_delete',r.status===204);
 r=await invoke('GET','/api/member/reports/'+a,member('synthetic-a'));
 check('deleted_not_found',r.status===404);
 r=await invoke('DELETE','/api/member/reports/'+b,member('synthetic-b'));
 check('other_member_delete',r.status===204);
 const countRows=await db.query('SELECT count(*)::int AS n FROM "saved_report"');
 check('zero_reports_left',countRows.rows[0].n===0);
 console.log('WP08_REPORT_CI_COMPLETE '+JSON.stringify({checks:count,passed:true,accounts:2,retainedRecords:0}));
}finally{
 await db.query('DROP TABLE IF EXISTS "saved_report"');
 await db.query('DROP TABLE IF EXISTS "user"');
 await db.end();
}
