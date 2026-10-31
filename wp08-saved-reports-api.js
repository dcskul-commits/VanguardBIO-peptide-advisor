// WP08-B: staging-only saved reports. All identity comes from Better Auth session.
// Do not log request bodies, report text, personal email, or session details.
import {validateSavedReportDraft,verifiedOwnerId,saveReportQuery,listReportsQuery,readReportQuery,deleteReportQuery} from './wp08-saved-reports-proposal.js';

const ROOT='/api/member/reports';
const MAX_POST_BYTES=45000;
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const noContent=(res,code)=>{res.writeHead(code,{'Cache-Control':'private, no-store'});res.end();};
const json=(res,code,body)=>{res.writeHead(code,JSON_HEADERS);res.end(JSON.stringify(body));};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const membersRoute=(pathname)=>pathname===ROOT||pathname.startsWith(ROOT+'/');

async function parseBody(req) {
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return {error:415};
 const chunks=[];let count=0;
 try{
   for await (const chunk of req){
     count+=chunk.length;
     if(count>MAX_POST_BYTES)return {error:413};
     chunks.push(chunk);
   }
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   return {data};
 }catch{return {error:400};}
}
export function reportsFeatureEnabled(env=process.env) {
 return env.RENDER_SERVICE_ID==='srv-dbib14gm7kps73cd1440' &&
        env.MEMBERSHIP_ENV==='staging' &&
        env.MEMBERSHIP_ENABLED==='true' &&
        env.WP08_SAVED_REPORTS_ENABLED==='true';
}
export async function handleSavedReports(req,res,{session,pool,env=process.env}){
 const pathname=new URL(req.url||'/', 'http://localhost').pathname;
 if(!membersRoute(pathname))return false;
 if(!reportsFeatureEnabled(env)){json(res,404,{error:'Not found'});return true;}
 if(!['GET','POST','DELETE'].includes(req.method||'')){json(res,405,{error:'Method not allowed'});return true;}
 const ownerId=verifiedOwnerId(session);
 if(!ownerId){json(res,401,{error:'Verified member session required'});return true;}
 const sub=pathname.slice(ROOT.length);
 if(sub!==''&&!/^\/[0-9a-f-]+$/.test(sub)){json(res,404,{error:'Not found'});return true;}
 const reportId=sub===''?null:sub.slice(1);
 if(reportId&&!idPattern.test(reportId)){json(res,404,{error:'Not found'});return true;}
 try{
   if(sub===''&&req.method==='GET'){
     const u=new URL(req.url||'/', 'http://localhost');
     if([...u.searchParams.keys()].some(x=>x!=='limit')){json(res,400,{error:'Invalid query'});return true;}
     const raw=u.searchParams.get('limit');
     if(u.searchParams.getAll('limit').length>1){json(res,400,{error:'Invalid limit'});return true;}
     const limit=raw==null?20:Number(raw);
     if(!Number.isInteger(limit)||limit<1||limit>30){json(res,400,{error:'Invalid limit'});return true;}
     const result=await pool.query(listReportsQuery(ownerId,limit));
     json(res,200,{reports:result.rows});return true;
   }
   if(sub===''&&req.method==='POST'){
     const {data,error}=await parseBody(req);
     if(error){json(res,error,{error:'Invalid request'});return true;}
     const draft=validateSavedReportDraft(data);
     if(!draft.ok){json(res,400,{error:'Invalid or non-consensual report'});return true;}
     const result=await pool.query(saveReportQuery(ownerId,draft));
     json(res,201,{report:result.rows[0]});return true;
   }
   if(reportId&&req.method==='GET'){
     const result=await pool.query(readReportQuery(ownerId,reportId));
     if(result.rowCount===0){json(res,404,{error:'Not found'});return true;}
     json(res,200,{report:result.rows[0]});return true;
   }
   if(reportId&&req.method==='DELETE'){
     const result=await pool.query(deleteReportQuery(ownerId,reportId));
     if(result.rowCount===0){json(res,404,{error:'Not found'});return true;}
     noContent(res,204);return true;
   }
   json(res,405,{error:'Method not allowed'});return true;
 }catch{
   json(res,503,{error:'Saved reports temporarily unavailable'});
   return true;
 }
}
