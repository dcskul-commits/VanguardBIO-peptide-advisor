// WP06 single-purpose, user-approved staging password recovery request.
// No passwords, tokens or email contents logged.
const base='https://vanguardbio-peptide-advisor-staging.onrender.com';
const response=await fetch(base+'/api/auth/request-password-reset',{
 method:'POST',redirect:'manual',signal:AbortSignal.timeout(25000),
 headers:{Origin:base,'Content-Type':'application/json'},
 body:JSON.stringify({email:'dcskul@gmail.com',redirectTo:base+'/membership/password-reset'})
});
console.log('WP06_PASSWORD_RESET_REQUEST',JSON.stringify({status:response.status,accepted:response.ok}));
if(!response.ok)process.exitCode=1;
