import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{CoreView3D}from'../web/arena3d.js';import{cases,capture}from'./fixtures/core3d-harness.js';
const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/core3d-commands.json',import.meta.url),'utf8'));
for(const [i,options]of cases.entries())test('3D core commands: '+JSON.stringify(options),()=>assert.deepEqual(capture(CoreView3D,options),golden[i]));
