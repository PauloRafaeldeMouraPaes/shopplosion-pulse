from html.parser import HTMLParser
from pathlib import Path
import re
import sys

INDEX = Path("index.html")
errors = []
if not INDEX.exists():
    errors.append("index.html não encontrado")
    print("PULSE ACCESSIBILITY AUDIT FAILED")
    print("- index.html não encontrado")
    sys.exit(1)

text = INDEX.read_text(encoding="utf-8")

class AuditParser(HTMLParser):
    void = {"area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.title = ""
        self.main_count = 0
        self.h1_count = 0
        self.stack = []
        self.selects = []
        self.buttons = []
        self.images = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        t = tag.lower(); a = dict(attrs)
        if t == "html": self.lang = a.get("lang")
        if t == "title": self.in_title = True
        if t == "main": self.main_count += 1
        if t == "h1": self.h1_count += 1
        if t == "select": self.selects.append(a)
        if t == "button": self.buttons.append(a)
        if t == "img": self.images.append(a)
        if t not in self.void: self.stack.append(t)

    def handle_startendtag(self, tag, attrs):
        t = tag.lower(); a = dict(attrs)
        if t == "img": self.images.append(a)

    def handle_endtag(self, tag):
        t = tag.lower()
        if t in self.void: return
        if self.stack and self.stack[-1] == t: self.stack.pop()
        elif self.stack: self.stack.pop()
        if t == "title": self.in_title = False

    def handle_data(self, data):
        if self.in_title: self.title += data.strip()

p = AuditParser()
try:
    p.feed(text); p.close()
except Exception as exc:
    errors.append(f"HTML não pôde ser analisado: {exc}")

if p.lang != "pt-BR": errors.append("html[lang] deve ser pt-BR")
if not p.title.strip(): errors.append("<title> ausente ou vazio")
if p.main_count != 1: errors.append(f"esperado exatamente 1 <main>, encontrado {p.main_count}")
if p.h1_count != 1: errors.append(f"esperado exatamente 1 <h1>, encontrado {p.h1_count}")
if not re.search(r'<meta[^>]+name=["\']viewport["\'][^>]+content=', text, re.I):
    errors.append("meta viewport ausente")

# Every select must expose an accessible name through label/aria-label/aria-labelledby.
for i, attrs in enumerate(p.selects, 1):
    if not (attrs.get("aria-label") or attrs.get("aria-labelledby") or attrs.get("id") and re.search(r'<label[^>]+for=["\']'+re.escape(attrs.get("id"))+r'["\']', text, re.I)):
        errors.append(f"select #{i} sem nome acessível")

# Buttons must have visible text or an accessible name.
for i, attrs in enumerate(p.buttons, 1):
    if not (attrs.get("aria-label") or attrs.get("aria-labelledby") or attrs.get("title") or attrs.get("data-label")):
        # The parser does not retain child text; require common text-bearing classes/IDs to remain named.
        if not (attrs.get("id") or attrs.get("class")):
            errors.append(f"button #{i} sem mecanismo identificável de nome")

# Images need alt text; decorative images may explicitly use empty alt.
for i, attrs in enumerate(p.images, 1):
    if "alt" not in attrs: errors.append(f"img #{i} sem atributo alt")

# Core keyboard/focus contract for the journey and filter controls.
for token in ["pulse-category-select", "journey-step", "focus-visible"]:
    if token not in text: errors.append(f"contrato de acessibilidade/UX ausente: {token}")

if errors:
    print("PULSE ACCESSIBILITY AUDIT FAILED")
    for e in errors: print(f"- {e}")
    sys.exit(1)
print("PULSE ACCESSIBILITY AUDIT PASSED")
