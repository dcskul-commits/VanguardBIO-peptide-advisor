import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSavedReportDraft,verifiedOwnerId,saveReportQuery,listReportsQuery,readReportQuery,deleteReportQuery} from './wp08-saved-reports-proposal.js';
const id='123e4567-e89b-42d3-a456-426614174000';
const member={session:{id:'s1'},user:{id:'member-1',emailVerified:true}};
const good={title:'Study summary',body:'Educational evidence report',explicitSave:true};
test('explicit user save required',()=>{
 assert.equal(validateSavedReportDraft({...good,explicitSave:false}).ok,false);
 assert.equal(validateSavedReportDraft({...good,explicitSave:'true'}).ok,false);
 assert.equal(validateSavedReportDraft({...good,owner_id:'member-2'}).ok,false);
 assert.equal(validateSavedReportDraft({...good,role:'admin'}).ok,false);
});
test('only bounded nonblank report body and title allowed',()=>{
 assert.equal(validateSavedReportDraft(good).ok,true);
 assert.equal(validateSavedReportDraft({...good,body:'x'.repeat(40001)}).ok,false);
 assert.equal(validateSavedReportDraft({...good,title:'x'.repeat(121)}).ok,false);
 assert.equal(validateSavedReportDraft({...good,body:''}).ok,false);
});
test('verified live session required for owner',()=>{
 assert.equal(verifiedOwnerId(null),null);
 assert.equal(verifiedOwnerId({user:member.user}),null);
 assert.equal(verifiedOwnerId({...member,user:{...member.user,emailVerified:false}}),null);
 assert.equal(verifiedOwnerId(member),'member-1');
});
test('save requires owner, explicit consent, parameters and limited returning columns',()=>{
 const d=validateSavedReportDraft(good);
 assert.throws(()=>saveReportQuery('',d,new Date(),id));
 assert.throws(()=>saveReportQuery('member-1',{ok:false},new Date(),id));
 const q=saveReportQuery('member-1',d,new Date('2026-10-31T00:00:00Z'),id);
 assert.deepEqual(q.values.slice(0,4),[id,'member-1',good.title,good.body]);
 assert.ok(q.text.includes('RETURNING "id","title","created_at","updated_at"'));
 assert.ok(!q.text.includes(good.body));
});
test('owner is obligatory for listing and never returns body',()=>{
 const q=listReportsQuery('member-1',10);
 assert.deepEqual(q.values,['member-1',10]);
 assert.ok(q.text.includes('WHERE "owner_id"=$1'));
 assert.ok(!q.text.includes('"body"'));
 assert.throws(()=>listReportsQuery('',10));
 assert.throws(()=>listReportsQuery('member-1',100));
});
test('read is owner scoped, parameterized, and cannot leak through ID substitution',()=>{
 const q=readReportQuery('member-1',id);
 assert.deepEqual(q.values,[id,'member-1']);
 assert.ok(q.text.includes('WHERE "id"=$1 AND "owner_id"=$2'));
 assert.throws(()=>readReportQuery('member-1',"xyz' OR true --"));
});
test('delete requires both resource ID and owner',()=>{
 const q=deleteReportQuery('member-1',id);
 assert.deepEqual(q.values,[id,'member-1']);
 assert.ok(q.text.includes('WHERE "id"=$1 AND "owner_id"=$2'));
 assert.throws(()=>deleteReportQuery('',id));
});
test('forged client identity cannot affect server session owner',()=>{
 const forged={...good,owner_id:'member-2'};
 assert.equal(validateSavedReportDraft(forged).ok,false);
 assert.equal(verifiedOwnerId(member),'member-1');
});
