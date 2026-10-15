import struct, json, hashlib, os, re, subprocess, copy, tempfile, sys
from pathlib import Path
from zipfile import ZipFile
baseline, output = [Path(value).resolve() for value in sys.argv[1:3]]
root=output.parent; tools=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
u16=lambda d,p:struct.unpack_from('<H',d,p)[0]
u32=lambda d,p:struct.unpack_from('<I',d,p)[0]
sha=lambda b:hashlib.sha256(b).hexdigest()
def renamed(s):
 return s.replace('5.0.0-dev.2-R101','5.0.0').replace('R101 開發測試版','v5.0.0 正式版').replace('SalaryMate 開發版','SalaryMate v5.0.0 正式版').replace('v${APP_VERSION} · 開發測試版','v${APP_VERSION} · 正式版').replace('<span>v5.0.0</span>','<span>v5.0.0 正式版</span>')
def pool(d):
 assert u16(d,0)==1 and u16(d,2)==28
 count,styles,flags,start,sty=struct.unpack_from('<5I',d,8);strings=[]
 def length(p,utf8):
  v=d[p] if utf8 else u16(d,p);step=1 if utf8 else 2;mask=128 if utf8 else 32768
  return (((v&(mask-1))<<(8 if utf8 else 16))+(d[p+step] if utf8 else u16(d,p+step)),p+2*step) if v&mask else (v,p+step)
 for i in range(count):
  p=start+u32(d,28+4*i)
  if flags&256:
   _,p=length(p,True);n,p=length(p,True);s=d[p:p+n].decode('utf8')
  else:n,p=length(p,False);s=d[p:p+2*n].decode('utf-16le')
  strings.append(s)
 updated=[renamed(s) for s in strings]
 if strings==updated:return d,strings
 def ln(n,utf8):
  if utf8:return bytes([n]) if n<128 else bytes([(n>>8)|128,n&255])
  return struct.pack('<H',n) if n<32768 else struct.pack('<HH',(n>>16)|32768,n&65535)
 data=bytearray();offsets=[]
 for s in updated:
  offsets.append(len(data));b=s.encode('utf8' if flags&256 else 'utf-16le');n=len(s.encode('utf-16le'))//2
  data+=ln(n,bool(flags&256))+(ln(len(b),True) if flags&256 else b'')+b+(b'\0' if flags&256 else b'\0\0')
 data+=bytes((-len(data))%4)
 h=bytearray(d[:start]);struct.pack_into('<I',h,4,start+len(data)+(len(d)-sty if sty else 0));struct.pack_into('<I',h,24,start+len(data) if sty else 0)
 for i,p in enumerate(offsets):struct.pack_into('<I',h,28+4*i,p)
 return bytes(h+data+(d[sty:] if sty else b'')),updated

def binary(d,manifest=False):
 hdr=u16(d,2);out=bytearray(d[:hdr]);p=hdr;strings=[];code=0
 while p<len(d):
  size=u32(d,p+4);assert size>=8 and p+size<=len(d);chunk=d[p:p+size];kind=u16(chunk,0)
  if kind==1:chunk,strings=pool(chunk)
  elif manifest and kind==0x102:
   c=bytearray(chunk);a=16+u16(c,24);step=u16(c,26);count=u16(c,28)
   for i in range(count):
    q=a+i*step;name=strings[u32(c,q+4)]
    if name=='versionCode':
     assert c[q+15]==0x10 and u32(c,q+16)==5000101;struct.pack_into('<I',c,q+16,5000102);code+=1
   chunk=bytes(c)
  out+=chunk;p+=size
 assert not manifest or code==1
 struct.pack_into('<I',out,4,len(out));return bytes(out)

def run(args,env=None):return subprocess.check_output([str(a) for a in args],text=True,stderr=subprocess.STDOUT,env=env)
def cert(p):
 s=run([tools/'apksigner','verify','--verbose','--print-certs',p]);assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in s
 return re.search('Signer #1 certificate SHA-256 digest: (\\S+)',s).group(1)
oldcert=cert(baseline)
with ZipFile(baseline) as z:
 changes={}
 for name in z.namelist():
  if name.startswith('assets/') and name.endswith(('.js','.html','.json','.webmanifest')) and not name.endswith('android-asset-manifest.json'):
   data=z.read(name)
   try:s=data.decode('utf8')
   except UnicodeDecodeError:continue
   n=renamed(s)
   if name.endswith('manifest.webmanifest'):
    o=json.loads(n);o['name']='SalaryMate v5.0.0 正式版';o['short_name']='v5.0.0 正式版';n=json.dumps(o,ensure_ascii=False,separators=(',',':'))
   if n!=s:changes[name]=n.encode()
 changes['AndroidManifest.xml']=binary(z.read('AndroidManifest.xml'),True)
 changes['resources.arsc']=binary(z.read('resources.arsc'))
 m=json.loads(z.read('assets/public/android-asset-manifest.json'));m['version']='5.0.0';m['releaseName']='v5.0.0 正式版'
 for row in m['files']:
  data=changes.get('assets/public/'+row['path'],z.read('assets/public/'+row['path']));row['bytes']=len(data);row['sha256']=sha(data)
 changes['assets/public/android-asset-manifest.json']=(json.dumps(m,ensure_ascii=False,indent=2)+'\n').encode()
 sig=lambda n:n=='META-INF/MANIFEST.MF' or bool(re.fullmatch(r'META-INF/[^/]+\.(SF|RSA|DSA|EC)',n,re.I))
 config=Path(os.environ['SALARYMATE_SIGNING_CONFIG']).resolve();s=json.loads(config.read_text());ks=Path(s['keystore']);ks=ks if ks.is_absolute() else config.parent/ks
 env=dict(os.environ,SALARYMATE_STORE_PASSWORD=s['storePassword'],SALARYMATE_KEY_PASSWORD=s['keyPassword'])
 with tempfile.TemporaryDirectory(dir=root) as td:
  td=Path(td);unsigned=td/'unsigned.apk';aligned=td/'aligned.apk';signed=td/'signed.apk'
  with ZipFile(unsigned,'w') as out:
   for info in z.infolist():
    if not sig(info.filename):out.writestr(copy.copy(info),changes.get(info.filename,z.read(info.filename)))
  run([tools/'zipalign','-f','-P','16','4',unsigned,aligned]);run([tools/'apksigner','sign','--ks',ks,'--ks-key-alias',s['alias'],'--ks-pass','env:SALARYMATE_STORE_PASSWORD','--key-pass','env:SALARYMATE_KEY_PASSWORD','--v1-signing-enabled','false','--v2-signing-enabled','true','--v3-signing-enabled','false','--v4-signing-enabled','false','--out',signed,aligned],env)
  assert cert(signed)==oldcert;run([tools/'zipalign','-c','-P','16','4',signed]);badging=run([tools/'aapt2','dump','badging',signed]);assert "versionCode='5000102' versionName='5.0.0'" in badging;assert "application-label:'SalaryMate v5.0.0 正式版'" in badging
  with ZipFile(signed) as result:
   assert result.testzip() is None
   unchanged=0
   for name in result.namelist():
    if name not in changes:assert result.read(name)==z.read(name);unchanged+=1
   for row in m['files']:assert sha(result.read('assets/public/'+row['path']))==row['sha256']
  os.replace(signed,output)
report={'apk':str(output),'version':'5.0.0','releaseName':'v5.0.0 正式版','versionCode':5000102,'sha256':sha(output.read_bytes()),'bytes':output.stat().st_size,'sameCertificate':oldcert,'changedEntries':list(changes),'unchangedEntries':unchanged,'signature':'PASS','assetHashes':'PASS','zipAlignment16KB':'PASS','deviceUpgrade':'PENDING'}
(root/'formal-apk-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
