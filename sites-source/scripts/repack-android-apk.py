"""Replace reviewed Android web adapters, retaining a published APK's native code."""
import hashlib
import copy
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

baseline, assets, output = [Path(value).resolve() for value in sys.argv[1:4]]
sdk = Path(os.environ['ANDROID_HOME'])
tools = sdk / 'build-tools/36.0.0'
prefix = 'assets/public/'
allowed = {prefix + 'android-runtime.js', prefix + 'android-asset-manifest.json'}
is_signature = lambda name: name == 'META-INF/MANIFEST.MF' or bool(re.fullmatch(r'META-INF/[^/]+\.(SF|RSA|DSA|EC)', name, re.I))
sha = lambda data: hashlib.sha256(data).hexdigest()

def checked_command(arguments, env=None):
    return subprocess.check_output(arguments, env=env, text=True, stderr=subprocess.STDOUT)

def certificate(apk):
    result = checked_command([str(tools/'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)])
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in result
    return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)', result).group(1)

old_certificate = certificate(baseline)
manifest = json.loads((assets/'android-asset-manifest.json').read_text())
badging = checked_command([str(tools/'aapt2'), 'dump', 'badging', str(baseline)])
assert "name='com.salarymate.personal.dev'" in badging, 'Only the existing development APK may be repacked.'
assert "versionName='" + manifest['version'] + "'" in badging
assert re.search(r"^(?:minSdkVersion|sdkVersion):'24'$", badging, re.M)

with ZipFile(baseline) as original:
    assert original.testzip() is None
    names = original.namelist()
    assert len(names) == len(set(names))
    asset_names = {name[len(prefix):] for name in names if name.startswith(prefix) and not name.endswith('/')}
    generated_names = {str(path.relative_to(assets)) for path in assets.rglob('*') if path.is_file()}
    assert asset_names == generated_names, 'Unexpected asset additions or removals.'
    old_manifest = json.loads(original.read(prefix+'android-asset-manifest.json'))
    assert old_manifest['version'] == manifest['version']
    for item in old_manifest['files']:
        data = original.read(prefix+item['path'])
        assert len(data) == item['bytes'] and sha(data) == item['sha256'], item['path']
    for item in manifest['files']:
        data = (assets/item['path']).read_bytes()
        assert len(data) == item['bytes'] and sha(data) == item['sha256'], item['path']
    for name in names:
        if name.startswith(prefix) and not name.endswith('/') and name not in allowed:
            assert original.read(name) == (assets/name[len(prefix):]).read_bytes(), name

    signing_path = Path(os.environ['SALARYMATE_SIGNING_CONFIG']).resolve()
    signing = json.loads(signing_path.read_text())
    keystore = Path(signing['keystore'])
    if not keystore.is_absolute():
        keystore = signing_path.parent/keystore
    env = dict(os.environ, SALARYMATE_STORE_PASSWORD=signing['storePassword'], SALARYMATE_KEY_PASSWORD=signing['keyPassword'])
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.salarymate-r101-repack-', dir=output.parent) as temporary:
        temporary = Path(temporary)
        unsigned, aligned, signed = temporary/'unsigned.apk', temporary/'aligned.apk', temporary/'signed.apk'
        with ZipFile(unsigned, 'w') as staged:
            for info in original.infolist():
                if is_signature(info.filename):
                    continue
                data = (assets/info.filename[len(prefix):]).read_bytes() if info.filename in allowed else original.read(info.filename)
                # ZipFile updates ZipInfo offsets while writing; keep the
                # original reader's entries intact for the comparison below.
                staged.writestr(copy.copy(info), data)
        checked_command([str(tools/'zipalign'), '-f', '-P', '16', '4', str(unsigned), str(aligned)])
        checked_command([str(tools/'apksigner'), 'sign', '--ks', str(keystore), '--ks-key-alias', signing['alias'],
                         '--ks-pass', 'env:SALARYMATE_STORE_PASSWORD', '--key-pass', 'env:SALARYMATE_KEY_PASSWORD',
                         '--v1-signing-enabled', 'false', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'false',
                         '--v4-signing-enabled', 'false', '--out', str(signed), str(aligned)], env)

        assert certificate(signed) == old_certificate, 'Signing identity changed.'
        checked_command([str(tools/'zipalign'), '-c', '-P', '16', '4', str(signed)])
        with ZipFile(signed) as result:
            assert result.testzip() is None
            assert set(result.namelist()) == {name for name in names if not is_signature(name)}
            unchanged = 0
            for name in result.namelist():
                if name not in allowed:
                    assert result.read(name) == original.read(name), name
                    unchanged += 1
        assert checked_command([str(tools/'aapt2'), 'dump', 'badging', str(signed)]) == badging
        # The last good output survives any packaging/signing/check failure.
        os.replace(signed, output)

print(json.dumps({'version': manifest['version'], 'apk': str(output), 'bytes': output.stat().st_size,
                  'sha256': sha(output.read_bytes()), 'baselineSHA256': sha(baseline.read_bytes()),
                  'certificateSHA256': old_certificate, 'unchangedEntries': unchanged,
                  'changedEntries': sorted(allowed), 'signature': 'PASS', 'zipAlignment16KB': 'PASS',
                  'deviceInstallAndVisual': 'PENDING'}, ensure_ascii=False))
