// Standalone staging-only browser acceptance UI. No password/token persistence.
const $=id=>document.getElementById(id);
const status=(message,ok=false)=>{$('status').textContent=message;$('status').dataset.ok=ok?'true':'false'};
const loginPanel=$('login-panel');
const resetPanel=$('reset-panel');
const page=location.pathname;
const post=async(path,body)=>{
 const response=await fetch('/api/auth/'+path,{method:'POST',credentials:'include',
 headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 let data=null;try{data=await response.json()}catch{}
 return {ok:response.ok,status:response.status,data};
};
if(page==='/membership/password-reset'){
 loginPanel.hidden=true;resetPanel.hidden=false;
 const params=new URLSearchParams(location.search);
 const token=params.get('token')||new URLSearchParams(location.hash.slice(1)).get('token');
 history.replaceState(null,'',location.pathname);
 if(!token){status('Reset link missing or expired. Request a new link from the staging sign-in page.');$('reset-submit').disabled=true}
 $('reset-form').addEventListener('submit',async e=>{
   e.preventDefault();
   const password=$('new-password').value,confirm=$('confirm-password').value;
   if(password.length<12||password!==confirm){status('Use at least 12 characters and matching passwords.');return}
   $('reset-submit').disabled=true;status('Submitting password reset…');
   try{
     const r=await post('reset-password',{token,newPassword:password});
     $('new-password').value='';$('confirm-password').value='';
     status(r.ok?'Password reset succeeded. You can now sign in with your new password.':'Reset failed or the link expired. Request a new reset email.',r.ok);
     if(r.ok){$('reset-form').hidden=true;$('login-link').hidden=false}
     else $('reset-submit').disabled=false;
   }catch(err){
     // Browser transport failures are not proof that the reset did not take effect.
     // Do not expose tokens or passwords in diagnostics.
     status('Could not confirm the reset response. Check whether your new password works on the sign-in page; otherwise request a fresh reset email.');
     $('login-link').hidden=false;
     $('reset-submit').disabled=false;
   }
 });
}else{
 resetPanel.hidden=true;loginPanel.hidden=false;
 $('request-form').addEventListener('submit',async e=>{
   e.preventDefault();$('request-submit').disabled=true;
   try{
     const r=await post('request-password-reset',{
       email:$('email').value.trim(),
       redirectTo:location.origin+'/membership/password-reset'
     });
     status(r.ok?'If the account exists, a password reset email has been sent. Check your inbox.':'Unable to request a reset now. Please try later.',r.ok);
   }catch{status('Network error. Please try again.')}
   finally{$('request-submit').disabled=false}
 });
 $('login-form').addEventListener('submit',async e=>{
   e.preventDefault();$('login-submit').disabled=true;
   const password=$('password').value;
   try{
     const r=await post('sign-in/email',{email:$('email').value.trim(),password});
     $('password').value='';
     status(r.ok?'Signed in successfully.':'Sign-in unsuccessful. Check the password and email verification.',r.ok);
     if(r.ok)await checkSession();
   }catch{status('Network error. Please try again.')}
   finally{$('login-submit').disabled=false}
 });
 $('signout').addEventListener('click',async()=>{
   const r=await post('sign-out',{});
   status(r.ok?'Signed out.':'Sign-out request failed.',r.ok);
   await checkSession();
 });
 $('check-session').addEventListener('click',checkSession);
 async function checkSession(){
   try{
     const r=await fetch('/api/membership/me',{credentials:'include',cache:'no-store'});
     const data=r.ok?await r.json():null;
     $('session').textContent=r.ok&&data?.user?'Authenticated session: '+(data.user.emailVerified?'email verified':'email not verified'):'No authenticated session';
     $('signout').disabled=!r.ok;
   }catch{$('session').textContent='Session check unavailable'}
 }
 void checkSession();
}
