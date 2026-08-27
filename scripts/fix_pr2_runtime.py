import re
import subprocess
from pathlib import Path

# Deterministic PR2 runtime repair; intentionally idempotent.
path=Path('index.html')
s=path.read_text(encoding='utf-8')
main=subprocess.check_output(['git','show','origin/main:index.html'],text=True)

def extract_function(src,name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',src)
    if not m: raise RuntimeError(f'missing {name} in main')
    start=m.start(); brace=src.find('{',m.start()); depth=0; quote=None; esc=False; i=brace
    while i<len(src):
        c=src[i]
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
        else:
            if c in "'\"`": quote=c
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0: return src[start:i+1]
        i+=1
    raise RuntimeError(f'unclosed {name}')

route=extract_function(main,'pulseRoute')
if not re.search(r'function\s+pulseRoute\s*\(',s):
    marker='window.addEventListener("hashchange",pulseRoute);'
    if marker not in s: raise RuntimeError('pulseRoute call marker missing')
    s=s.replace(marker,route+'\n'+marker,1)

custom=extract_function(main,'pulseRenderCustomAnswer')
if not re.search(r'function\s+pulseRenderCustomAnswer\s*\(',s):
    marker='<script id="pulse-enhancements">'
    if marker not in s: raise RuntimeError('Ask AI insertion marker missing')
    s=s.replace(marker,'<script id="pulse-custom-answer-runtime">\n'+custom+'\n</script>\n\n'+marker,1)

history_names=['pulseSaveHistory','pulseRenderHistory']
history_blocks=[]
for name in history_names:
    m=re.search(r'function\s+'+name+r'\s*\([^)]*\)\s*\{',s)
    if not m: raise RuntimeError(f'missing {name}')
    brace=s.find('{',m.start()); depth=0; quote=None; esc=False; i=brace
    while i<len(s):
        c=s[i]
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
        else:
            if c in "'\"`": quote=c
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0: break
        i+=1
    history_blocks.append(s[m.start():i+1]); s=s[:m.start()]+s[i+1:]
marker='<script id="pulse-enhancements">'
if marker not in s: raise RuntimeError('enhancement script marker missing')
s=s.replace(marker,'<script id="pulse-history-runtime">\n'+'\n\n'.join(history_blocks)+'\n</script>\n\n'+marker,1)

start=s.find('(item.keywords||[]).forEach(function(k){')
if start<0: raise RuntimeError('pulseMatchEvidence keyword loop not found')
end=s.find('});var itemText=',start)
if end<0: raise RuntimeError('pulseMatchEvidence keyword loop end not found')
replacement='(function(){var keywordScores=[];(item.keywords||[]).forEach(function(k){var nk=pulseNormalize(k),kt=pulseEvidenceTokens(nk),raw=kt.length>=2&&q.indexOf(nk)!==-1?10+kt.length*2:0;if(raw){keywordScores.push(raw);phrase++;return;}var fuzzy=pulseFuzzyPhraseScore(qTokens,kt);if(fuzzy>=2)keywordScores.push(fuzzy+(kt.length>=2?2:0));});if(keywordScores.length){keywordScores.sort(function(a,b){return b-a;});score+=keywordScores[0];matched=1;}})();'
s=s[:start]+replacement+s[end+2:]
path.write_text(s,encoding='utf-8')
