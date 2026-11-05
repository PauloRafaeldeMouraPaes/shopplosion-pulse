#!/usr/bin/env python3
"""Compare the published GitHub Pages artifact with a git ref, file by file, by SHA-256.

Usage: python3 scripts/verify_published_artifact.py [--ref origin/main] [--base URL] [--out path.json]
                                                     [--require-release] [--core-only]

Scope: every blob tracked in the ref whose path has no dot-prefixed segment. The Pages deploy uploads
the whole checkout (`upload-pages-artifact` with `path: .`) and serves everything except dot-paths
(`.github/`, `.gitignore`, ...), which return 404; so "the published artifact" is the full tracked tree,
not a hand-picked list. `--core-only` restricts the check to the pages and runtime files, which is only
useful for a quick look, never as a gate.

Cache: the Pages CDN ignores request `Cache-Control` directives and caches responses for 10 minutes, so
each file is requested with a unique query string (`?identity=<ref sha>`), which the CDN treats as a new
cache key. That makes the fetch reach the origin, but right after a deploy the origin itself may still
serve the previous release for a short while. The live `pulse-release.json`, written by the release
workflow with the deployed commit, is read first: with `--require-release` the script refuses to compare
(exit 2, verdict `release_mismatch`) until it names the ref's commit, so a gate retries instead of
reporting a false difference.

The script never modifies the repository or the deployment. Exit 1 if any file differs or cannot be
fetched, exit 2 on a release mismatch, 0 only when every file is identical. When the network cannot
reach the Pages host the record says `not_verified` instead of claiming identity.
"""
import argparse
import datetime
import hashlib
import json
import subprocess
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = 'https://paulorafaeldemourapaes.github.io/shopplosion-pulse/'
CORE_FILES = [
    'index.html', 'intelligence.html', 'app.html', 'ask.html', 'sources.html', 'base.html', 'auth.html',
    'documento.html', 'pilot-chocolate.html', 'pulse-workspace-v3.js', 'pulse-config.js',
    'pulse-public-evidence.js', 'pulse-workspace-v3.css', 'pulse-tokens.css', 'pulse-shell.css', 'pulse-v2.css',
    'pulse-market-updates-20260921.js', 'pulse-conducao.js', 'scripts/pulse-aprofundamento-escopo.js',
    'scripts/pulse-aprofundamento-ui.js', 'shopplosion-logo.png', '_redirects',
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def tracked_files(ref):
    """Blobs tracked in the ref, excluding symlinks and any path with a dot-prefixed segment."""
    out = subprocess.check_output(['git', 'ls-tree', '-r', '-z', ref])
    paths = []
    for entry in out.split(b'\0'):
        if not entry:
            continue
        meta, path = entry.split(b'\t', 1)
        mode, kind, _sha = meta.decode().split(' ')
        path = path.decode('utf-8')
        if kind != 'blob' or mode == '120000':
            continue
        if any(segment.startswith('.') for segment in path.split('/')):
            continue
        paths.append(path)
    return sorted(paths)


def git_blob(ref, path):
    try:
        return subprocess.check_output(['git', 'show', f'{ref}:{path}'], stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None


def fetch(url):
    req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'pulse-artifact-verify'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read()


def live_release(base, token):
    """The deployed commit according to pulse-release.json, or a reason why it could not be read."""
    try:
        status, body = fetch(f'{base}pulse-release.json?identity={token}')
        manifest = json.loads(body.decode('utf-8'))
        return {'http': status, 'commit_sha': manifest.get('commit_sha'), 'workflow_run_id': manifest.get('workflow_run_id'),
                'generated_at': manifest.get('generated_at')}
    except urllib.error.HTTPError as err:
        return {'http': err.code, 'commit_sha': None}
    except Exception as err:  # network or parse problem: recorded, never assumed
        return {'http': f'unreachable: {err.__class__.__name__}', 'commit_sha': None}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--ref', default='origin/main')
    ap.add_argument('--base', default=DEFAULT_BASE)
    ap.add_argument('--out', default=None)
    ap.add_argument('--require-release', action='store_true',
                    help='exit 2 without comparing files unless the live pulse-release.json names the ref commit')
    ap.add_argument('--cache-key', default='', help='extra token appended to the cache-busting query (use a different one per retry)')
    ap.add_argument('--core-only', action='store_true', help='check only the pages and runtime files (quick look, not a gate)')
    args = ap.parse_args()
    ref_sha = subprocess.check_output(['git', 'rev-parse', args.ref], text=True).strip()
    token = ref_sha[:12] + (('-' + args.cache_key) if args.cache_key else '')
    record = {
        'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'ref': args.ref, 'ref_sha': ref_sha, 'base_url': args.base,
        'scope': 'core_files' if args.core_only else 'tracked_tree_without_dot_paths',
        'release': None, 'files': [], 'verdict': None,
    }
    record['release'] = live_release(args.base, token)
    release_sha = record['release'].get('commit_sha')
    record['release']['matches_ref'] = bool(release_sha) and release_sha == ref_sha
    print(f"Live release: {release_sha or 'unavailable'} ({'matches' if record['release']['matches_ref'] else 'does not match'} {args.ref} {token})")
    if args.require_release and not record['release']['matches_ref']:
        record['verdict'] = 'release_mismatch'
        print(f"Verdict for {args.ref} ({token}): release_mismatch (files not compared)")
        if args.out:
            with open(args.out, 'w', encoding='utf-8') as fh:
                json.dump(record, fh, indent=2, ensure_ascii=False)
                fh.write('\n')
        return 2

    paths = CORE_FILES if args.core_only else tracked_files(args.ref)
    problems = 0
    for path in paths:
        entry = {'path': path, 'repo_sha256': None, 'live_sha256': None, 'live_http': None, 'result': None}
        blob = git_blob(args.ref, path)
        entry['repo_sha256'] = sha256(blob) if blob is not None else None
        try:
            status, body = fetch(f'{args.base}{path}?identity={token}')
            entry['live_http'] = status
            entry['live_sha256'] = sha256(body)
        except urllib.error.HTTPError as err:
            entry['live_http'] = err.code
        except Exception as err:  # network unavailable: record, never assume
            entry['live_http'] = f'unreachable: {err.__class__.__name__}'
        if entry['repo_sha256'] is None:
            entry['result'] = 'missing_in_ref'
        elif entry['live_sha256'] is None:
            entry['result'] = 'not_fetched'
        elif entry['live_sha256'] == entry['repo_sha256']:
            entry['result'] = 'identical'
        else:
            entry['result'] = 'different'
        if entry['result'] != 'identical':
            problems += 1
        record['files'].append(entry)
        if entry['result'] != 'identical':
            print(f"{entry['result']:<15} {path} (http {entry['live_http']})")
    counts = {}
    for entry in record['files']:
        counts[entry['result']] = counts.get(entry['result'], 0) + 1
    record['counts'] = counts
    record['verdict'] = 'identical' if problems == 0 else 'not_verified' if any(f['result'] == 'not_fetched' for f in record['files']) else 'different'
    print(f"Checked {len(record['files'])} files: " + ', '.join(f'{k}={v}' for k, v in sorted(counts.items())))
    print(f"Verdict for {args.ref} ({token}): {record['verdict']}")
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as fh:
            json.dump(record, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
        print(f'Record written to {args.out}')
    return 0 if problems == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
