import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipAccess,membershipEnabled,validateMembershipConfig} from './membership-config.js';
const preview='https://g2uectlusc.preview.c37.airoapp.ai';
const valid={
  MEMBERSHIP_ENABLED:'true', MEMBERSHIP_ENV:'staging', MEMBERSHIP_DATABASE_ROLE:'staging',
  BETTER_AUTH_URL:'https://vanguardbio-peptide-advisor-staging.onrender.com',
  DATABASE_URL:'postgres://user:password@staging-db.example.net/staging',
  BETTER_AUTH_SECRET:'x'.repeat(48),
  MEMBERSHIP_PREVIEW_ORIGIN:preview, RESEND_API_KEY:'test',MEMBERSHIP_EMAIL_FROM:'test@example.org'
};
test('membership defaults to disabled',()=>{assert.equal(membershipEnabled({}),false);assert.deepEqual(membershipAccess(preview,'POST',{}),{allowed:false,status:404});});
test('valid staging-only configuration',()=>{assert.equal(validateMembershipConfig(valid).previewOrigin,preview)});
test('production Airo origin denied',()=>{assert.equal(membershipAccess('https://you.vanguardbio.ai','POST',valid).status,403)});
test('unknown origin denied',()=>{assert.equal(membershipAccess('https://malicious.example','POST',valid).status,403)});
test('missing origin cannot make mutating request',()=>{assert.equal(membershipAccess('','POST',valid).status,403)});
test('exact preview origin accepted',()=>{assert.equal(membershipAccess(preview,'POST',valid).allowed,true)});
test('preview origin lookalike denied',()=>{assert.equal(membershipAccess(preview+'.attacker.test','POST',valid).status,403)});
test('disabling auth denies all',()=>{assert.equal(membershipAccess(preview,'POST',{...valid,MEMBERSHIP_ENABLED:'false'}).status,404)});
test('production auth URL denied',()=>{assert.throws(()=>validateMembershipConfig({...valid,BETTER_AUTH_URL:'https://vanguardbio-peptide-advisor.onrender.com'}))});
test('insecure auth URL denied',()=>{assert.throws(()=>validateMembershipConfig({...valid,BETTER_AUTH_URL:'http://vanguardbio-peptide-advisor-staging.onrender.com'}))});
test('not staging role denied',()=>{assert.throws(()=>validateMembershipConfig({...valid,MEMBERSHIP_DATABASE_ROLE:'production'}))});
test('missing database denied',()=>{assert.throws(()=>validateMembershipConfig({...valid,DATABASE_URL:''}))});
test('missing email delivery denied',()=>{assert.throws(()=>validateMembershipConfig({...valid,RESEND_API_KEY:''}))});
test('weak secret denied',()=>{assert.throws(()=>validateMembershipConfig({...valid,BETTER_AUTH_SECRET:'short'}))});
test('preview wildcard not allowed',()=>{assert.throws(()=>validateMembershipConfig({...valid,MEMBERSHIP_PREVIEW_ORIGIN:'https://*.airoapp.ai'}))});
test('same origin production not allowed',()=>{assert.throws(()=>validateMembershipConfig({...valid,MEMBERSHIP_PREVIEW_ORIGIN:'https://you.vanguardbio.ai'}))});
