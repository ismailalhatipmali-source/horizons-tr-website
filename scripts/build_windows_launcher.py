#!/usr/bin/env python3
"""Build a per-user NSIS installer using official MinGW/NSIS tools."""
import hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
tools=Path(os.environ.get('HORIZONS_WINDOWS_TOOLS','/tmp/horizons-windows-tools/root/usr'))
gcc=tools/'bin/x86_64-w64-mingw32-gcc-posix';windres=tools/'bin/x86_64-w64-mingw32-windres';nsis=tools/'bin/makensis'
env=dict(os.environ,PATH=str(tools/'bin')+':'+os.environ['PATH'],NSISDIR=str(tools/'share/nsis'))
out=ROOT/'release-assets/windows-1.5.0';out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='horizons-windows-') as tmp:
    tmp=Path(tmp)
    for p in (ROOT/'src/windows').iterdir():shutil.copyfile(p,tmp/p.name)
    Image.open(ROOT/'src/workbook-web/icons/icon-512.png').save(tmp/'app.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    # The Debian toolchain's default gcc alias is not installed system-wide.
    subprocess.run([str(windres),'--preprocessor='+str(gcc),'--preprocessor-arg=-E','--preprocessor-arg=-xc','--preprocessor-arg=-DRC_INVOKED','-I'+str(tmp),str(tmp/'launcher.rc'),str(tmp/'resources.o')],env=env,cwd=tmp,check=True)
    subprocess.run([str(gcc),'-Os','-s','-municode','-mwindows','-Wl,--nxcompat,--dynamicbase,--high-entropy-va','launcher.c','resources.o','-lshell32','-o','Horizons-Arabic.exe'],env=env,cwd=tmp,check=True)
    subprocess.run([str(nsis),'-V2','setup.nsi'],env=env,cwd=tmp,check=True)
    for name in ['HORIZONS-Arabic-Setup-1.5.0.exe','Horizons-Arabic.exe','app.ico']:shutil.copyfile(tmp/name,out/name)
info={'version':'1.5.0','type':'browser-workbook-launcher','platform':'Windows x64','url':'https://horizons-tr.com/learn/','authenticode_signed':False,'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.iterdir()) if p.suffix in ('.exe','.ico')}}
(out/'build-report.json').write_text(json.dumps(info,indent=2)+'\n');print(json.dumps(info,indent=2))
