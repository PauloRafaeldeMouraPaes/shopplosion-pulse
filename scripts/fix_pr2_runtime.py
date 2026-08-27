import re
import subprocess
from pathlib import Path

# Deterministic PR2 runtime repair; intentionally idempotent.
path=Path('index.html')
s=path.read_text(encoding='utf-8')
main=subprocess.check_output(['git','show','origin/main:index.html'],text=True)

def extract_function(src,name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',src)
    if not m: raise RuntimeError(f'missing {name}')
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

def extract_main_function(name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',main)
    if not m: raise RuntimeError(f'missing {name} in main')
    return extract_function(main,name)

# 1) Restore pulseRoute from main before its existing calls.
if not re.search(r'function\s+pulseRoute\s*\(',s):
    route=extract_main_function('pulseRoute')
    marker='window.addEventListener("hashchange",pulseRoute);'
    if marker not in s: raise RuntimeError('pulseRoute call marker missing')
    s=s.replace(marker,route+'\n'+marker,1)

# 2) Restore custom Ask AI renderer and ensure it lives inside a script tag.
custom=extract_function(s,'pulseRenderCustomAnswer') if re.search(r'function\s+pulseRenderCustomAnswer\s*\(',s) else extract_main_function('pulseRenderCustomAnswer')
# Remove any existing standalone definition before reinserting in a dedicated script block.
m=re.search(r'function\s+pulseRenderCustomAnswer\s*\([^)]*\)\s*\{',s)
if m:
    start=m.start(); brace=s.find('{',m.start()); depth=0; quote=None; esc=False; i=brace
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
    s=s[:start]+s[i+1:]
marker='<script id="pulse-enhancements">'
if marker not in s: raise RuntimeError('enhancement script marker missing')
s=s.replace(marker,'<script id="pulse-custom-answer-runtime">\n'+custom+'\n</script>\n\n'+marker,1)

# 3) Move history functions before pulse-enhancements.
history_blocks=[]
for name in ['pulseSaveHistory','pulseRenderHistory']:
    block=extract_function(s,name)
    history_blocks.append(block)
    s=s.replace(block,'',1)
marker='<script id="pulse-enhancements">'
s=s.replace(marker,'<script id="pulse-history-runtime">\n'+'\n\n'.join(history_blocks)+'\n</script>\n\n'+marker,1)

# 4) Limit pulseMatchEvidence to the best keyword contribution per item.
if 'var keywordScores=[]' not in s:
    start=s.find('(item.keywords||[]).forEach(function(k){')
    if start<0: raise RuntimeError('pulseMatchEvidence keyword loop not found')
    end=s.find('var itemText=',start)
    if end<0: raise RuntimeError('pulseMatchEvidence itemText marker not found')
    replacement='(function(){var keywordScores=[];(item.keywords||[]).forEach(function(k){var nk=pulseNormalize(k),kt=pulseEvidenceTokens(nk),raw=kt.length>=2&&q.indexOf(nk)!==-1?10+kt.length*2:0;if(raw){keywordScores.push(raw);phrase++;return;}var fuzzy=pulseFuzzyPhraseScore(qTokens,kt);if(fuzzy>=2)keywordScores.push(fuzzy+(kt.length>=2?2:0));});if(keywordScores.length){keywordScores.sort(function(a,b){return b-a;});score+=keywordScores[0];matched=1;}})();;'
    s=s[:start]+replacement+s[end:]

path.write_text(s,encoding='utf-8')
