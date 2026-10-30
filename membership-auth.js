// Loads only after staging-only environment preflight has passed.
// Separate staged auth and DB credentials; never import from Airo's shared secrets.
import { betterAuth } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import pg from 'pg';
import { validateMembershipConfig, membershipAccess } from './membership-config.js';
import { sendMembershipEmail } from './membership-email.js';

export function createMembershipHandler(env=process.env) {
  const cfg=validateMembershipConfig(env);
  const pool=new pg.Pool({
    connectionString:env.DATABASE_URL,
    max:4,
    connectionTimeoutMillis:4000,
    idleTimeoutMillis:10000,
    // Same-region Render private networking; self-signed internal TLS is not CA-verifiable.
    // Do not use a publicly reachable database host; config enforces exact staging host.
    ssl: false
  });
  const auth=betterAuth({
    baseURL:cfg.authURL,
    secret:env.BETTER_AUTH_SECRET,
    database:pool,
    trustedOrigins:[cfg.previewOrigin],
    emailAndPassword:{
      enabled:true,
      requireEmailVerification:true,
      minPasswordLength:12,
      sendResetPassword:async ({user,url})=>sendMembershipEmail({to:user.email,subject:'VanguardBio-You password reset',url},env)
    },
    emailVerification:{
      sendOnSignUp:true,
      sendOnSignIn:true,
      sendVerificationEmail:async ({user,url})=>sendMembershipEmail({to:user.email,subject:'Verify your VanguardBio-You email',url},env)
    },
    advanced:{ defaultCookieAttributes:{secure:true,httpOnly:true,sameSite:'none'} }
  });
  const handler=toNodeHandler(auth);
  const handle=async (req,res)=>{
    const origin=String(req.headers.origin||'');
    const access=membershipAccess(origin,req.method||'',env);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Origin');
    if(!access.allowed){res.writeHead(access.status);res.end();return;}
    if(access.origin){
      res.setHeader('Access-Control-Allow-Origin',access.origin);
      res.setHeader('Access-Control-Allow-Credentials','true');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    }
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.url?.split('?')[0] === '/api/membership/me') {
      if(req.method!=='GET'){res.writeHead(405,{Allow:'GET, OPTIONS'});res.end();return;}
      // Better Auth validates the session on the server; never trust client-supplied user IDs.
      const session=await auth.api.getSession({headers:new Headers(
        Object.entries(req.headers).filter(([_,v])=>typeof v==='string').map(([k,v])=>[k,v])
      )});
      if(!session?.user){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Authentication required'}));return;}
      const user=session.user;
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({user:{id:user.id,email:user.email,emailVerified:user.emailVerified}}));
      return;
    }
    return handler(req,res);
  };
  return {handle,close:()=>pool.end()};
}
