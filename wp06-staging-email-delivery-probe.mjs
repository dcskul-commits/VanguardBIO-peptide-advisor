// WP06 one-time staging signup delivery probe, using only an address approved by the user.
// Run once for the newly approved Gmail recipient. Password created in-memory. No secrets, response bodies, or verification URLs logged.
import {randomBytes} from 'node:crypto';
const endpoint='https://vanguardbio-peptide-advisor-staging.onrender.com/api/auth/sign-up/email';
const expectedOrigin='https://g2uectlusc.preview.c37.airoapp.ai';
const email='dcskul@gmail.com';
const password='TestOnly!'+randomBytes(24).toString('base64url')+'9a';
const r=await fetch(endpoint,{
 method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
 headers:{'Content-Type':'application/json',Origin:expectedOrigin},
 body:JSON.stringify({name:'VanguardBio staging test',email,password})
});
console.log('WP06_STAGING_EMAIL_DELIVERY',{status:r.status,accepted:r.status>=200&&r.status<300});
// Avoid outputting response body because it can include account data or session artifacts.
if(r.status<200||r.status>=300)process.exitCode=1;
