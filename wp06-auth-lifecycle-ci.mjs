// WP06-C3: isolated disposable PostgreSQL, synthetic accounts and captured test emails.
// No Render production/staging DB, no real email provider, no Airo changes.
import assert from 'node:assert/strict';
import http from 'node:http';
import pg from 'pg';
import {toNodeHandler} from 'better-auth/node';
import {getMigrations} from 'better-auth/db/migration';
import {buildMembershipAuth} from './membership-core.js';

const databaseURL=process.env.CI_POSTGRES_URL;
assert.ok(databaseURL?.includes('127.0.0.1')||databaseURL?.includes('localhost'),'only localhost CI postgres allowed');
const pool=new pg.Pool({connectionString:databaseURL,max:2});
const inbox=[];
const server=http.createServer((req,res)=>handler(req,res));
let handler=(_req,res)=>{res.writeHead(503);res.end()};
const listening=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const shutdown=()=>new Promise(resolve=>server.close(resolve));
try {
  await listening();
  const origin='http://127.0.0.1:'+server.address().port;
  const auth=buildMembershipAuth({
    database:pool,baseURL:origin,secret:'wp06-ci-only-'+'a'.repeat(40),
    trustedOrigins:[origin],
    sendEmail:async ({to,subject,url})=>{inbox.push({to,subject,url})}
  });
  handler=toNodeHandler(auth);
  const migration=await getMigrations(auth.options);
  await migration.runMigrations();
  const tables=(await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(r=>r.table_name);
  for(const name of ['user','session','account','verification'])assert.ok(tables.includes(name),'missing '+name);
  console.log('WP06_CI_SCHEMA',{tables:4,ok:true});
  const post=async(route,body,cookie)=>fetch(origin+'/api/auth/'+route,{
    method:'POST',redirect:'manual',
    headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
    body:JSON.stringify(body)
  });
  const user='test-member@auth.invalid';
  const pw='Test-Only-Strong-Password-2026!';
  const signup=await post('sign-up/email',{name:'Test Member',email:user,password:pw});
  assert.ok(signup.ok,'signup failed with HTTP '+signup.status);
  assert.ok(inbox.some(m=>m.subject.includes('Verify')),'verification email not created');
  const unverified=await post('sign-in/email',{email:user,password:pw});
  assert.equal(unverified.ok,false,'unverified user must not sign in');
  console.log('WP06_CI_SIGNUP',{signedUp:true,unverifiedRejected:true});
  const verifyLink=inbox.find(m=>m.subject.includes('Verify'))?.url;
  assert.ok(verifyLink?.startsWith(origin+'/api/auth/verify-email'),'bad verify URL');
  const verify=await fetch(verifyLink,{redirect:'manual'});
  assert.ok([200,302,303,307].includes(verify.status),'verification failed HTTP '+verify.status);
  console.log('WP06_CI_VERIFY',{verified:true});
  const login=await post('sign-in/email',{email:user,password:pw});
  assert.ok(login.ok,'verified login failed '+login.status);
  const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')||''];
  const sessionCookie=cookies.map(x=>x.split(';')[0]).filter(Boolean).join('; ');
  assert.match(sessionCookie,/session_token/,'session cookie absent');
  const session=await fetch(origin+'/api/auth/get-session',{headers:{Origin:origin,Cookie:sessionCookie}});
  const sessionData=await session.json();
  assert.ok(sessionData?.user?.id && sessionData?.user?.email===user,'session invalid');
  console.log('WP06_CI_LOGIN_SESSION',{login:true,session:true});
  const logout=await post('sign-out',{},sessionCookie);
  assert.ok(logout.ok,'logout failed');
  const postLogout=await fetch(origin+'/api/auth/get-session',{headers:{Origin:origin,Cookie:sessionCookie}});
  const revoked=await postLogout.json();
  assert.ok(!revoked?.user,'logout did not revoke server session');
  console.log('WP06_CI_LOGOUT',{revoked:true});
  const reset=await post('request-password-reset',{email:user});
  assert.ok(reset.ok,'reset request failed '+reset.status);
  const resetMail=inbox.filter(m=>m.subject.includes('password reset')).at(-1);
  assert.ok(resetMail?.url,'password reset link not created');
  const u=new URL(resetMail.url);
  console.log('WP06_CI_RESET_LINK_FORMAT',{pathSegments:u.pathname.split('/').filter(Boolean).length,tokenQueryPresent:u.searchParams.has('token')});
  const token=u.searchParams.get('token')||u.pathname.split('/').at(-1);
  assert.ok(token && token.length>10,'reset token missing');
  const newPw='Second-Strong-Test-Password-2026!';
  const resetDone=await post('reset-password',{token,newPassword:newPw});
  const resetResult=await resetDone.json().catch(()=>({}));
  console.log('WP06_CI_RESET_RESULT',{status:resetDone.status,result:resetResult?.status??null,code:resetResult?.code??null});
  assert.ok(resetDone.ok,'reset password failed '+resetDone.status);
  const oldLogin=await post('sign-in/email',{email:user,password:pw});
  assert.ok(!oldLogin.ok,'old password should be rejected');
  const newLogin=await post('sign-in/email',{email:user,password:newPw});
  const loginResult=await newLogin.json().catch(()=>({}));
  console.log('WP06_CI_POST_RESET_LOGIN',{status:newLogin.status,code:loginResult?.code??null});
  assert.ok(newLogin.ok,'new password should work');
  console.log('WP06_CI_RESET',{requested:true,oldPasswordRejected:true,newPasswordAccepted:true});
  console.log('WP06_CI_COMPLETE',{schema:true,signUp:true,verification:true,login:true,logout:true,passwordReset:true});
} finally {
  await shutdown().catch(()=>{});
  await pool.end();
}
