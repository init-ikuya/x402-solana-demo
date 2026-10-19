"""Package only public build outputs; never copy deployment keypairs."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

output = Path(sys.argv[1])
output.mkdir(parents=True, exist_ok=False)
files = {
    Path('target/deploy/anchoring_payment_channels.so'): 'anchoring_payment_channels.so',
    Path('target/idl/anchoring_payment_channels.json'): 'anchoring_payment_channels.json',
    Path('target/types/anchoring_payment_channels.ts'): 'anchoring_payment_channels.ts',
    Path('target/types/anchoring_payment_channels_errors.ts'): 'anchoring_payment_channels_errors.ts',
    Path('docs/architecture-submission.pdf'): 'architecture-submission.pdf',
    Path('docs/topics/auth-capture/slides.pdf'): 'auth-capture-slides.pdf',
}
for source, name in files.items():
    shutil.copyfile(source, output / name)

metadata = {
    'commit': os.environ['GITHUB_SHA'],
    'ref': os.environ['GITHUB_REF_NAME'],
    'run_url': (
        f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}"
        f"/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    ),
    'rust': subprocess.check_output(['rustc', '--version'], text=True).strip(),
    'anchor': os.environ['ANCHOR_VERSION'],
    'solana': os.environ['SOLANA_VERSION'],
    'platform_tools': os.environ['PLATFORM_TOOLS_VERSION'],
    'sbf_arch': 'v0',
}
(output / 'build-info.json').write_text(json.dumps(metadata, indent=2) + '\n')
checksums = [
    f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n'
    for path in sorted(output.iterdir())
]
(output / 'SHA256SUMS.txt').write_text(''.join(checksums))
