// WP06 staging-only authenticated-route smoke: no user creation, email sends, or secrets.
const base='https://vanguardbio-peptide-advisor-staging.onrender.com';
const preview='https://g2uectlusc.preview.c37.airoapp.ai';
const production='https://you.vanguardbio.ai';
const fetchStatus=async(path,opts={})=>{
  const r=await fetch(base+path,{...opts,signal:AbortSignal.timeout(25000)});
  return {status:r.status,allowOrigin:r.headers.get('access-control-allow-origin'),contentType:r.headers.get('content-type'),body:await r.text()};
};
const assert=(condition,name,details)=>{console.log('WP06_AUTH_SMOKE '+JSON.stringify({check:name,passed:!!condition,...details}));if(!condition)throw Error('WP06_AUTH_SMOKE_FAILED '+name)};
const health=await fetchStatus('/health');
assert(health.status===200 && JSON.parse(health.body).status==='ok','health',{status:health.status});
const preflight=await fetchStatus('/api/auth/sign-up/email',{method:'OPTIONS',headers:{Origin:preview,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
assert(preflight.status===204 && preflight.allowOrigin===preview,'preview_preflight',{status:preflight.status});
const forbidden=await fetchStatus('/api/auth/get-session',{headers:{Origin:production}});
assert(forbidden.status===403 && forbidden.allowOrigin!==production,'production_origin_rejected',{status:forbidden.status});
const unknown=await fetchStatus('/api/membership/me',{headers:{Origin:'https://untrusted.example'}});
assert(unknown.status===403,'unknown_origin_rejected',{status:unknown.status});
const session=await fetchStatus('/api/auth/get-session',{headers:{Origin:preview}});
const data=session.status===200?JSON.parse(session.body):null;
assert(session.status===200 && (data===null || data?.session==null),'anonymous_session',{status:session.status});
const me=await fetchStatus('/api/membership/me',{headers:{Origin:preview}});
assert(me.status===401,'protected_endpoint',{status:me.status});
console.log('WP06_AUTH_SMOKE_COMPLETE '+JSON.stringify({passed:true,checks:6,sentEmails:0,createdAccounts:0}));
