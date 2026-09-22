from html.parser import HTMLParser
from pathlib import Path
import re
import sys

INDEX = Path("index.html")
RUNTIME = Path("pulse-workspace-v3.js")
CSS = Path("pulse-workspace-v3.css")
errors = []

if not INDEX.exists():
    errors.append("index.html não encontrado.")
else:
    text = INDEX.read_text(encoding="utf-8")
    workspace = RUNTIME.read_text(encoding="utf-8") if RUNTIME.exists() else ""
    css = CSS.read_text(encoding="utf-8") if CSS.exists() else ""
    runtime_contract = all(x in workspace for x in [
        "__PULSE_WORKSPACE_V5__",
        "function mount(html)",
        "function head(kicker,title,sub,next)",
        "data-nav",
        "pv4-inspector",
    ])

    checks = [
        ("DOCTYPE", r"<!doctype html>", text),
        ("lang pt-BR", r'<html[^>]+lang=["\']pt-BR["\']', text),
        ("viewport", r'<meta[^>]+name=["\']viewport["\']', text),
        ("title", r"<title>Pulse", text),
        ("workspace app root", r"pv4-app", workspace),
        ("journey", r"Hoje.*Universo.*Base.*Investigação.*Análises", workspace),
        ("universo", r"Universo", workspace),
        ("investigação", r"Investigação", workspace),
        ("análises", r"Análises", workspace),
    ]
    for label, pattern, haystack in checks:
        if not re.search(pattern, haystack, re.I | re.S):
            errors.append(f"{label}: contrato ausente")

    if not runtime_contract:
        errors.append("runtime canônico incompleto em pulse-workspace-v3.js")

    for value in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', text, re.I):
        if value.startswith(("#", "data:", "mailto:", "tel:", "javascript:", "http://", "https://")):
            continue
        if value.startswith(("./", "../", "/")) and not value.startswith(("./pulse-workspace-v3.js", "./pulse-workspace-v3.css", "./pulse-config.js")):
            errors.append(f"dependência local proibida no workspace: {value}")

    if "pulse-workspace-v3.js" not in text:
        errors.append("index.html não referencia o runtime canônico do workspace")

    class P(HTMLParser):
        void = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

        def __init__(self):
            super().__init__()
            self.main = 0
            self.h1 = 0
            self.stack = []

        def handle_starttag(self, tag, attrs):
            tag = tag.lower()
            if tag == "main":
                self.main += 1
            if tag == "h1":
                self.h1 += 1
            if tag not in self.void:
                self.stack.append(tag)

        def handle_endtag(self, tag):
            tag = tag.lower()
            if tag in self.void:
                return
            if self.stack and self.stack[-1] == tag:
                self.stack.pop()
            elif self.stack:
                self.stack.pop()

    parser = P()
    try:
        parser.feed(text)
        parser.close()
    except Exception as exc:
        errors.append(f"HTML parse: {exc}")
    if parser.stack:
        errors.append("HTML desbalanceado")

if errors:
    print("PULSE WORKSPACE AUDIT FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("PULSE WORKSPACE AUDIT PASSED")
