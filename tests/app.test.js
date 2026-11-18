import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStudioServer } from '../src/app.js';

const token='a'.repeat(64),secret='b'.repeat(64);
const storyboard={title:'رواج',format:'landscape',scenes:[{title:'کشف محصولات',duration:2,theme:'light',visual:'stats'}]};
async function fixture(t,options={}){
  const dir=await mkdtemp(path.join(os.tmpdir(),'studio-http-'));
  const app=await createStudioServer({port:0,token,mcpAccessPath:secret,publicBaseUrl:'http://127.0.0.1:8787',dataDir:dir,...options});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});});
  return {base,app};
}
let counter=0;
async function rpc(base,method,params,route='/mcp',headers={}){
  const body={jsonrpc:'2.0',id:++counter,method,...(params!==undefined?{params}:{})};
  const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const raw=await res.text();return {status:res.status,data:raw?JSON.parse(raw):null};
}
test('MCP handshake rejects missing auth and supports bearer token',async t=>{
  const {base}=await fixture(t);
  assert.equal((await rpc(base,'initialize')).status,401);
  const r=await rpc(base,'initialize',{},'/mcp',{Authorization:`Bearer ${token}`});
  assert.equal(r.status,200);assert.equal(r.data.result.protocolVersion,'2025-06-18');
  const tools=await rpc(base,'tools/list',{},`/mcp/${secret}`);
  assert.equal(tools.status,200);assert.ok(tools.data.result.tools.some(x=>x.name==='get_storyboard'));
  const res=await fetch(base+'/mcp',{method:'GET',headers:{Authorization:`Bearer ${token}`}});
  assert.equal(res.status,405);
});
test('MCP create, fetch, revise, status: never edit automatically',async t=>{
  const {base}=await fixture(t);
  const route=`/mcp/${secret}`;
  const created=await rpc(base,'tools/call',{name:'create_storyboard',arguments:storyboard},route);
  assert.equal(created.data.result.isError,false);
  const id=created.data.result.structuredContent.id;
  const read=await rpc(base,'tools/call',{name:'get_storyboard',arguments:{id}},route);
  assert.equal(read.data.result.structuredContent.scenes[0].title,'کشف محصولات');
  const edited=await rpc(base,'tools/call',{name:'revise_storyboard',arguments:{id,...storyboard,title:'نسخه دوم'}},route);
  assert.equal(edited.data.result.structuredContent.revision,2);
  const status=await rpc(base,'tools/call',{name:'video_status',arguments:{id}},route);
  assert.equal(status.data.result.structuredContent.status,'draft');
  assert.equal(status.data.result.structuredContent.video_url,undefined);
});
test('Origin restrictions, rate limiting and input limits',async t=>{
  const {base}=await fixture(t,{rateLimit:4});
  const route=`/mcp/${secret}`;
  const wrongOrigin=await rpc(base,'ping',{},route,{Origin:'https://attacker.example'});
  assert.equal(wrongOrigin.status,403);
  await rpc(base,'ping',{},route);
  await rpc(base,'ping',{},route);
  await rpc(base,'ping',{},route);
  assert.equal((await rpc(base,'ping',{},route)).status,429);
});
test('pending jobs are marked failed on service restart',async t=>{
  const {app}=await fixture(t);
  const record=await app.store.create(storyboard);record.status='rendering';await app.store.save(record);
  assert.equal(await app.store.recoverInterrupted(),1);
  assert.equal((await app.store.get(record.id)).status,'failed');
});
test('production configuration rejects insecure or malformed endpoint settings',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'studio-unsafe-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await assert.rejects(()=>createStudioServer({token,mcpAccessPath:secret,publicBaseUrl:'http://example.org',dataDir:dir}),/HTTPS/);
  await assert.rejects(()=>createStudioServer({token,publicBaseUrl:'https://example.org/has-path',dataDir:dir}),/PUBLIC_BASE_URL/);
  await assert.rejects(()=>createStudioServer({token:'weak',dataDir:dir}),/STUDIO_TOKEN/);
});
