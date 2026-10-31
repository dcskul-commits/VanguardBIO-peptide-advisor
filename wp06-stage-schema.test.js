import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSchemaMigrationTarget} from './wp06-stage-schema.js';
const env={RENDER_SERVICE_ID:'srv-dbib14gm7kps73cd1440',MEMBERSHIP_ENABLED:'false',
  WP06_APPLY_SCHEMA:'approved-20261031',
  DATABASE_URL:'postgresql://test:test@dpg-dbihntl9fdbs73dmumrg-a/vanguardbio_membership_staging'};
test('exact staging target accepted',()=>assert.doesNotThrow(()=>assertSchemaMigrationTarget(env)));
test('production Render service refused',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,RENDER_SERVICE_ID:'srv-dbd2t9mi0phs7380t180'})));
test('unknown Render service refused',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,RENDER_SERVICE_ID:'other'})));
test('schema flag missing refused',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,WP06_APPLY_SCHEMA:'false'})));
test('membership activation refused during migration',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,MEMBERSHIP_ENABLED:'true'})));
test('production database destination refused',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,DATABASE_URL:'postgres://x:x@prod.example/vanguardbio_membership_staging'})));
test('wrong database name refused',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,DATABASE_URL:'postgres://x:x@dpg-dbihntl9fdbs73dmumrg-a/prod'})));
test('external connection hostname refused',()=>assert.throws(()=>assertSchemaMigrationTarget({...env,DATABASE_URL:'postgres://x:x@dpg-dbihntl9fdbs73dmumrg-a.oregon-postgres.render.com/vanguardbio_membership_staging'})));
