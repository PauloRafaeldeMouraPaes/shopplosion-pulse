#!/usr/bin/env python3
"""Textual integrity gate for the Pulse repository.

This file is kept pure ASCII on purpose: every scanned character is written as a \\u escape so the
gate can scan its own source without tripping.

Rejects, in every tracked text file:
- a UTF-8 BOM at the start of the file;
- zero-width, word-joiner, soft-hyphen and bidirectional control characters;
- any other Unicode format character (category Cf) and C0/C1 control characters
  other than tab, LF and CR;
- NBSP inside HTML/JS/CSS tag or code syntax (NBSP in prose is tolerated only in .md/.html text);
- files that are not valid UTF-8.

It also reports mirrored source pairs whose content diverges so the divergence is explicit
instead of silent. The mirrored public evidence pair is enforced elsewhere (test-pulse-ask-ai.js);
here it is informational only.

Exit code 1 on any rejection. No file is modified.
"""
import os
import re
import subprocess
import sys
import unicodedata

INVISIBLE = {
    '\u200b': 'ZERO WIDTH SPACE', '\u200c': 'ZERO WIDTH NON-JOINER', '\u200d': 'ZERO WIDTH JOINER',
    '\u2060': 'WORD JOINER', '\ufeff': 'BOM / ZERO WIDTH NO-BREAK SPACE', '\u00ad': 'SOFT HYPHEN',
    '\u200e': 'LEFT-TO-RIGHT MARK', '\u200f': 'RIGHT-TO-LEFT MARK', '\u180e': 'MONGOLIAN VOWEL SEPARATOR',
    '\u202a': 'LRE', '\u202b': 'RLE', '\u202c': 'PDF', '\u202d': 'LRO', '\u202e': 'RLO',
    '\u2066': 'LRI', '\u2067': 'RLI', '\u2068': 'FSI', '\u2069': 'PDI',
    '\ufff9': 'INTERLINEAR ANNOTATION ANCHOR', '\ufffa': 'INTERLINEAR ANNOTATION SEPARATOR',
    '\ufffb': 'INTERLINEAR ANNOTATION TERMINATOR', '\ufffc': 'OBJECT REPLACEMENT CHARACTER',
}
BINARY_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.pdf', '.zip', '.webp')
CODE_EXT = ('.html', '.js', '.mjs', '.cjs', '.ts', '.css', '.json', '.yml', '.yaml', '.py', '.sql', '.toml')
MIRRORS = [
    ('supabase/functions/pulse-rag-eval/index.ts', 'supabase/functions/pulse-rag-eval/pulse-rag-eval/index.ts'),
    ('supabase/functions/pulse-ask-ai/index.ts', 'supabase/functions/pulse-ask-ai/pulse-ask-ai/index.ts'),
    ('supabase/functions/pulse-external-signal-worker/quality.mjs', 'supabase/functions/pulse-external-deterministic-backstop/quality.mjs'),
]


def tracked_files():
    out = subprocess.check_output(['git', 'ls-files'], text=True)
    return [f for f in out.split('\n') if f and os.path.isfile(f) and not f.endswith(BINARY_EXT)]


def main():
    failures = []
    scanned = 0
    for path in tracked_files():
        raw = open(path, 'rb').read()
        if raw.startswith(b'\xef\xbb\xbf'):
            failures.append(f'{path}: UTF-8 BOM at start of file')
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError as err:
            failures.append(f'{path}: not valid UTF-8 ({err})')
            continue
        scanned += 1
        for ch, name in INVISIBLE.items():
            count = text.count(ch)
            if count:
                line = text[:text.index(ch)].count('\n') + 1
                failures.append(f'{path}:{line}: {name} (U+{ord(ch):04X}) x{count}')
        for ch in sorted(set(text)):
            cat = unicodedata.category(ch)
            if cat == 'Cc' and ch not in '\n\r\t':
                failures.append(f'{path}: control character U+{ord(ch):04X}')
            elif cat == 'Cf' and ch not in INVISIBLE:
                failures.append(f'{path}: format character U+{ord(ch):04X}')
        if path.endswith(CODE_EXT):
            for match in re.finditer(r'<[^>\n]*\u00a0[^>\n]*>', text):
                line = text[:match.start()].count('\n') + 1
                failures.append(f'{path}:{line}: NBSP inside tag syntax')
            if not path.endswith('.html') and '\u00a0' in text:
                line = text[:text.index('\u00a0')].count('\n') + 1
                failures.append(f'{path}:{line}: NBSP in code file')
    notes = []
    for left, right in MIRRORS:
        if os.path.isfile(left) and os.path.isfile(right):
            same = open(left, 'rb').read() == open(right, 'rb').read()
            notes.append(f'mirror {left} vs {right}: {"identical" if same else "DIVERGENT (stale copy?)"}')
    print(f'Scanned {scanned} tracked text files for invisible, bidi, control and BOM characters.')
    for note in notes:
        print(' - ' + note)
    if failures:
        print('PULSE TEXT INTEGRITY FAILED')
        for item in failures:
            print(' - ' + item)
        return 1
    print('PULSE TEXT INTEGRITY PASSED')
    return 0


if __name__ == '__main__':
    sys.exit(main())
