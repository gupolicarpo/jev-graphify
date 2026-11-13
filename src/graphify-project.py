"""Run the pinned local code extraction (AST only, clustering on) and write a compact summary, without install/skill hooks.
Usage: python -I graphify-project.py <stage-dir>"""
import json
import re
import sys
from importlib.metadata import version
from pathlib import Path
if version('graphifyy') != '0.9.107':
    raise SystemExit('Expected graphifyy==0.9.107')
from graphify.cli import dispatch_command
stage = Path(sys.argv[1]).resolve()
sys.argv = ['graphify', 'extract', str(stage), '--code-only', '--out', str(stage)]
try:
    dispatch_command('extract')
except SystemExit as e:
    # Código 0 ou None é sucesso; qualquer outro é falha do Graphify.
    if e.code not in (None, 0):
        raise
out = stage / 'graphify-out'
graph = json.loads((out / 'graph.json').read_text(encoding='utf-8'))
nodes = graph.get('nodes', [])
links = graph.get('links', graph.get('edges', []))
degree = {}
for l in links:
    for end in (l.get('source'), l.get('target')):
        degree[end] = degree.get(end, 0) + 1
imports = re.compile(r'^[a-z0-9_.]+$')
prefix = str(stage).replace('\\', '/').rstrip('/') + '/'

def relative(source):
    s = source.replace('\\', '/')
    if s.startswith(prefix):
        return s[len(prefix):]
    return s[2:] if s.startswith('./') else s

by_file, by_comm = {}, {}
for n in nodes:
    source = n.get('source_file')
    if not isinstance(source, str) or not source:
        continue
    by_file.setdefault(relative(source), []).append(n)
    if n.get('community') is not None:
        by_comm.setdefault(n['community'], []).append(n)

def labels(group):
    seen = {}
    for n in sorted(group, key=lambda n: -degree.get(n.get('id'), 0)):
        label = str(n.get('label', n.get('id')))
        if label not in seen and not imports.match(label):
            seen[label] = True
    return list(seen)

files = []
for file, group in sorted(by_file.items()):
    counts = {}
    for n in group:
        c = n.get('community')
        if c is not None:
            counts[c] = counts.get(c, 0) + 1
    nucleo = min(counts, key=lambda c: (-counts[c], c)) if counts else -1
    files.append({'file': file, 'nucleo': nucleo, 'simbolos': labels(group)[:40], 'nos': len(group)})
nucleos = [{'id': c, 'rotulos': labels(g)[:15]} for c, g in sorted(by_comm.items())]
summary = {'graphify': version('graphifyy'), 'nodes': len(nodes), 'edges': len(links), 'communities': len(by_comm), 'files': files, 'nucleos': nucleos}
(out / 'project-summary.json').write_text(json.dumps(summary, ensure_ascii=False), encoding='utf-8')
print('project-summary: %d files, %d nodes, %d clusters' % (len(files), len(nodes), len(by_comm)))
