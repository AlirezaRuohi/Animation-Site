import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { StudioStore, validBearer, signedPath, verifySignedPath } from './core.js';
import { RenderQueue } from './jobs.js';

const protocolVersion='2025-06-18';
const storyProperties={
  title:{type:'string',minLength:1,maxLength:120},format:{type:'string',enum:['landscape','portrait','square']},
  scenes:{type:'array',minItems:1,maxItems:10,items:{type:'object',required:['title','duration'],additionalProperties:false,properties:{
    title:{type:'string',minLength:1,maxLength:140},subtitle:{type:'string',maxLength:320},duration:{type:'integer',minimum:2,maximum:12},
    theme:{type:'string',enum:['midnight','light','sunset']},visual:{type:'string',enum:['headline','stats','product']},accent:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}
  }}}
};
const inputSchema={type:'object',required:['title','format','scenes'],properties:storyProperties,additionalProperties:false};
const idSchema={type:'object',required:['id'],properties:{id:{type:'string',format:'uuid'}},additionalProperties:false};
export const studioTools=[
  {name:'create_storyboard',title:'Create video storyboard',description:'Create a short code-rendered motion graphic (up to 60s). Discuss the scene text, durations and style with the user first; no paid model API or Claude account is needed.',annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},inputSchema},
  {name:'get_storyboard',title:'Read complete storyboard',description:'Get the full scene text and timings to review or prepare a revision.',annotations:{readOnlyHint:true,openWorldHint:false},inputSchema:idSchema},
  {name:'revise_storyboard',title:'Revise video storyboard',description:'Replace all storyboard scenes for an existing video ID. Get the current storyboard first. Does not render automatically.',annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},inputSchema:{type:'object',required:['id','title','format','scenes'],properties:{id:idSchema.properties.id,...storyProperties},additionalProperties:false}},
  {name:'render_video',title:'Render MP4',description:'Start a render job for an approved storyboard; requires CPU resources. Confirm the scene contents with the user before rendering.',annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},inputSchema:idSchema},
  {name:'video_status',title:'Get video status and download URLs',description:'Read render status; successful renders return short-lived signed video and image links.',annotations:{readOnlyHint:true,openWorldHint:false},inputSchema:idSchema},
  {name:'list_videos',title:'List recent videos',description:'List the latest storyboards and videos in this private single-owner studio.',annotations:{readOnlyHint:true,openWorldHint:false},inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
const duration=p=>p.scenes.reduce((sum,s)=>sum+s.duration,0);
function pub(p,base,token){
  const {id,title,format,revision,status,error,created_at,updated_at,scenes}=p;
  const result={id,title,format,revision,status,duration_seconds:duration(p),scene_count:scenes.length,created_at,updated_at};
  if(error)result.error=error;
  if(status==='completed'){
    result.video_url=base+signedPath(token,id,'mp4');
    result.preview_url=base+signedPath(token,id,'png');
  }
  return result;
}
function json(res,status,obj,headers={}){
  const data=JSON.stringify(obj);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers,'Content-Length':Buffer.byteLength(data)});
  res.end(data);
}
const rpcError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const rpcResult=(id,result)=>({jsonrpc:'2.0',id,result});
function parseBaseUrl(value){
  const u=new URL(value);
  if((u.protocol!=='https:' && !(u.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname))) || u.username || u.password || u.search || u.hash || u.pathname!=='/'){
    throw Error('PUBLIC_BASE_URL must be HTTPS (localhost HTTP allowed) with no path, credentials, query or fragment.');
  }
  return u.origin;
}

export async function createStudioServer(options={}){
  const port=Number(options.port ?? process.env.PORT ?? 8787);
  const token=options.token ?? process.env.STUDIO_TOKEN;
  const mcpAccessPath=options.mcpAccessPath ?? process.env.MCP_ACCESS_PATH ?? '';
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token))throw Error('STUDIO_TOKEN must be 64 random hex characters (openssl rand -hex 32).');
  if(mcpAccessPath && !/^[a-f0-9]{64}$/i.test(mcpAccessPath))throw Error('MCP_ACCESS_PATH must be 64 random hex characters (openssl rand -hex 32).');
  if(mcpAccessPath && mcpAccessPath===token)throw Error('STUDIO_TOKEN and MCP_ACCESS_PATH must be different.');
  const base=parseBaseUrl(options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${port}`);
  const store=options.store ?? new StudioStore(options.dataDir ?? process.env.DATA_DIR ?? './data',{maxProjects:options.maxProjects ?? Number(process.env.MAX_PROJECTS || 200)});
  if(!Number.isInteger(store.maxProjects)||store.maxProjects<1||store.maxProjects>100000)throw Error('Invalid MAX_PROJECTS');
  await store.init();
  const recovered=await store.recoverInterrupted();
  const maxOutputMB=options.maxOutputMB ?? Number(process.env.MAX_OUTPUT_MB || 2048);
  if(!Number.isInteger(maxOutputMB)||maxOutputMB<32||maxOutputMB>1000000)throw Error('Invalid MAX_OUTPUT_MB');
  const queue=options.queue ?? new RenderQueue(store,{maxOutputBytes:maxOutputMB*1024*1024});
  const allowedOrigins=new Set([base,new URL(base).origin,'https://chatgpt.com','https://chat.openai.com']);
  for(const origin of (options.allowedOrigins ?? process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').map(x=>x.trim()).filter(Boolean))allowedOrigins.add(origin);
  const windowMs=60_000,limit=options.rateLimit ?? Number(process.env.RATE_LIMIT_PER_MIN || 120);
  if(!Number.isInteger(limit)||limit<1||limit>10000)throw Error('Invalid RATE_LIMIT_PER_MIN');
  const buckets=new Map();
  function limited(req){
    const ip=req.socket.remoteAddress||'unknown',now=Date.now();
    if(buckets.size>1000)for(const [key,val] of buckets)if(val.expires<now)buckets.delete(key);
    const entry=buckets.get(ip);
    if(!entry||entry.expires<now){buckets.set(ip,{count:1,expires:now+windowMs});return false;}
    entry.count++;return entry.count>limit;
  }
  async function invoke(name,args={}){
    if(args===null||typeof args!=='object'||Array.isArray(args))throw Error('Tool arguments must be an object.');
    switch(name){
      case 'create_storyboard':return pub(await store.create(args),base,token);
      case 'get_storyboard': {const p=await store.get(args.id);return {id:p.id,revision:p.revision,status:p.status,title:p.title,format:p.format,scenes:p.scenes,duration_seconds:duration(p)};}
      case 'revise_storyboard': {const {id,...story}=args;return pub(await store.update(id,story),base,token);}
      case 'render_video':return await queue.enqueue(args.id);
      case 'video_status':return pub(await store.get(args.id),base,token);
      case 'list_videos':return {videos:await store.list()};
      default:throw Error(`Unknown tool: ${name}`);
    }
  }
  async function handleRpc(req,res){
    let size=0,chunks=[];
    for await(const chunk of req){
      size+=chunk.length;
      if(size>128*1024){json(res,413,rpcError(null,-32600,'Request too large.'));return;}
      chunks.push(chunk);
    }
    let msg;
    try{msg=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(res,400,rpcError(null,-32700,'Parse error'));return;}
    if(!msg||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'||(msg.id!==undefined && typeof msg.id!=='string' && typeof msg.id!=='number')){
      json(res,400,rpcError(msg?.id??null,-32600,'Invalid request'));return;
    }
    if(msg.id===undefined){res.writeHead(202,{'Cache-Control':'no-store'});res.end();return;}
    const id=msg.id;
    try{
      let result;
      switch(msg.method){
        case 'initialize':result={protocolVersion,capabilities:{tools:{listChanged:false}},serverInfo:{name:'chat-video-studio',version:'0.2.0'}};break;
        case 'ping':result={};break;
        case 'tools/list':result={tools:studioTools};break;
        case 'tools/call':{
          if(!msg.params||typeof msg.params.name!=='string'){json(res,200,rpcError(id,-32602,'Tool name missing'));return;}
          try{const out=await invoke(msg.params.name,msg.params.arguments??{});result={content:[{type:'text',text:JSON.stringify(out)}],structuredContent:out,isError:false};}
          catch(e){result={content:[{type:'text',text:e.message}],isError:true};}
          break;
        }
        default:json(res,200,rpcError(id,-32601,'Method not found'));return;
      }
      json(res,200,rpcResult(id,result));
    }catch{json(res,500,rpcError(id,-32603,'Internal server error'));}
  }
  const server=createServer(async(req,res)=>{
    try{
      if(limited(req))return json(res,429,{error:'Rate limit exceeded.'},{'Retry-After':'60'});
      const origin=req.headers.origin;
      if(origin && !allowedOrigins.has(origin))return json(res,403,{error:'Origin not allowed.'});
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'chat-video-studio',version:'0.2.0'});
      const match=/^\/downloads\/([0-9a-f-]{36})\.(mp4|png)$/i.exec(url.pathname);
      if(match&&req.method==='GET'){
        if(!verifySignedPath(token,url.pathname,url.searchParams.get('expires'),url.searchParams.get('sig')))
          return json(res,403,{error:'Download link expired or invalid.'});
        const [,id,ext]=match,p=await store.get(id);
        if(p.status!=='completed')return json(res,404,{error:'Video not ready.'});
        const file=path.join(store.dir,'outputs',`${id}.${ext}`),info=await stat(file);
        res.writeHead(200,{'Content-Type':ext==='mp4'?'video/mp4':'image/png','Content-Length':info.size,'Content-Disposition':`attachment; filename="${id}.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
        createReadStream(file).on('error',()=>res.destroy()).pipe(res);return;
      }
      const allowedSecretPath=mcpAccessPath&&url.pathname===`/mcp/${mcpAccessPath}`;
      if(url.pathname!=='/mcp'&&!allowedSecretPath)return json(res,404,{error:'Not found.'});
      if(!allowedSecretPath&&!validBearer(req.headers.authorization,token)){
        res.writeHead(401,{'WWW-Authenticate':'Bearer realm="chat-video-studio"','Cache-Control':'no-store'});return res.end();
      }
      if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'},{Allow:'POST'});
      return await handleRpc(req,res);
    }catch(e){if(!res.headersSent)json(res,500,{error:'Internal server error.'});else res.destroy();}
  });
  return {server,store,queue,recovered,publicBaseUrl:base,port};
}
