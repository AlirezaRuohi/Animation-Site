// End-to-end smoke test: authenticated MCP -> storyboard -> real FFmpeg -> signed download.
import { createStudioServer } from '../src/app.js';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const directory=await mkdtemp(path.join(os.tmpdir(),'studio-smoke-'));
const token='a'.repeat(64),secret='b'.repeat(64);
let server;
try{
  const app=await createStudioServer({token,mcpAccessPath:secret,port:0,publicBaseUrl:'http://127.0.0.1:8787',dataDir:directory});
  server=app.server;
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const actualBase=`http://127.0.0.1:${server.address().port}`;
  let requestId=0;
  async function rpc(method,params){
    const response=await fetch(`${actualBase}/mcp/${secret}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params})});
    const data=await response.json();
    if(response.status!==200||data.error||data.result?.isError)throw Error(`MCP error: ${JSON.stringify(data)}`);
    return data.result.structuredContent ?? data.result;
  }
  const create=await rpc('tools/call',{name:'create_storyboard',arguments:{title:'تست رندر فارسی',format:'landscape',scenes:[{title:'ساخته‌شده با ChatGPT',duration:2,subtitle:'آزمون یکپارچه',theme:'midnight'}]}});
  await rpc('tools/call',{name:'render_video',arguments:{id:create.id}});
  let status;
  for(let i=0;i<100;i++){
    await new Promise(r=>setTimeout(r,250));
    status=await rpc('tools/call',{name:'video_status',arguments:{id:create.id}});
    if(['completed','failed'].includes(status.status))break;
  }
  if(status?.status!=='completed')throw Error(`Render did not complete: ${JSON.stringify(status)}`);
  // The signed URL contains the configured public origin; substitute only origin for local test server.
  const signedUrl=new URL(status.video_url);
  const response=await fetch(actualBase+signedUrl.pathname+signedUrl.search);
  if(!response.ok)throw Error('Signed MP4 URL failed.');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1024 || !bytes.subarray(4,8).equals(Buffer.from('ftyp')))throw Error('Invalid MP4 container.');
  const localFile=path.join(directory,'outputs',`${create.id}.mp4`);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1',localFile],{encoding:'utf8'});
  if(probe.status!==0)throw Error(`ffprobe failed: ${probe.stderr}`);
  console.log(`PASS: MCP -> render -> signed MP4 (${bytes.length} bytes). ${probe.stdout.trim()}`);
}catch(e){console.error(e);process.exitCode=1;}
finally{if(server)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
