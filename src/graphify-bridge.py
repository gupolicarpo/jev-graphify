"""Invoke only the pinned local extraction command, without install/skill hooks."""
import sys
from importlib.metadata import version
from pathlib import Path
if version('graphifyy') != '0.9.107':
    raise SystemExit('Expected graphifyy==0.9.107')
from graphify.cli import dispatch_command
stage = str(Path(sys.argv[1]).resolve())
sys.argv = ['graphify', 'extract', stage, '--code-only', '--no-cluster', '--max-workers', '1', '--no-dedup']
dispatch_command('extract')
