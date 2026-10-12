"""Restore verified public assets from an existing SalaryMate APK, not a new app."""
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

apk, target = Path(sys.argv[1]), Path(sys.argv[2])
prefix = 'assets/public/'
with ZipFile(apk) as archive:
    assert archive.testzip() is None, 'APK ZIP integrity failed.'
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Duplicate APK entries.'
    manifest = json.loads(archive.read(prefix + 'android-asset-manifest.json'))
    for item in manifest['files']:
        data = archive.read(prefix + item['path'])
        assert len(data) == item['bytes'], item['path']
        assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    for name in names:
        if not name.startswith(prefix) or name.endswith('/'):
            continue
        relative = PurePosixPath(name[len(prefix):])
        assert not relative.is_absolute() and '..' not in relative.parts, name
        assert '\\' not in str(relative), name
        path = target.joinpath(*relative.parts)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(archive.read(name))
print(json.dumps({'version': manifest['version'], 'verifiedAssets': len(manifest['files'])}))
