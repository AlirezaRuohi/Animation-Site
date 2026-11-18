#!/usr/bin/env python3
"""Deterministic code-rendered promotional videos. No model/API key required.

Usage: python3 renderer/render.py PROJECT_JSON WORK_DIR OUTPUT_MP4 PREVIEW_PNG
"""
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features

THEMES = {
    'midnight': ((8, 17, 37), (25, 43, 70), (238, 245, 255)),
    'light': ((239, 245, 252), (215, 229, 246), (15, 30, 51)),
    'sunset': ((39, 22, 42), (92, 39, 66), (255, 244, 236)),
}


def find_font(size, bold=False):
    # Noto Sans Arabic is present in the Docker image and can shape Persian correctly
    roots = [
        '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf' if bold else '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ]
    for fp in roots:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()


def is_rtl(txt):
    return bool(re.search(r'[\u0590-\u08ff]', txt))


def draw_text(draw, xy, content, font, fill, rtl=False, anchor=None):
    kw = {'font': font, 'fill': fill}
    if rtl and features.check('raqm'):
        kw['direction'] = 'rtl'
    if anchor:
        kw['anchor'] = anchor
    draw.text(xy, content, **kw)


def measure(draw, value, font):
    box = draw.textbbox((0, 0), value, font=font, direction='rtl' if is_rtl(value) and features.check('raqm') else None)
    return box[2] - box[0]


def wrap(draw, txt, font, max_width, max_lines=3):
    if not txt:
        return []
    words = txt.split()
    if not words:
        return []
    out, current = [], ''
    for word in words:
        candidate = f'{current} {word}'.strip()
        if current and measure(draw, candidate, font) > max_width:
            out.append(current)
            current = word
        else:
            current = candidate
    if current:
        out.append(current)
    if len(out) > max_lines:
        out = out[:max_lines]
        # trim final line so ellipsis fits
        out[-1] += '…'
        while len(out[-1]) > 2 and measure(draw, out[-1], font) > max_width:
            out[-1] = out[-3] + '…'
    return out


def gradient(w, h, start, end):
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round((1-t)*a + t*b) for a, b in zip(start, end))
        d.line((0, y, w, y), fill=c)
    return im


def accent_rgb(value):
    return tuple(int(value[i:i+2],16) for i in (1,3,5))


def scene_image(project, scene, number):
    w, h = project['width'], project['height']
    base, lower, foreground = THEMES[scene['theme']]
    accent = accent_rgb(scene['accent'])
    im = gradient(w, h, base, lower)
    draw = ImageDraw.Draw(im)
    scale = min(w/1280, h/720)
    pad = int(70*max(scale, .7))
    # Depth and subtle geometry
    draw.ellipse((int(.64*w), int(-.31*h), int(1.35*w), int(.87*h)), outline=(*accent,), width=max(2,int(4*scale)))
    draw.ellipse((int(.74*w), int(-.14*h), int(1.18*w), int(.64*h)), outline=tuple(int(v*.43 + base[i]*.57) for i,v in enumerate(accent)), width=max(2,int(3*scale)))
    draw.rounded_rectangle((pad, pad, pad + int(45*scale), pad + int(7*scale)), radius=3, fill=accent)
    badge_font = find_font(max(17,int(21*scale)),True)
    draw_text(draw,(pad, pad+int(22*scale)), project['title'][:70],badge_font,foreground,is_rtl(project['title']))
    draw_text(draw,(w-pad, pad+int(18*scale)), f'{number+1:02d} / {len(project["scenes"]):02d}',badge_font,foreground,anchor='ra')
    area_top = int(.27*h)
    title_size = max(34,int(min(76*scale, h*.093)))
    if len(scene['title']) > 38: title_size = int(title_size*.81)
    title_font = find_font(title_size,True)
    subtitle_font = find_font(max(21,int(31*scale)))
    maxtext = w - 2*pad
    if scene['visual'] == 'stats':
        # A large figure or key phrase in the original scene text
        title_size = min(int(112*scale), int(h*.16))
        title_font = find_font(max(42,title_size),True)
    if scene['visual'] == 'product':
        # Stylized product/UI hero: genuine code shapes; not a screenshot of a real product
        panel=(int(w*.55),int(h*.28),int(w*.90),int(h*.77))
        draw.rounded_rectangle(panel, radius=int(18*scale), fill=(38,54,81) if scene['theme']!='light' else (246,248,253), outline=accent, width=max(2,int(3*scale)))
        draw.rounded_rectangle((panel[0]+int(20*scale),panel[1]+int(20*scale),panel[2]-int(20*scale),panel[1]+int(64*scale)), radius=7, fill=accent)
        for i in range(4):
            yy=panel[1]+int((94+57*i)*scale)
            draw.rounded_rectangle((panel[0]+int(23*scale),yy,panel[2]-int((40+16*(i%2))*scale),yy+int(13*scale)), radius=5,fill=(126,148,171) if scene['theme']!='light' else (107,129,158))
        maxtext=int(w*.46)
    title_lines = wrap(draw,scene['title'],title_font,maxtext,3)
    if len(title_lines)>2 and scene['visual']!='stats':
        title_font=find_font(max(29,int(title_size*.75)),True)
        title_lines=wrap(draw,scene['title'],title_font,maxtext,3)
    line_step=int(title_font.size*1.38)
    rtl=is_rtl(scene['title'])
    text_x=w-pad if rtl else pad
    # Anchor deliberately uses ra for RTL display, la for English
    for n,line in enumerate(title_lines):
        draw_text(draw,(text_x,area_top+n*line_step),line,title_font,foreground,is_rtl(line),anchor='ra' if rtl else 'la')
    subtitle_y=area_top+len(title_lines)*line_step+int(26*scale)
    subs=wrap(draw,scene.get('subtitle',''),subtitle_font,maxtext,4)
    for n,line in enumerate(subs):
        draw_text(draw,(w-pad if is_rtl(line) else pad,subtitle_y+n*int(subtitle_font.size*1.6)),line,subtitle_font,foreground,is_rtl(line),anchor='ra' if is_rtl(line) else 'la')
    # Progress line along bottom
    y=h-int(52*scale)
    draw.rounded_rectangle((pad,y,w-pad,y+max(4,int(6*scale))),radius=4,fill=tuple((c+b)//2 for c,b in zip(base,lower)))
    draw.rounded_rectangle((pad,y,pad+int((w-2*pad)*(number+1)/len(project['scenes'])),y+max(4,int(6*scale))),radius=4,fill=accent)
    return im


def render(project_path, work_dir, mp4_path, png_path):
    project=json.loads(Path(project_path).read_text(encoding='utf-8'))
    scenes=project['scenes']
    if not (1<=len(scenes)<=10): raise ValueError('Invalid scene count')
    if sum(s['duration'] for s in scenes)>60: raise ValueError('Duration over 60 seconds')
    work=Path(work_dir); work.mkdir(parents=True,exist_ok=True)
    Path(mp4_path).parent.mkdir(parents=True,exist_ok=True)
    w,h=int(project['width']),int(project['height'])
    for i,scene in enumerate(scenes):
        im=scene_image(project,scene,i)
        im.save(work/f'scene-{i:02d}.png')
        if i==0:
            im.thumbnail((960,960))
            im.save(png_path)
    args=['ffmpeg','-hide_banner','-loglevel','error','-y']
    for i,scene in enumerate(scenes):
        args += ['-loop','1','-framerate','24','-t',str(scene['duration']),'-i',str(work/f'scene-{i:02d}.png')]
    filters=[]; inputs=[]
    for i,s in enumerate(scenes):
        # Very subtle push-in on each shot to make a motion-graphics video, no external assets
        filters.append(f"[{i}:v]zoompan=z='min(zoom+0.0004,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={w}x{h}:fps=24,trim=duration={s['duration']},setpts=PTS-STARTPTS,format=yuv420p[v{i}]")
        inputs.append(f'[v{i}]')
    filters.append(''.join(inputs)+f'concat=n={len(scenes)}:v=1:a=0[outv]')
    args += ['-filter_complex',';'.join(filters),'-map','[outv]','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','-an',str(mp4_path)]
    subprocess.run(args,check=True,timeout=170)


if __name__=='__main__':
    if len(sys.argv)!=5:
        print(__doc__,file=sys.stderr);sys.exit(2)
    try: render(*sys.argv[1:])
    except Exception as e:
        print(f'Render failed: {e}',file=sys.stderr)
        sys.exit(1)
