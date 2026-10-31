// Loads only after staging-only environment preflight has passed.
// Separate staged auth and DB credentials; never import from Airo's shared secrets.
import { buildMembershipAuth } from './membership-core.js';
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
  const auth=buildMembershipAuth({
    database:pool,baseURL:cfg.authURL,secret:env.BETTER_AUTH_SECRET,
    trustedOrigins:[cfg.previewOrigin],
    sendEmail:(message)=>sendMembershipEmail(message,env)
  });
  const handler=toNodeHandler(auth);
  const handle=async (req,res)=>{
    try {
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
    return await handler(req,res);
    } catch {
      // Do not log sessions, credentials, request bodies or user data.
      if(!res.headersSent) {
        res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(JSON.stringify({error:'Membership temporarily unavailable'}));
      } else if(!res.writableEnded) res.end();
    }
  };
  return {handle,close:()=>pool.end()};
}
