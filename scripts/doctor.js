import { spawnSync } from 'node:child_process';
const checks=[
 ['Node.js >=20',Number(process.versions.node.split('.')[0])>=20],
 ['FFmpeg and H.264 encoder',(()=>{const p=spawnSync('ffmpeg',['-hide_banner','-encoders'],{encoding:'utf8'});return p.status===0 && /libx264/.test(p.stdout);})()],
 ['Python Pillow with RAQM (RTL text)',spawnSync('python3',['-c','from PIL import Image, ImageFont, features; assert features.check("raqm")'],{encoding:'utf8'}).status===0],
 ['Arabic/Persian font available',spawnSync('python3',['-c',`from PIL import ImageFont\nimport os\nassert any(os.path.exists(p) for p in ['/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'])`],{encoding:'utf8'}).status===0],
];
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(checks.some(([,ok])=>!ok))process.exitCode=1;
