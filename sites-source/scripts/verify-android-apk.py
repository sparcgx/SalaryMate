"""Verify the signed Android release against source assets and an optional prior APK."""
import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('apk', type=Path)
parser.add_argument('report', type=Path, nargs='?')
parser.add_argument('--baseline-apk', type=Path)
args = parser.parse_args()
apk = args.apk.resolve()
root = Path(__file__).resolve().parent.parent
sdk = Path(os.environ.get('ANDROID_HOME', os.environ.get('ANDROID_SDK_ROOT', '')))
tools = sdk / 'build-tools/36.0.0'
suffix = '.exe' if os.name == 'nt' else ''
java = Path(os.environ['JAVA_HOME']) / ('bin/java' + suffix) if os.environ.get('JAVA_HOME') else 'java'

def command(arguments):
    return subprocess.check_output([str(value) for value in arguments], text=True, encoding='utf-8')

def badging_for(path):
    return command([tools / ('aapt2' + suffix), 'dump', 'badging', path])

def signing_certificate(path):
    signing = command([java, '-jar', tools / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs', path])
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in signing
    assert re.search(r'^Number of signers: 1$', signing, re.M), 'Expected one release signing identity.'
    return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', signing).group(1)

badging = badging_for(apk)
assert "name='com.salarymate.personal.dev'" in badging, 'Keep the installed Android package identity.'
assert re.search(r"^(?:minSdkVersion|sdkVersion):'24'$", badging, re.M)
assert "targetSdkVersion:'36'" in badging
assert "launchable-activity: name='com.salarymate.personal.MainActivity'" in badging
assert 'application-debuggable' not in badging
certificate = signing_certificate(apk)
command([tools / ('zipalign' + suffix), '-c', '-P', '16', '4', apk])
with ZipFile(apk) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Duplicate APK entries.'
    manifest = json.loads(archive.read('assets/public/android-asset-manifest.json'))
    revision = re.fullmatch(r'5\.0\.0-dev\.2-R(\d+)', manifest['version'])
    if revision:
        version_code = 5000000 + int(revision.group(1))
    else:
        package = json.loads((root / 'native-android/package.json').read_text(encoding='utf-8'))
        gradle = (root / 'native-android/android/app/build.gradle').read_text(encoding='utf-8')
        assert manifest['version'] == package['version'], 'Native and bundled web versions differ.'
        assert re.search(r'versionName "([^"]+)"', gradle).group(1) == manifest['version']
        version_code = int(re.search(r'versionCode (\d+)', gradle).group(1))
    assert f"versionCode='{version_code}'" in badging
    assert f"versionName='{manifest['version']}'" in badging
    assert manifest['files'] and len({entry['path'] for entry in manifest['files']}) == len(manifest['files'])
    for entry in manifest['files']:
        data = archive.read('assets/public/' + entry['path'])
        assert len(data) == entry['bytes'], entry['path']
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
        source = root / 'native-android/www' / entry['path']
        assert data == source.read_bytes(), entry['path']
    config = json.loads(archive.read('assets/capacitor.config.json'))
    assert config['appId'] == 'com.salarymate.personal.dev'
    assert config['server'] == {'hostname': 'salarymate.sparcgx2420.chatgpt.site', 'androidScheme': 'https'}
    assert not any(name.lower().endswith(('.p12', '.jks', '.keystore', '/signing.json')) for name in names)
    assert 'classes.dex' in names
    index = archive.read('assets/public/index.html').decode()
    assert index.index('android-runtime.js') < index.index('android-legacy-backup.js') < index.index('legal-data.js') < index.index('startup.js?v=')
    assert 'data-startup-style' in index
    assert 'accept="application/json,application/octet-stream,.json,.salarymate"' in index
    assert "frame-src 'none'" in index
    assert 'root.SalaryMatePortable' in archive.read('assets/public/android-runtime.js').decode()
    assert archive.read('assets/public/android-runtime.js') == (root / 'scripts/lib/android-runtime.js').read_bytes()
    assert b'salarymate_v5_full_state' in archive.read('assets/public/app.js')

baseline = None
if args.baseline_apk:
    previous = args.baseline_apk.resolve()
    previous_badging = badging_for(previous)
    assert "name='com.salarymate.personal.dev'" in previous_badging, 'Previous APK has a different package identity.'
    assert signing_certificate(previous) == certificate, 'The update signing identity changed.'
    previous_code = int(re.search(r"versionCode='(\d+)'", previous_badging).group(1))
    assert version_code > previous_code, 'An upgrade needs a higher versionCode.'
    with ZipFile(previous) as archive:
        previous_config = json.loads(archive.read('assets/capacitor.config.json'))
        assert previous_config['server'] == config['server'], 'WebView storage origin changed.'
    baseline = {'file': previous.name, 'versionCode': previous_code,
                'sha256': hashlib.sha256(previous.read_bytes()).hexdigest(),
                'sameSigningIdentity': True, 'sameStorageOrigin': True}

result = {'version': manifest['version'], 'applicationId': 'com.salarymate.personal.dev', 'versionCode': version_code,
          'minSdk': 24, 'targetSdk': 36, 'assetHashesVerified': len(manifest['files']), 'signatureV2': 'PASS',
          'zipAlignment16KB': 'PASS', 'certificateSHA256': certificate, 'bytes': apk.stat().st_size,
          'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'baselineUpgradeCompatibility': baseline,
          'deviceInstallAndVisual': 'PENDING', 'browserOrEmulatorUsed': False}
if args.report:
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
