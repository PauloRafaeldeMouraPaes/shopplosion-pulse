#!/usr/bin/env python3
"""Textual integrity gate for the Pulse repository.

This file is kept pure ASCII on purpose: every scanned character is written as a \\u escape so the
gate can scan its own source without tripping.

Scope: every git-tracked file that is text (not matched by a binary extension, no NUL byte in its
first 8 KiB, valid UTF-8). Binary files are skipped and counted, never failed.

Rejected everywhere (code and prose):
- a UTF-8 BOM at the start of the file;
- zero-width space / non-joiner, word joiner, bidirectional controls (LRM, RLM, LRE..RLO, LRI..PDI),
  interlinear annotation characters, the object replacement character and the Mongolian vowel separator;
- the zero-width joiner, except inside an emoji sequence (next to an emoji or a variation selector);
- any other Unicode format character (category Cf) and C0/C1 controls other than tab, LF and CR.

Rejected only in code files (html, js, mjs, cjs, ts, css, json, yml, yaml, py, sql, toml):
- NBSP and soft hyphen outside string literals, and NBSP inside HTML tag syntax; inside quoted
  strings (and anywhere in .md/.txt prose) they are legitimate content and tolerated.

It also reports mirrored source pairs whose content diverges so the divergence is explicit instead
of silent (informational; the public evidence mirror is enforced by test-pulse-ask-ai.js).

Exit code 1 on any rejection. No file is modified. `--self-test` runs the gate against synthetic
files in a temporary directory and checks both rejections and tolerances.
"""
import os
import re
import subprocess
import sys
import tempfile
import unicodedata

HARD_REJECT = {
    '\u200b': 'ZERO WIDTH SPACE', '\u200c': 'ZERO WIDTH NON-JOINER', '\u2060': 'WORD JOINER',
    '\ufeff': 'ZERO WIDTH NO-BREAK SPACE (BOM in the middle of a file)',
    '\u200e': 'LEFT-TO-RIGHT MARK', '\u200f': 'RIGHT-TO-LEFT MARK', '\u180e': 'MONGOLIAN VOWEL SEPARATOR',
    '\u202a': 'LRE', '\u202b': 'RLE', '\u202c': 'PDF', '\u202d': 'LRO', '\u202e': 'RLO',
    '\u2066': 'LRI', '\u2067': 'RLI', '\u2068': 'FSI', '\u2069': 'PDI',
    '\ufff9': 'INTERLINEAR ANNOTATION ANCHOR', '\ufffa': 'INTERLINEAR ANNOTATION SEPARATOR',
    '\ufffb': 'INTERLINEAR ANNOTATION TERMINATOR', '\ufffc': 'OBJECT REPLACEMENT CHARACTER',
}
ZWJ = '\u200d'
NBSP = '\u00a0'
SOFT_HYPHEN = '\u00ad'
VARIATION_SELECTOR = '\ufe0f'
BINARY_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.zip', '.webp', '.gz', '.tgz')
CODE_EXT = ('.html', '.js', '.mjs', '.cjs', '.ts', '.css', '.json', '.yml', '.yaml', '.py', '.sql', '.toml')
MIRRORS = [
    ('supabase/functions/pulse-rag-eval/index.ts', 'supabase/functions/pulse-rag-eval/pulse-rag-eval/index.ts'),
    ('supabase/functions/pulse-ask-ai/index.ts', 'supabase/functions/pulse-ask-ai/pulse-ask-ai/index.ts'),
    ('supabase/functions/pulse-external-signal-worker/quality.mjs', 'supabase/functions/pulse-external-deterministic-backstop/quality.mjs'),
]


def tracked_files(root):
    out = subprocess.check_output(['git', 'ls-files'], text=True, cwd=root)
    return [f for f in out.split('\n') if f and os.path.isfile(os.path.join(root, f))]


def looks_binary(path, raw):
    return path.endswith(BINARY_EXT) or b'\0' in raw[:8192]


def is_emoji_neighbour(ch):
    if not ch:
        return False
    if ch == VARIATION_SELECTOR or ch == ZWJ:
        return True
    code = ord(ch)
    return unicodedata.category(ch) == 'So' or 0x1F000 <= code <= 0x1FAFF or 0x2600 <= code <= 0x27BF


def string_spans(text):
    """Character offsets that sit inside quoted string literals ('...', "...", `...`), so NBSP and soft
    hyphen inside them count as content. Deliberately simple: no comment awareness, backslash escapes only."""
    inside = bytearray(len(text))
    quote = None
    i = 0
    while i < len(text):
        ch = text[i]
        if quote:
            inside[i] = 1
            if ch == '\\':
                if i + 1 < len(text):
                    inside[i + 1] = 1
                i += 2
                continue
            if ch == quote or (ch == '\n' and quote != '`'):
                quote = None
        elif ch in ('"', "'", '`'):
            quote = ch
            inside[i] = 1
        i += 1
    return inside


def line_of(text, index):
    return text[:index].count('\n') + 1


def scan_text(path, text):
    failures = []
    for ch, name in HARD_REJECT.items():
        count = text.count(ch)
        if count:
            failures.append(f'{path}:{line_of(text, text.index(ch))}: {name} (U+{ord(ch):04X}) x{count}')
    for match in re.finditer(ZWJ, text):
        i = match.start()
        prev_ch = text[i - 1] if i > 0 else ''
        next_ch = text[i + 1] if i + 1 < len(text) else ''
        if not (is_emoji_neighbour(prev_ch) or is_emoji_neighbour(next_ch)):
            failures.append(f'{path}:{line_of(text, i)}: ZERO WIDTH JOINER (U+200D) outside an emoji sequence')
    for ch in sorted(set(text)):
        cat = unicodedata.category(ch)
        if cat == 'Cc' and ch not in '\n\r\t':
            failures.append(f'{path}:{line_of(text, text.index(ch))}: control character U+{ord(ch):04X}')
        elif cat == 'Cf' and ch not in HARD_REJECT and ch not in (ZWJ, SOFT_HYPHEN, VARIATION_SELECTOR):
            failures.append(f'{path}:{line_of(text, text.index(ch))}: format character U+{ord(ch):04X}')
    if path.endswith(CODE_EXT):
        for match in re.finditer('<[^>\\n]*' + NBSP + '[^>\\n]*>', text):
            failures.append(f'{path}:{line_of(text, match.start())}: NBSP inside tag syntax')
        if NBSP in text or SOFT_HYPHEN in text:
            inside = string_spans(text)
            for match in re.finditer('[' + NBSP + SOFT_HYPHEN + ']', text):
                i = match.start()
                if not inside[i] and not path.endswith('.html'):
                    name = 'NBSP' if text[i] == NBSP else 'SOFT HYPHEN'
                    failures.append(f'{path}:{line_of(text, i)}: {name} in code outside a string literal')
    return failures


def run(root):
    failures = []
    scanned = 0
    skipped = 0
    for path in tracked_files(root):
        full = os.path.join(root, path)
        raw = open(full, 'rb').read()
        if looks_binary(path, raw):
            skipped += 1
            continue
        if raw.startswith(b'\xef\xbb\xbf'):
            failures.append(f'{path}: UTF-8 BOM at start of file')
            raw = raw[3:]
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError as err:
            failures.append(f'{path}: not valid UTF-8 ({err})')
            continue
        scanned += 1
        failures.extend(scan_text(path, text))
    notes = []
    for left, right in MIRRORS:
        lp, rp = os.path.join(root, left), os.path.join(root, right)
        if os.path.isfile(lp) and os.path.isfile(rp):
            same = open(lp, 'rb').read() == open(rp, 'rb').read()
            notes.append(f'mirror {left} vs {right}: {"identical" if same else "DIVERGENT (stale copy?)"}')
    return scanned, skipped, failures, notes


def self_test():
    """Synthetic files in a throwaway git repository: each case states what must be rejected or tolerated."""
    cases = {
        'ok_prose.md': ('Texto com NBSP\u00a0legitimo, h\u00adifen suave e emoji \U0001F468\u200d\U0001F4BB em prosa.\n', 0),
        'ok_strings.js': ('const label = "R$\u00a01.000"; const soft = \'co\u00adoperar\';\n', 0),
        'ok_json.json': ('{"preco": "R$\u00a0199"}\n', 0),
        'bad_zwsp.md': ('palavra\u200bcolada\n', 1),
        'bad_bidi.js': ('const x = "ab\u202ecd";\n', 1),
        'bad_zwj.txt': ('sem\u200demoji\n', 1),
        'bad_nbsp_code.js': ('const\u00a0x = 1;\n', 1),
        'bad_nbsp_tag.html': ('<div\u00a0class="a">x</div>\n', 1),
        'bad_bom.css': ('\ufeffbody{margin:0}\n', 1),
        'bad_control.py': ('x = 1\u0007\n', 1),
        'bad_cf.md': ('a\u2061b\n', 1),
    }
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.check_call(['git', 'init', '-q', tmp])
        with open(os.path.join(tmp, 'blob.bin'), 'wb') as fh:
            fh.write(b'\x00\x01\x02binary\xff')
        for name, (content, _) in cases.items():
            with open(os.path.join(tmp, name), 'w', encoding='utf-8', newline='') as fh:
                fh.write(content)
        subprocess.check_call(['git', '-C', tmp, 'add', '-A'])
        scanned, skipped, failures, _ = run(tmp)
        problems = []
        if skipped != 1:
            problems.append(f'expected the NUL-byte file to be skipped as binary, skipped={skipped}')
        for name, (_, expected) in cases.items():
            got = len([f for f in failures if f.startswith(name + ':')])
            if (got > 0) != (expected > 0):
                problems.append(f'{name}: expected {"a rejection" if expected else "no rejection"}, got {got}: {[f for f in failures if f.startswith(name)]}')
        if problems:
            print('TEXT INTEGRITY SELF-TEST FAILED')
            for item in problems:
                print(' - ' + item)
            return 1
        print(f'TEXT INTEGRITY SELF-TEST PASSED ({len(cases)} synthetic cases, {scanned} scanned, {skipped} binary skipped)')
        return 0


def main(argv):
    if '--self-test' in argv:
        return self_test()
    scanned, skipped, failures, notes = run(os.getcwd())
    print(f'Scanned {scanned} tracked text files for invisible, bidi, control and BOM characters ({skipped} binary files skipped).')
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
    sys.exit(main(sys.argv[1:]))
