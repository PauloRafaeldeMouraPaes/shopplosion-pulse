const fs = require('fs');

const index = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const ask = fs.existsSync('ask.html') ? fs.readFileSync('ask.html', 'utf8') : '';
const failures = [];

if (!index.includes('window.PULSE_EVIDENCE')) failures.push('public evidence registry missing');
if (!index.includes('pulse-public-evidence-json')) failures.push('public evidence JSON missing');
if (!ask.includes('pulse-workspace-v3.js')) failures.push('Ask AI canonical workspace runtime missing');
for (const text of ['pv4-ask-context', 'pv4-progress', '01 Recuperar', '02 Ler', '03 Escrever']) {
  if (!ask.includes(text)) failures.push(`Ask AI contract missing ${text}`);
}
if (!ask.includes('Minha indústria · Base privada')) failures.push('Ask AI private scope missing');

if (failures.length) {
  console.error('Ask AI regression FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log('Ask AI regression PASSED');
