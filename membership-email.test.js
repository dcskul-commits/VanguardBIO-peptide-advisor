import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipEmailLink} from './membership-email.js';

const base='https://vanguardbio-peptide-advisor-staging.onrender.com';
const verify=base+'/api/auth/verify-email?token=TEST_TOKEN&callbackURL=%2F';
test('staging verification URL gets a same-origin confirmation callback',()=>{
 const u=new URL(membershipEmailLink(verify,'Verify your VanguardBio-You email'));
 assert.equal(u.origin,base);
 assert.equal(u.pathname,'/api/auth/verify-email');
 assert.equal(u.searchParams.get('token'),'TEST_TOKEN');
 assert.equal(u.searchParams.get('callbackURL'),base+'/membership/verified');
});
test('password reset link stays untouched',()=>{
 const url=base+'/api/auth/reset-password/token?callbackURL=%2F';
 assert.equal(membershipEmailLink(url,'VanguardBio-You password reset'),url);
});
test('production-host verification link is rejected',()=>{
 assert.throws(()=>membershipEmailLink('https://vanguardbio-peptide-advisor.onrender.com/api/auth/verify-email?token=TEST','Verify your VanguardBio-You email'));
});
test('tokenless verification link is rejected',()=>{
 assert.throws(()=>membershipEmailLink(base+'/api/auth/verify-email','Verify your VanguardBio-You email'));
});
test('unapproved staging route is rejected',()=>{
 assert.throws(()=>membershipEmailLink(base+'/chat?token=TEST','Verify your VanguardBio-You email'));
});
