from html.parser import HTMLParser
from pathlib import Path
import re
import sys

INDEX = Path("index.html")
errors = []

if not INDEX.exists():
    errors.append("index.html não encontrado")
    print("\n".join(errors))
    sys.exit(1)

text = INDEX.read_text(encoding="utf-8")

# Single-file contract: local runtime scripts/assets must be inline/embedded.
if re.search(r'<script[^>]+(?:src|href)=["\'][^"\']*scripts/', text, re.I):
    errors.append("index.html ainda referencia scripts locais externamente")
if re.search(r'(?:src|href)=["\'][^"\']*assets/', text, re.I):
    errors.append("index.html referencia assets/ externos")

# Core runtime contracts expected by the current product.
required_tokens = [
    "window.PULSE_EVIDENCE",
    "window.PULSE_LOCAL_EVIDENCE",
    "window.pulseMatchEvidence",
    "window.pulseRankEvidence",
    "pulse-category-select",
    "pulse:category-change",
    "SUA BASE LOCAL",
    "Estes estudos ficam salvos apenas neste navegador",
    "journey-step.is-current b{color:#fff!important}",
]
for token in required_tokens:
    if token not in text:
        errors.append(f"contrato ausente: {token}")

# Primary CTA must point to the first evidence screen, not skip a journey step.
if "href=\"#signals\"" not in text and "data-target=\"#signals\"" not in text:
    errors.append("CTA principal para #signals não encontrado")

# Suggestions should have one consolidated runtime handler.
if text.count("clone.addEventListener('click'") != 1:
    errors.append("handler consolidado de sugestões não está único")

# Basic structural HTML balance check, ignoring void elements.
class BalanceParser(HTMLParser):
    void = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stack = []
    def handle_starttag(self, tag, attrs):
        t = tag.lower()
        if t not in self.void:
            self.stack.append(t)
    def handle_startendtag(self, tag, attrs):
        pass
    def handle_endtag(self, tag):
        t = tag.lower()
        if t in self.void:
            return
        if not self.stack or self.stack[-1] != t:
            errors.append(f"HTML desbalanceado: fechamento </{t}>")
            return
        self.stack.pop()

parser = BalanceParser()
try:
    parser.feed(text)
    parser.close()
except Exception as exc:
    errors.append(f"falha ao analisar HTML: {exc}")
if parser.stack:
    errors.append("HTML desbalanceado: tags abertas sem fechamento: " + ", ".join(parser.stack[-8:]))

if errors:
    print("PULSE SINGLE-FILE AUDIT FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PULSE SINGLE-FILE AUDIT PASSED")
