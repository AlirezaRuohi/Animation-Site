import { spawn } from 'node:child_process';
import { mkdir, access, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export class RenderQueue {
  constructor(store, opts = {}) {
    this.store=store; this.current=null; this.queue=[]; this.pending=new Set();
    this.python=opts.python||'python3'; this.renderer=opts.renderer||path.resolve('renderer/render.py');
    this.maxOutputBytes=opts.maxOutputBytes ?? 2*1024**3;
  }
  async enqueue(id) {
    // Reserve synchronously before async file operations so concurrent calls cannot enqueue the same ID.
    if (this.pending.has(id)) throw Error('Render already in progress.');
    this.pending.add(id);
    try {
      const project = await this.store.get(id);
      if (project.status === 'queued' || project.status === 'rendering') throw Error('Render already in progress.');
      if (this.queue.length >= 3) throw Error('Render queue full. Try later.');
      if ((await this.store.outputBytes()) >= this.maxOutputBytes) throw Error('Output storage limit reached. Clean up old videos before rendering.');
      project.status='queued'; project.error=null; project.updated_at=new Date().toISOString();
      await this.store.save(project);
      this.queue.push(id);
      queueMicrotask(() => this.runNext());
      return { id, status:'queued', queue_position:this.queue.length };
    } catch(e) { this.pending.delete(id); throw e; }
  }
  async runNext() {
    if (this.current || !this.queue.length) return;
    const id=this.queue.shift(); this.current=id;
    const folder=path.join(this.store.dir,'work',id);
    const tempMp4=path.join(folder,'output.mp4'),tempPng=path.join(folder,'preview.png');
    try {
      const project=await this.store.get(id);
      project.status='rendering'; project.updated_at=new Date().toISOString(); await this.store.save(project);
      await mkdir(folder,{recursive:true});
      await this.execute([this.renderer, this.store.file(id), folder, tempMp4, tempPng]);
      await access(tempMp4); await access(tempPng);
      await rename(tempMp4,path.join(this.store.dir,'outputs',`${id}.mp4`));
      await rename(tempPng,path.join(this.store.dir,'outputs',`${id}.png`));
      const latest=await this.store.get(id); latest.status='completed'; latest.error=null; latest.updated_at=new Date().toISOString(); await this.store.save(latest);
    } catch(e) {
      try { const p=await this.store.get(id); p.status='failed'; p.error=String(e.message).slice(0,500); p.updated_at=new Date().toISOString(); await this.store.save(p); } catch{}
    } finally {
      await rm(folder,{recursive:true,force:true}).catch(()=>{});
      this.pending.delete(id); this.current=null; queueMicrotask(()=>this.runNext());
    }
  }
  execute(args) { return new Promise((resolve,reject)=>{
    const child=spawn(this.python,args,{stdio:['ignore','ignore','pipe'],env:process.env});
    let error='',timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},180000);
    child.stderr.on('data',data=> { error=(error+data.toString()).slice(-2500); });
    child.on('error', err=>{clearTimeout(timer);reject(err);});
    child.on('exit',(code)=>{ clearTimeout(timer); code===0 ? resolve() : reject(new Error(timedOut?'Renderer timed out.':`Renderer exited ${code}: ${error || 'unknown error'}`)); });
  }); }
}
