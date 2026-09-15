const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const secret = 'Test-only-secret-with-at-least-32-bytes';
const password = 'Regression-only-password-2026!';

test('unsafe startup settings are rejected', () => {
  for (const values of [{ JWT_SECRET: '', ADMIN_PASSWORD: password }, { JWT_SECRET: secret, ADMIN_PASSWORD: '123456' }]) {
    const p = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(root,'config.js'))})`], { env: { ...process.env, ...values } });
    assert.notEqual(p.status, 0);
  }
});

test('security and data integrity regressions', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-regression-'));
  for (const p of ['app.js','config.js','db.js','routes','web']) fs.cpSync(path.join(root,p),path.join(tmp,p),{recursive:true});
  fs.mkdirSync(path.join(tmp,'uploads'));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  // Exercise migration from the old users schema without changing its password.
  fs.mkdirSync(path.join(tmp,'database'));
  const sqlite = require('sqlite3');
  await new Promise((resolve,reject)=>{
    const db=new sqlite.Database(path.join(tmp,'database/nav.db'));
    db.serialize(()=>{
      db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)');
      db.run('INSERT INTO users VALUES (1, ?, ?)', ['admin',require('bcryptjs').hashSync(password,4)]);
      db.close(err=>err?reject(err):resolve());
    });
  });
  const child = spawn(process.execPath, ['app.js'], { cwd:tmp, env:{...process.env, PORT:'14321', JWT_SECRET:secret, ADMIN_PASSWORD:password, ADMIN_USERNAME:'admin'} });
  let logs=''; child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
  t.after(async()=>{child.kill(); await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));fs.rmSync(tmp,{recursive:true,force:true});});
  const api=async(p,body,token,method)=>fetch('http://127.0.0.1:14321'+p,{method:method||(body?'POST':'GET'),headers:{...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
  for(let i=0;i<60;i++){try{if((await api('/api/menus')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  assert.equal(child.exitCode,null,logs);
  let token;
  await t.test('login and trustworthy IP',async()=>{
    const r=await fetch('http://127.0.0.1:14321/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.77'},body:JSON.stringify({username:'admin',password})});
    assert.equal(r.status,200);token=(await r.json()).token;
    const me=await (await api('/api/users/me',null,token)).json();assert.notEqual(me.last_login_ip,'203.0.113.77');
  });
  await t.test('forged tokens and nonexistent users cannot write',async()=>{
    for(const forged of [jwt.sign({id:1},'your_jwt_secret_key'),jwt.sign({id:999999,version:0},secret,{issuer:'nav-item',audience:'nav-item-admin'})]) assert.equal((await api('/api/menus',{name:'forged'},forged)).status,401);
    assert.equal((await api('/api/users')).status,401);
  });
  await t.test('password types are rejected without terminating server',async()=>{
    assert.equal((await api('/api/users/password',{oldPassword:{x:1},newPassword:password},token,'PUT')).status,400);
    assert.equal((await api('/api/menus')).status,200);
  });
  await t.test('uploads require authentication, enforce limits, reencode images',async()=>{
    const form=(blob,name)=>{const f=new FormData();f.append('logo',blob,name);return f;};
    assert.equal((await api('/api/upload',form(new Blob(['hello']),'a.html'))).status,401);
    for(const content of ['<script>alert(1)</script>','<svg xmlns="http://www.w3.org/2000/svg"></svg>']) assert.equal((await api('/api/upload',form(new Blob([content]),'fake.png'),token)).status,400);
    assert.equal((await api('/api/upload',form(new Blob([Buffer.alloc(2*1024*1024+1)]),'big.png'),token)).status,413);
    const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
    const r=await api('/api/upload',form(new Blob([png],{type:'image/png'}),'tiny.png'),token);assert.equal(r.status,200);
    const uploaded=await r.json();assert.match(uploaded.filename,/^[a-f0-9-]+\.png$/);
    const stored=await api(uploaded.url);assert.equal(stored.status,200);assert.match(stored.headers.get('content-security-policy'),/sandbox/);
    fs.writeFileSync(path.join(tmp,'uploads','legacy.html'),'<script>bad()</script>');
    assert.equal((await api('/uploads/legacy.html')).status,404);
  });
  await t.test('URLs, pagination and cascading deletion',async()=>{
    assert.equal((await api('/api/menus?pageSize=-1')).status,400);
    const m=await (await api('/api/menus',{name:'parent'},token)).json();
    const s=await (await api(`/api/menus/${m.id}/submenus`,{name:'child'},token)).json();
    const card={menu_id:m.id,sub_menu_id:s.id,title:'card',url:'https://example.com'};
    assert.equal((await api('/api/cards',{...card,url:'javascript:void(0)'},token)).status,400);
    assert.equal((await api('/api/cards',card,token)).status,200);
    assert.equal((await api(`/api/menus/${m.id}`,null,token,'DELETE')).status,200);
    assert.deepEqual(await (await api(`/api/cards/${m.id}?subMenuId=${s.id}`)).json(),[]);
    assert.deepEqual(await (await api(`/api/menus/${m.id}/submenus`)).json(),[]);
  });
  await t.test('password change and logout revoke sessions',async()=>{
    const changed='New-regression-password-2026!';
    assert.equal((await api('/api/users/password',{oldPassword:password,newPassword:changed},token,'PUT')).status,200);
    assert.equal((await api('/api/users',null,token)).status,401);
    const r=await api('/api/login',{username:'admin',password:changed});assert.equal(r.status,200);token=(await r.json()).token;
    assert.equal((await api('/api/logout',{},token)).status,204);
    assert.equal((await api('/api/users',null,token)).status,401);
  });
  await t.test('login throttling and browser security headers',async()=>{
    let limited=false;
    for(let i=0;i<12;i++)if((await api('/api/login',{username:'admin',password:'wrong'})).status===429){limited=true;break;}
    assert.equal(limited,true);
    const r=await api('/');assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  });
});
