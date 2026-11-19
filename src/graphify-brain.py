"""Cluster the Second Brain graph (notes, folders, linked code) with Graphify's Leiden, without install/skill hooks.
Usage: python -I graphify-brain.py <stage-dir>   (reads brain-graph.json, writes brain-communities.json)"""
import json
import sys
from importlib.metadata import version
from pathlib import Path
if version('graphifyy') != '0.9.107':
    raise SystemExit('Expected graphifyy==0.9.107')
import networkx as nx
from graphify.cluster import cluster
stage = Path(sys.argv[1]).resolve()
data = json.loads((stage / 'brain-graph.json').read_text(encoding='utf-8'))
G = nx.Graph()
G.add_nodes_from(str(n) for n in data['nodes'])
for a, b, w in data['edges']:
    a, b = str(a), str(b)
    if a == b or a not in G or b not in G:
        continue
    # Arestas repetidas somam o peso, como no grafo de código.
    old = G.get_edge_data(a, b)
    G.add_edge(a, b, weight=float(w) + (old['weight'] if old else 0.0))
communities = cluster(G)
out = {'graphify': version('graphifyy'), 'communities': {str(i): list(nodes) for i, nodes in communities.items()}}
(stage / 'brain-communities.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
print('brain-communities: %d nodes, %d communities' % (G.number_of_nodes(), len(communities)))
