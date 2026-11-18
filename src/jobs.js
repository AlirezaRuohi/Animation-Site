import { spawn } from 'node:child_process';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';

export class RenderQueue {
  constructor(store, opts = {}) { this.store=store; this.current=null; this.queue=[]; this.python=opts.python||'python3'; this.renderer=opts.renderer||path.resolve('renderer/render.py'); }
  async enqueue(id) {
    const project = await this.store.get(id);
    if (project.status === 'queued' || project.status === 'rendering') throw Error('Render already in progress.');
    if (this.queue.length >= 3) throw Error('Render queue full. Try later.');
    project.status='queued'; project.error=null; project.updated_at=new Date().toISOString();
    await this.store.save(project);
    this.queue.push(id);
    queueMicrotask(() => this.runNext());
    return { id, status:'queued', queue_position:this.queue.length };
  }
  async runNext() {
    if (this.current || !this.queue.length) return;
    const id=this.queue.shift(); this.current=id;
    try {
      const project=await this.store.get(id);
      project.status='rendering'; project.updated_at=new Date().toISOString(); await this.store.save(project);
      const folder=path.join(this.store.dir,'work',id);
      await mkdir(folder,{recursive:true});
      const output=path.join(this.store.dir,'outputs',`${id}.mp4`);
      const png=path.join(this.store.dir,'outputs',`${id}.png`);
      await this.execute([this.renderer, this.store.file(id), folder, output, png]);
      await access(output); await access(png);
      const latest=await this.store.get(id); latest.status='completed'; latest.error=null; latest.updated_at=new Date().toISOString(); await this.store.save(latest);
    } catch(e) {
      try { const p=await this.store.get(id); p.status='failed'; p.error=String(e.message).slice(0,500); p.updated_at=new Date().toISOString(); await this.store.save(p); } catch{}
    } finally { this.current=null; queueMicrotask(()=>this.runNext()); }
  }
  execute(args) { return new Promise((resolve,reject)=>{
    const child=spawn(this.python,args,{stdio:['ignore','ignore','pipe'],env:process.env});
    let error=''; const timer=setTimeout(()=>child.kill('SIGKILL'),180000);
    child.stderr.on('data',data=> { error=(error+data.toString()).slice(-2500); });
    child.on('error', err=>{clearTimeout(timer);reject(err);});
    child.on('exit',(code)=>{ clearTimeout(timer); code===0 ? resolve() : reject(new Error(`Renderer exited ${code}: ${error || 'timeout'}`)); });
  }); }
}
