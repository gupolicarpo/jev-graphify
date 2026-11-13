"""Build only the reviewed allowlist; never include environments or project memory."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import zipfile
root = Path(__file__).resolve().parents[1]
files = json.loads((root / 'release-files.json').read_text(encoding='utf-8'))
if len(files) != len(set(files)):
    raise SystemExit('Duplicate release entries')
contents = {}
for name in files:
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or any(part in ('work', 'outputs', 'node_modules', '.git', '.jev-graphify', '.venv-graphify', '__pycache__') for part in p.parts):
        raise SystemExit('Unsafe release path')
    source = root.joinpath(*p.parts)
    if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(root):
        raise SystemExit('Missing or unsafe release entry: ' + name)
    data = source.read_bytes()
    home = os.environ.get('USERPROFILE', '').encode()
    if home and (home.lower() in data.lower() or home.replace(b'\\', b'/').lower() in data.lower()):
        raise SystemExit('Private local path found: ' + name)
    contents[name] = data
manifest = ''.join(hashlib.sha256(data).hexdigest() + '  ' + name + '\n' for name, data in sorted(contents.items()))
contents['MANIFEST.sha256'] = manifest.encode()
release = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
output = root / 'outputs' / f'jev-graphify-{release}.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(contents.items()):
        info = zipfile.ZipInfo('jev-graphify/' + name, date_time=(2026, 11, 12, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
with zipfile.ZipFile(output) as archive:
    assert set(archive.namelist()) == {'jev-graphify/' + name for name in contents}
    assert archive.testzip() is None
    for name, data in contents.items():
        assert archive.read('jev-graphify/' + name) == data
sha = hashlib.sha256(output.read_bytes()).hexdigest()
(output.parent / (output.name + '.sha256')).write_text(sha + '  ' + output.name + '\n', encoding='utf-8')
print(json.dumps({'file': output.name, 'files': len(contents), 'bytes': output.stat().st_size, 'sha256': sha}))
