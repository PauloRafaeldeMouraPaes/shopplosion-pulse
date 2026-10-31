#!/usr/bin/env python3
"""Compare the published GitHub Pages artifact with a git ref, file by file, by SHA-256.

Usage: python3 scripts/verify_published_artifact.py [--ref origin/main] [--base URL] [--out path.json]

It downloads each published file (Cache-Control: no-cache), hashes it, hashes the same path in
the git ref, and writes a JSON record with both hashes and a verdict per file. The script never
modifies the repository or the deployment. Exit 1 if any file differs or cannot be fetched, so the
record can be used as a gate. Network access to the Pages host is required; when unavailable the
record states so explicitly instead of claiming identity.
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
PUBLISHED_FILES = [
    'index.html', 'intelligence.html', 'app.html', 'ask.html', 'sources.html', 'base.html', 'auth.html',
    'documento.html', 'pilot-chocolate.html', 'pulse-workspace-v3.js', 'pulse-config.js',
    'pulse-public-evidence.js', 'pulse-workspace-v3.css', 'pulse-tokens.css', 'pulse-shell.css', 'pulse-v2.css',
    'pulse-market-updates-20260921.js', 'pulse-conducao.js', 'scripts/pulse-aprofundamento-escopo.js',
    'scripts/pulse-aprofundamento-ui.js', 'shopplosion-logo.png', '_redirects',
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(ref, path):
    try:
        return subprocess.check_output(['git', 'show', f'{ref}:{path}'], stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None


def fetch(url):
    req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'pulse-artifact-verify'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', default='origin/main')
    ap.add_argument('--base', default=DEFAULT_BASE)
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    ref_sha = subprocess.check_output(['git', 'rev-parse', args.ref], text=True).strip()
    record = {
        'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'ref': args.ref, 'ref_sha': ref_sha, 'base_url': args.base, 'files': [], 'verdict': None,
    }
    problems = 0
    for path in PUBLISHED_FILES:
        entry = {'path': path, 'repo_sha256': None, 'live_sha256': None, 'live_http': None, 'result': None}
        blob = git_blob(args.ref, path)
        entry['repo_sha256'] = sha256(blob) if blob is not None else None
        try:
            status, body = fetch(args.base + path)
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
        print(f"{entry['result']:<15} {path}")
    record['verdict'] = 'identical' if problems == 0 else 'not_verified' if any(f['result'] == 'not_fetched' for f in record['files']) else 'different'
    print(f"Verdict for {args.ref} ({ref_sha[:12]}): {record['verdict']}")
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as fh:
            json.dump(record, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
        print(f'Record written to {args.out}')
    return 0 if problems == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
