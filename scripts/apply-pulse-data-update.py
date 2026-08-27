import json
import re
from pathlib import Path

INDEX = Path('index.html')
UPDATE = Path('data/pulse-update.json')


def js_literal(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def find_array_span(text, marker):
    start_marker = text.find(marker)
    if start_marker < 0:
        raise ValueError(f'array marker not found: {marker}')
    start = text.find('[', start_marker)
    if start < 0:
        raise ValueError(f'array start not found: {marker}')
    depth = 0
    quote = None
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
            continue
        if c in ('"', "'"):
            quote = c
        elif c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                return start, i + 1
    raise ValueError(f'unclosed array: {marker}')


def find_object_span(array_text, item_id):
    pattern = re.compile(r'\{\s*id:["\']' + re.escape(item_id) + r'["\']')
    m = pattern.search(array_text)
    if not m:
        return None
    start = m.start()
    depth = 0
    quote = None
    esc = False
    for i in range(start, len(array_text)):
        c = array_text[i]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
            continue
        if c in ('"', "'"):
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
    raise ValueError(f'unclosed object: {item_id}')


def find_property_value(obj, key):
    m = re.search(r'(^\s*' + re.escape(key) + r':)', obj, re.M)
    if not m:
        return None
    pos = m.end()
    while pos < len(obj) and obj[pos].isspace():
        pos += 1
    start = pos
    quote = None
    esc = False
    square = curly = 0
    while pos < len(obj):
        c = obj[pos]
        if quote:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in ('"', "'"):
                quote = c
            elif c == '[':
                square += 1
            elif c == ']':
                square -= 1
            elif c == '{':
                curly += 1
            elif c == '}':
                if square == 0 and curly == 0:
                    break
                curly -= 1
            elif c == ',' and square == 0 and curly == 0:
                break
            elif c == '\n' and square == 0 and curly == 0:
                break
        pos += 1
    return start, pos


def set_property(obj, key, value):
    encoded = js_literal(value)
    found = find_property_value(obj, key)
    if found:
        a, b = found
        return obj[:a] + encoded + obj[b:]
    insert_at = obj.rfind('}')
    if insert_at < 0:
        raise ValueError(f'object has no closing brace for {key}')
    prefix = '' if obj[:insert_at].rstrip().endswith('{') else ','
    return obj[:insert_at].rstrip() + prefix + f'\n    {key}:{encoded}\n  ' + obj[insert_at:]


def apply_collection(html, marker, updates):
    a, b = find_array_span(html, marker)
    array = html[a:b]
    for update in updates:
        item_id = update['id']
        found = find_object_span(array, item_id)
        if not found:
            raise ValueError(f'unknown id in {marker}: {item_id}')
        oa, ob = found
        obj = array[oa:ob]
        for key, value in update.get('set', {}).items():
            obj = set_property(obj, key, value)
        array = array[:oa] + obj + array[ob:]
    return html[:a] + array + html[b:]


spec = json.loads(UPDATE.read_text(encoding='utf-8'))
html = INDEX.read_text(encoding='utf-8')
html = apply_collection(html, 'PULSE_EVIDENCE', spec.get('evidence', []))
html = apply_collection(html, 'PULSE_SOURCES', spec.get('sources', []))
INDEX.write_text(html, encoding='utf-8')
print('Pulse data sync complete.')
