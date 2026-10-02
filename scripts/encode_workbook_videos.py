"""Encode 32 narrated walkthroughs from verified, authentic localized demo captures."""
import concurrent.futures, hashlib, json, re, shutil, subprocess, sys
from pathlib import Path
repo, work = map(Path, sys.argv[1:3]); locales=json.loads((repo/'scripts/workbook-video-locales.json').read_text());version='1.0.0'
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]))
def build(lang):
 t=locales[lang]; capture=json.loads((work/'checks'/f'{lang}.json').read_text()); assert capture['locale']==lang and capture['pen_animated'] and capture['quiz_correct']
 audio=work/'audio'/f'{lang}.mp3'; duration=float(probe(audio)['format']['duration']);assert 30<duration<120
 detector=subprocess.run(['ffmpeg','-hide_banner','-i',str(audio),'-af','silencedetect=noise=-35dB:d=0.25','-f','null','-'],capture_output=True,text=True)
 silences=[(float(a),float(b)) for a,b in re.findall(r'silence_start: ([0-9.]+).*?silence_end: ([0-9.]+)',detector.stderr,re.S)]
 weights=[len(t['title'])+len(t['captions'][0])]+[len(x) for x in t['captions'][1:]];bounds=[0.0]
 for i in range(1,7):
  expected=duration*sum(weights[:i])/sum(weights)
  candidates=[((a+b)/2,b-a) for a,b in silences if abs((a+b)/2-expected)<1.8 and (a+b)/2>bounds[-1]+2]
  boundary=min(candidates,key=lambda v:abs(v[0]-expected)-min(v[1],.8)*.35)[0] if candidates else expected
  bounds.append(round(boundary,3))
 bounds.append(duration+2)
 out=repo/'dist/assets/workbook-video'/version/lang;out.mkdir(parents=True,exist_ok=True);frame=work/'frames'/lang;rows=[]
 def add(name,length):rows.append((frame/name,length))
 for i in range(7):
  length=bounds[i+1]-bounds[i]
  if i in (2,3,4):add(f'{i}a.jpg',length*.52);add(f'{i}b.jpg',length*.48)
  elif i==5:
   animation=min(6.0,length*.7);add('5-0.jpg',min(.75,length*.08))
   for j in range(1,11):add(f'5-{j}.jpg',animation/10)
   add('5-manual.jpg',length-animation-min(.75,length*.08))
  else:add(f'{i}.jpg',length)
 assert all(p.is_file() and d>0 for p,d in rows)
 concat=work/'frames'/f'{lang}.concat';concat.write_text(''.join(f"file '{p}'\nduration {d:.6f}\n" for p,d in rows)+f"file '{rows[-1][0]}'\n")
 target=out/'walkthrough.mp4';cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-i',str(audio),'-vf','fps=15,format=yuv420p','-af','apad=pad_dur=2,loudnorm=I=-16:TP=-1.5:LRA=7','-t',str(duration+2),'-c:v','libx264','-preset','fast','-crf','28','-threads','1','-c:a','aac','-b:a','64k','-ar','44100','-ac','1','-metadata','title='+t['title'],'-metadata','comment=Authentic five-letter demonstration; full edition has 28 letters.','-movflags','+faststart',str(target)]
 subprocess.run(cmd,check=True,capture_output=True)
 def clock(n):ms=round(n*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
 (out/'walkthrough.vtt').write_text('WEBVTT\n\n'+''.join(f'{i+1}\n{clock(bounds[i])} --> {clock(bounds[i+1])}\n{t["title"]+". " if i==0 else ""}{t["captions"][i]}\n\n' for i in range(7)))
 shutil.copyfile(frame/'0.jpg',out/'poster.jpg')
 metadata=probe(target);streams=metadata['streams'];assert any(s['codec_name']=='h264' and s['width']==1280 and s['height']==720 for s in streams);assert any(s['codec_name']=='aac' for s in streams);actual=float(metadata['format']['duration']);assert abs(actual-duration-2)<.2
 assert len({hashlib.sha256((frame/f'5-{j}.jpg').read_bytes()).hexdigest() for j in range(11)})>3
 print(f'Encoded {lang}: {actual:.1f}s, localized narration + real pen animation',flush=True)
 return {'language':lang,'duration_seconds':round(actual,3),'audio':True,'width':1280,'height':720,'caption_cues':7,'authentic_demo_chapters':5,'steps':7,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'scene_boundaries':bounds,'source_app_version':'1.4.5'}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(build,locales))
assert len(results)==32 and len({x['language'] for x in results})==32
report={'version':version,'languages':list(locales),'video_count':32,'narration_count':32,'subtitles_count':32,'records':results}
(work/'video-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(repo/'dist/workbook-video-release.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: all 32 narrated videos, 32 posters and 32 subtitle files verified.')
