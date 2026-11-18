#!/usr/bin/env node
// Server-independent workflow: write storyboard JSON with ChatGPT, then render locally.
import { mkdtemp, readFile, writeFile, rm, mkdir, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { validateStory } from './core.js';

const args=process.argv.slice(2);
if(args.length<1||args.length>2){console.error('Usage: npm run render:local -- <storyboard.json> [output.mp4]');process.exit(2);}
const [input,output='video.mp4']=args;
const work=await mkdtemp(path.join(os.tmpdir(),'chat-video-'));
try{
  const story=validateStory(JSON.parse(await readFile(input,'utf8')));
  await mkdir(path.dirname(path.resolve(output)),{recursive:true});
  const clean=path.join(work,'story.json');await writeFile(clean,JSON.stringify(story));
  const preview=path.join(work,'preview.png');
  const child=spawn('python3',[path.resolve('renderer/render.py'),clean,work,path.resolve(output),preview],{stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  if(code!==0)throw Error(`Renderer failed with exit code ${code}`);
  const previewDest=path.resolve(output).replace(/\.mp4$/i,'')+'-preview.png';
  await copyFile(preview,previewDest);
  console.log(`MP4: ${path.resolve(output)}\nPreview: ${previewDest}`);
}catch(e){console.error(e.message);process.exitCode=1;}
finally{await rm(work,{recursive:true,force:true});}
