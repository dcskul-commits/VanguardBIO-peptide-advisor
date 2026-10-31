import test from 'node:test';
import assert from 'node:assert/strict';
import {memberWorkspaceDecision} from './membership-authorization.js';
const verified={session:{id:'s1',userId:'u1'},user:{id:'u1',emailVerified:true}};
test('anonymous denied',()=>assert.deepEqual(memberWorkspaceDecision(null),{allowed:false,status:401}));
test('user without live session denied',()=>assert.equal(memberWorkspaceDecision({user:verified.user}).allowed,false));
test('unverified account denied',()=>assert.equal(memberWorkspaceDecision({...verified,user:{id:'u1',emailVerified:false}}).allowed,false));
test('missing user ID denied',()=>assert.equal(memberWorkspaceDecision({...verified,user:{emailVerified:true}}).allowed,false));
test('verified live session receives minimal capabilities only',()=>{
 const r=memberWorkspaceDecision(verified);
 assert.equal(r.status,200);
 assert.equal(r.body.member.id,'u1');
 assert.equal(r.body.access.memberWorkspace,true);
 assert.equal(r.body.access.paidFeatures,false);
 assert.equal(JSON.stringify(r).includes('emailAddress'),false);
});
test('forged role cannot grant paid access',()=>{
 const r=memberWorkspaceDecision({...verified,user:{...verified.user,role:'admin',paid:true}});
 assert.equal(r.body.access.paidFeatures,false);
});
