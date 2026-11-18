import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { StudioStore, validBearer, signedPath, verifySignedPath, validateStory } from './core.js';
import { RenderQueue } from './jobs.js';

const port = Number(process.env.PORT || 8787);
const token = process.env.STUDIO_TOKEN;
const mcpAccessPath = process.env.MCP_ACCESS_PATH || '';
if (mcpAccessPath && !/^[A-Za-z0-9_-]{32,128}$/.test(mcpAccessPath)) { console.error('MCP_ACCESS_PATH must be a random URL-safe token, 32–128 characters.'); process.exit(1); }
const base = (process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
if (!token || token.length < 24) { console.error('Set STUDIO_TOKEN to a randomly generated secret at least 24 characters long.'); process.exit(1); }
const store = new StudioStore(process.env.DATA_DIR || './data'); await store.init();
const render = new RenderQueue(store);
const protocolVersion = '2025-06-18';
const inputSchema = { type:'object', required:['title','format','scenes'], additionalProperties:false, properties:{
  title:{type:'string',minLength:1,maxLength:120}, format:{type:'string',enum:['landscape','portrait','square']},
  scenes:{type:'array',minItems:1,maxItems:10,items:{type:'object',required:['title','duration'],additionalProperties:false,properties:{
    title:{type:'string',minLength:1,maxLength:140},subtitle:{type:'string',maxLength:320},duration:{type:'integer',minimum:2,maximum:12},theme:{type:'string',enum:['midnight','light','sunset']},visual:{type:'string',enum:['headline','stats','product']},accent:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}
  }}}
}};
const tools = [
 {name:'create_storyboard',description:'Save a structured storyboard for a short video. First collaborate with user on scene text, timing and colors. ChatGPT writes all content; NO Claude or OpenAI API key required. Total runtime up to 60 s.',inputSchema},
 {name:'revise_storyboard',description:'Replace the storyboard for an existing project; preserve its ID and increment revision. Requires complete storyboard.',inputSchema:{type:'object',required:['id','title','format','scenes'],properties:{id:{type:'string'},...inputSchema.properties},additionalProperties:false}},
 {name:'render_video',description:'Render a saved storyboard to an MP4 video. This starts an asynchronous FFmpeg job on the connected worker; call video_status later.',inputSchema:{type:'object',required:['id'],properties:{id:{type:'string'}},additionalProperties:false}},
 {name:'video_status',description:'Read current render status and obtain temporary signed MP4 and PNG preview download links when completed.',inputSchema:{type:'object',required:['id'],properties:{id:{type:'string'}},additionalProperties:false}},
 {name:'list_videos',description:'List recent storyboards and completed videos.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
const duration = v => v.scenes.reduce((n,s)=>n+s.duration,0);
function published(project) {
 const {id,title,format,revision,status,error,created_at,updated_at,scenes}=project;
 const result={id,title,format,revision,status,duration_seconds:duration(project),scene_count:scenes.length,created_at,updated_at};
 if (error) result.error=error;
 if(status==='completed') {
  result.video_url=base+signedPath(token,id,'mp4'); result.preview_url=base+signedPath(token,id,'png');
 }
 return result;
}
async function invoke(name,args={}) {
 switch(name) {
 case 'create_storyboard': return published(await store.create(args));
 case 'revise_storyboard': { const {id,...storyboard}=args; return published(await store.update(id,storyboard)); }
 case 'render_video': return await render.enqueue(args.id);
 case 'video_status': return published(await store.get(args.id));
 case 'list_videos': return {videos:await store.list()};
 default: throw Error(`Unknown tool: ${name}`);
 }
}
function json(res,status,obj){ const data=JSON.stringify(obj); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(data)}); res.end(data); }
function rpcError(id,code,message) {return {jsonrpc:'2.0',id,error:{code,message}};}
function rpcResult(id,result){return {jsonrpc:'2.0',id,result};}
async function handleRpc(req,res) {
 let buf=''; for await(const chunk of req) {buf+=chunk; if(Buffer.byteLength(buf)>128*1024) { json(res,413,{error:'Request too large.'}); return; }}
 let msg; try {msg=JSON.parse(buf);} catch { json(res,400,rpcError(null,-32700,'Parse error')); return; }
 if(!msg || Array.isArray(msg) || typeof msg.method!=='string') {json(res,400,rpcError(msg?.id??null,-32600,'Invalid request'));return;}
 if(msg.id === undefined) {res.writeHead(202);res.end();return;}
 const id=msg.id;
 try {
  let result;
  switch(msg.method) {
  case 'initialize': result={protocolVersion,capabilities:{tools:{listChanged:false}},serverInfo:{name:'chat-video-studio',version:'0.1.0'}};break;
  case 'ping': result={};break;
  case 'tools/list': result={tools};break;
  case 'tools/call': {
   if(!msg.params || typeof msg.params.name !== 'string') {json(res,200,rpcError(id,-32602,'Tool name missing'));return;}
   try { const out=await invoke(msg.params.name,msg.params.arguments||{}); result={content:[{type:'text',text:JSON.stringify(out)}],structuredContent:out,isError:false}; }
   catch(e){ result={content:[{type:'text',text:e.message}],isError:true}; }
   break;
  }
  default:json(res,200,rpcError(id,-32601,'Method not found'));return;
  }
  json(res,200,rpcResult(id,result));
 } catch(e) {json(res,500,rpcError(id,-32603,'Internal server error'));}
}
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET' && url.pathname==='/health') return json(res,200,{ok:true,service:'chat-video-studio'});
  const download=/^\/downloads\/([a-f0-9-]+)\.(mp4|png)$/.exec(url.pathname);
  if(download && req.method==='GET') {
   if(!verifySignedPath(token,url.pathname,url.searchParams.get('expires'),url.searchParams.get('sig'))) return json(res,403,{error:'Download link expired or invalid.'});
   const [,id,ext]=download; const project=await store.get(id);
   if(project.status!=='completed')return json(res,404,{error:'Video not ready.'});
   const file=path.join(store.dir,'outputs',`${id}.${ext}`);
   const info=await stat(file);
   res.writeHead(200,{'Content-Type':ext==='mp4'?'video/mp4':'image/png','Content-Length':info.size,'Content-Disposition':`attachment; filename="${id}.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
   createReadStream(file).pipe(res);return;
  }
  const pathAllowsChatGPT = mcpAccessPath && url.pathname === `/mcp/${mcpAccessPath}`;
  if(url.pathname !== '/mcp' && !pathAllowsChatGPT) return json(res,404,{error:'Not found.'});
  if(!pathAllowsChatGPT && !validBearer(req.headers.authorization,token)) {res.writeHead(401,{'WWW-Authenticate':'Bearer realm="chat-video-studio"'});return res.end();}
  if(req.method==='GET') {res.writeHead(405,{'Allow':'POST'});return res.end();}
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  await handleRpc(req,res);
 } catch(e) {if(!res.headersSent)json(res,500,{error:'Internal error.'});else res.destroy();}
});
server.listen(port,'0.0.0.0',()=>console.log('Chat Video Studio MCP is running (private endpoint details are intentionally not logged).'));
