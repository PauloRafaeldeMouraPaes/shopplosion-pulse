from html.parser import HTMLParser
from pathlib import Path
import re,sys

p=Path("index.html")
errors=[]
if not p.exists(): errors.append("index.html não encontrado.")
else:
    text=p.read_text(encoding="utf-8")
    workspace=Path('pulse-workspace-v3.js').read_text(encoding='utf-8') if Path('pulse-workspace-v3.js').exists() else ''
css=Path('pulse-workspace-v3.css').read_text(encoding='utf-8') if Path('pulse-workspace-v3.css').exists() else ''
runtime_contract = all(x in workspace for x in ['__PULSE_WORKSPACE_V5__','function mount(html)','function head(kicker,title,sub,next)'])
    checks=[
      ("DOCTYPE", r"<!doctype html>"),
      ("lang pt-BR", r'<html[^>]+lang=["\']pt-BR["\']'),
      ("viewport", r'<meta[^>]+name=["\']viewport["\']'),
      ("title", r"<title>Pulse"),
      ("workspace app root", r'class=["\'][^"\']*app[^"\']*["\']|__PULSE_WORKSPACE_V4__'),
      ("journey", r"01\s*[·.-]\s*Hoje|01\s*[·.-]\s*Comece aqui|\[\[\s*['\"]hoje['\"],\s*['\"]01['\"],\s*['\"]Hoje['\"]"),
      ("universo", r"Universo|02[^<]{0,40}Universo|Oportunidade Canvas"),
      ("investigação", r"Investigação|Investigar"),
      ("análises", r"Análises|Opportunity Canvas"),
    ]
    for label,pat in checks:
        haystack = text if label in {'DOCTYPE','lang pt-BR','viewport','title'} else (workspace + css + text)
        if not re.search(pat,haystack,re.I|re.S): errors.append(f"{label}: contrato ausente")
    if re.search(r'(?:src|href)=["\'][^"\']*(?:^|/)assets/',text,re.I): errors.append("referência a assets/ encontrada")
    for value in re.findall(r'(?:src|href)=["\']([^"\']+)["\']',text,re.I):
        if value.startswith(("#","data:","mailto:","tel:","javascript:","http://","https://")): continue
        if value.startswith(("./","../","/")) and not value.startswith(("./pulse-workspace-v3.js","./pulse-workspace-v3.css")):
            errors.append(f"dependência local proibida no workspace: {value}")
    # The canonical workspace is deliberately shared across routes.
    if 'pulse-workspace-v3.js' not in text and not runtime_contract:
        errors.append('runtime canônico do workspace não está referenciado nem presente')
    class P(HTMLParser):
        void={"area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"}
        def __init__(self): super().__init__(); self.main=0; self.h1=0; self.stack=[]
        def handle_starttag(self,t,a):
            t=t.lower()
            if t=="main": self.main+=1
            if t=="h1": self.h1+=1
            if t not in self.void:self.stack.append(t)
        def handle_endtag(self,t):
            t=t.lower()
            if t in self.void:return
            if self.stack and self.stack[-1]==t:self.stack.pop()
            elif self.stack: self.stack.pop()
    q=P()
    try:q.feed(text);q.close()
    except Exception as e:errors.append(f"HTML parse: {e}")
    if q.main<1 and not runtime_contract:errors.append("main ausente")
    if q.h1<1 and not runtime_contract:errors.append("h1 ausente")
    if q.stack:errors.append("HTML desbalanceado")
if errors:
    print("PULSE WORKSPACE AUDIT FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("PULSE WORKSPACE AUDIT PASSED")
