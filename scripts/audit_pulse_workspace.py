from html.parser import HTMLParser
from pathlib import Path
import re,sys

p=Path("index.html")
errors=[]
if not p.exists(): errors.append("index.html não encontrado.")
else:
    text=p.read_text(encoding="utf-8")
    checks=[
      ("DOCTYPE", r"<!doctype html>"),
      ("lang pt-BR", r'<html[^>]+lang=["\']pt-BR["\']'),
      ("viewport", r'<meta[^>]+name=["\']viewport["\']'),
      ("title", r"<title>Pulse"),
      ("workspace app root", r'class=["\'][^"\']*app[^"\']*["\']'),
      ("journey", r"01\s*[·.-]\s*Hoje|01\s*[·.-]\s*Comece aqui|data-nav=[\"\']hoje[\"\']"),
      ("universo", r"Universo|02[^<]{0,40}Universo|Oportunidade Canvas"),
      ("investigação", r"Investigação|Investigar"),
      ("análises", r"Análises|Opportunity Canvas"),
    ]
    for label,pat in checks:
        if not re.search(pat,text,re.I|re.S): errors.append(f"{label}: contrato ausente")
    if re.search(r'(?:src|href)=["\'][^"\']*(?:^|/)assets/',text,re.I): errors.append("referência a assets/ encontrada")
    for value in re.findall(r'(?:src|href)=["\']([^"\']+)["\']',text,re.I):
        if value.startswith(("#","data:","mailto:","tel:","javascript:","http://","https://")): continue
        if value.startswith(("./","../","/")):
            errors.append(f"dependência local proibida no single-file workspace: {value}")
    if re.search(r'<script[^>]+(?:src|href)=["\'][^"\']*(?:scripts/|pulse-)',text,re.I):
        errors.append("runtime externo/local encontrado; workspace deve ser autocontido")
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
    if q.main<1:errors.append("main ausente")
    if q.h1<1:errors.append("h1 ausente")
    if q.stack:errors.append("HTML desbalanceado")
if errors:
    print("PULSE WORKSPACE AUDIT FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("PULSE WORKSPACE AUDIT PASSED")
