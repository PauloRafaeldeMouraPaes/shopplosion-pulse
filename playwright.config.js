const { chromium } = require('@playwright/test');
const SUPABASE_URL='https://ppfuygnpgywfpiqxsfys.supabase.co';
const PUBLISHABLE='sb_publishable_aRzZJXmWvRu86J4I7_VFDw_ucU46Km7';
const LEGACY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZnV5Z25wZ3l3ZnBpcXhzZnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTA5MjcsImV4cCI6MjEwNDEyNjkyN30.A4jnBQ_buy13_t8SZz2gM14ogNp6gi9tmtarIoRXHz8';
async function globalSetup(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  console.log('AUTH NETWORK DIAGNOSTIC: Chromium -> Supabase');
  for(const [name,key] of [['publishable',PUBLISHABLE],['legacy-anon',LEGACY]]){
    const r=await page.evaluate(async({url,key})=>{
      const out={};
      try{const x=await fetch(url+'/auth/v1/settings',{headers:{apikey:key},cache:'no-store'});out.settings={status:x.status,body:(await x.text()).slice(0,200)}}catch(e){out.settings={transport:e.name+' / '+e.message}}
      try{const x=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',mode:'cors',credentials:'omit',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:'diagnostic-invalid@example.invalid',password:'diagnostic-invalid-password'}),cache:'no-store'});out.token={status:x.status,body:(await x.text()).slice(0,300)}}catch(e){out.token={transport:e.name+' / '+e.message}}
      return out;
    },{url:SUPABASE_URL,key});
    console.log(name,JSON.stringify(r));
    if(r.settings?.transport||r.token?.transport) throw new Error('Chromium transport failure for '+name+': '+JSON.stringify(r));
    if(![400,401].includes(r.token?.status)) throw new Error('Unexpected token status for '+name+': '+JSON.stringify(r));
  }
  await browser.close();
}
module.exports={testDir:'./scripts/browser-tests',globalSetup};
