// Staging-only read-only readiness checks. Do not log response content or credentials.
const base='https://vanguardbio-peptide-advisor-staging.onrender.com';
const fetchTimed=async(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(30000)});
const health=await fetchTimed('/health');let json={};try{json=await health.json()}catch{};
if(health.status!==200||json.status!=='ok')throw Error('staging health invalid '+health.status);
console.log('WP06_STAGING_HEALTH '+JSON.stringify({status:health.status,healthy:true}));
const auth=await fetchTimed('/api/auth/get-session',{headers:{Origin:'https://g2uectlusc.preview.c37.airoapp.ai'}});
if(auth.status!==404)throw Error('auth must remain disabled until migrations and staging credentials are verified; got '+auth.status);
console.log('WP06_STAGING_AUTH_CLOSED '+JSON.stringify({status:auth.status,closed:true}));
const account=await fetchTimed('/api/membership/me',{headers:{Origin:'https://g2uectlusc.preview.c37.airoapp.ai'}});
if(account.status!==404)throw Error('member endpoint must remain disabled until activation; got '+account.status);
console.log('WP06_STAGING_MEMBER_CLOSED '+JSON.stringify({status:account.status,closed:true}));
console.log('WP06_STAGING_READY',{health:true,authDisabled:true,memberDisabled:true});
