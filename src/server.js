import { createStudioServer } from './app.js';

try {
  const {server,port,recovered}=await createStudioServer();
  server.listen(port,process.env.HOST || '0.0.0.0',()=>{
    console.log(`Chat Video Studio v0.2.0 listening on port ${port}; ${recovered} interrupted jobs marked failed.`);
    // Deliberately never log MCP_ACCESS_PATH or STUDIO_TOKEN.
  });
  process.on('SIGTERM',()=>server.close());
  process.on('SIGINT',()=>server.close());
}catch(e){console.error('Startup error:',e.message);process.exitCode=1;}
