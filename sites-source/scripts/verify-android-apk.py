"""Verify the compiled development APK without a browser or emulator."""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
from zipfile import ZipFile

apk=Path(sys.argv[1]).resolve()
root=Path(__file__).resolve().parent.parent
sdk=Path(os.environ.get('ANDROID_HOME',os.environ.get('ANDROID_SDK_ROOT','')))
tools=sdk/'build-tools/36.0.0'
badging=subprocess.check_output([str(tools/'aapt2'),'dump','badging',str(apk)],text=True)
assert "name='com.salarymate.personal.dev'" in badging,'Development package must be isolated.'
assert "versionCode='5000099'" in badging
assert "versionName='5.0.0-dev.2-R99'" in badging
assert re.search(r"^(?:minSdkVersion|sdkVersion):'24'$",badging,re.MULTILINE)
assert "targetSdkVersion:'36'" in badging
assert "launchable-activity: name='com.salarymate.personal.MainActivity'" in badging
signing=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(apk)],text=True)
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signing
certificate=re.search(r'Signer #1 certificate SHA-256 digest: (\S+)',signing).group(1)
manifest=json.loads((root/'native-android/www/android-asset-manifest.json').read_text())
assert manifest['version']=='5.0.0-dev.2-R99'
with ZipFile(apk) as archive:
 assert archive.testzip() is None
 for entry in manifest['files']:
  data=archive.read('assets/public/'+entry['path'])
  assert len(data)==entry['bytes'],entry['path']
  assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
 config=json.loads(archive.read('assets/capacitor.config.json'))
 assert config['appId']=='com.salarymate.personal.dev'
 assert config['server']=={'hostname':'salarymate.sparcgx2420.chatgpt.site','androidScheme':'https'}
 assert 'serverUrl' not in config['server'] and 'url' not in config['server']
 assert not any(name.endswith(('.p12','.jks','.keystore')) for name in archive.namelist())
 assert 'classes.dex' in archive.namelist()
 index=archive.read('assets/public/index.html').decode()
 assert index.index('android-runtime.js')<index.index('legal-data.js')<index.index('startup.js?v=')
 assert 'data-startup-style' in index
 assert 'accept="application/json,application/octet-stream,.json,.salarymate"' in index
 assert "frame-src 'none'" in index
 assert 'root.SalaryMatePortable' in archive.read('assets/public/android-runtime.js').decode()
result={'version':manifest['version'],'applicationId':'com.salarymate.personal.dev','versionCode':5000099,
 'minSdk':24,'targetSdk':36,'assetHashesVerified':len(manifest['files']),'signatureV2':'PASS',
 'certificateSHA256':certificate,'bytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),
 'deviceInstallAndVisual':'PENDING','browserOrEmulatorUsed':False}
if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
