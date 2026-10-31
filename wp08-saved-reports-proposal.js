// WP08-B OFFLINE PROPOSAL ONLY. NOT imported by server, no database migrations.
// Saved reports are opt-in and do not persist raw conversation history automatically.
import { randomUUID } from 'node:crypto';

const MAX_TITLE=120;
const MAX_BODY=40000;
const MAX_LIST_LIMIT=30;

export function validateSavedReportDraft(payload) {
  if (!payload || typeof payload!=='object' || Array.isArray(payload)) return {ok:false,reason:'invalid_request'};
  const fields=Object.keys(payload).sort();
  if (fields.join(',')!=='body,explicitSave,title') return {ok:false,reason:'unsupported_fields'};
  if(payload.explicitSave!==true) return {ok:false,reason:'explicit_consent_required'};
  if(typeof payload.title!=='string'||!payload.title.trim()||payload.title.length>MAX_TITLE)
    return {ok:false,reason:'invalid_title'};
  if(typeof payload.body!=='string'||!payload.body.trim()||payload.body.length>MAX_BODY)
    return {ok:false,reason:'invalid_body'};
  return {ok:true,title:payload.title.trim(),body:payload.body};
}
export function verifiedOwnerId(session) {
  return session?.session?.id && typeof session?.user?.id==='string' &&
    session.user.id.length>0 && session.user.emailVerified===true
    ?session.user.id:null;
}
export function saveReportQuery(ownerId, draft, now=new Date(), id=randomUUID()) {
  if(!ownerId || typeof ownerId!=='string'||!draft?.ok) throw Error('Verified owner and validated draft required');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
    throw Error('Invalid report identifier');
  if(!(now instanceof Date)||Number.isNaN(now.getTime()))throw Error('Invalid timestamp');
  return {text:`INSERT INTO "saved_report" ("id","owner_id","title","body","created_at","updated_at")
VALUES ($1,$2,$3,$4,$5,$5) RETURNING "id","title","created_at","updated_at"`,
  values:[id,ownerId,draft.title,draft.body,now]};
}
export function listReportsQuery(ownerId, limit=20) {
  if(typeof ownerId!=='string'||!ownerId)throw Error('Owner required');
  if(!Number.isInteger(limit)||limit<1||limit>MAX_LIST_LIMIT)throw Error('Invalid limit');
  return {text:'SELECT "id","title","created_at","updated_at" FROM "saved_report" WHERE "owner_id"=$1 ORDER BY "created_at" DESC, "id" DESC LIMIT $2',values:[ownerId,limit]};
}
export function readReportQuery(ownerId, reportId) {
  verifyIdentifiers(ownerId,reportId);
  return {text:'SELECT "id","title","body","created_at","updated_at" FROM "saved_report" WHERE "id"=$1 AND "owner_id"=$2',values:[reportId,ownerId]};
}
export function deleteReportQuery(ownerId, reportId) {
  verifyIdentifiers(ownerId,reportId);
  return {text:'DELETE FROM "saved_report" WHERE "id"=$1 AND "owner_id"=$2 RETURNING "id"',values:[reportId,ownerId]};
}
function verifyIdentifiers(ownerId,reportId){
  if(typeof ownerId!=='string'||!ownerId)throw Error('Owner required');
  if(typeof reportId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reportId))
    throw Error('Invalid report identifier');
}
