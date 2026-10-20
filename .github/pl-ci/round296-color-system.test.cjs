const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const test=require('node:test');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const status=JSON.parse(fs.readFileSync(path.join(root,'CURRENT_PROJECT_STATUS.json'),'utf8'));
function rgb(hex){const m=/^#([0-9a-f]{6})$/i.exec(hex); assert.ok(m,`expected hex, got ${hex}`); const n=parseInt(m[1],16);return[(n>>16)&255,(n>>8)&255,n&255].map(v=>v/255)}
function lum(hex){return rgb(hex).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)}
function contrast(a,b){const [x,y]=[lum(a),lum(b)].sort((a,b)=>b-a);return(x+.05)/(y+.05)}
function block(theme){const re=new RegExp(`html\\[data-theme="${theme}"\\],html\\.compat-legacy-color\\[data-theme="${theme}"\\]\\{([\\s\\S]*?)\\}`);const m=html.match(re);assert.ok(m,`missing Stage126 block for ${theme}`);return m[1]}
function prop(src,name){const m=src.match(new RegExp(`--${name}:([^;]+);`));assert.ok(m,`missing --${name}`);return m[1].trim()}
const themes=['mist','rain','night','tomato','sakura','iris'];
test('Stage126 is the unique current release',()=>{assert.equal(status.current.stage,126);assert.equal(status.current.appVersion,'8.1.12.304');assert.match(html,/v8\.1\.12\.304/)});
test('all themes expose complete Primary and Gray ramps',()=>{for(const t of themes){const b=block(t);for(const k of [50,100,200,300,400,500,600,700,800,900]){prop(b,`primary-${k}`);prop(b,`gray-${k}`)}}});
test('all themes expose semantic roles',()=>{for(const t of themes){const b=block(t);for(const k of ['page-bg','surface-1','surface-2','surface-3','surface-4','border-subtle','border-strong','text-primary','text-secondary','text-muted','text-faint','accent','accent-hover','accent-active','accent-soft','success','warning','danger']) prop(b,k)}});
test('primary actions and text meet minimum contrast',()=>{for(const t of themes){const b=block(t);const accent=prop(b,'accent'),on=prop(b,'accent-on'),surface=prop(b,'surface-1'),text=prop(b,'text-primary'),muted=prop(b,'text-muted');assert.ok(contrast(accent,on)>=4.5,`${t} accent contrast ${contrast(accent,on).toFixed(2)}`);assert.ok(contrast(text,surface)>=7,`${t} primary text contrast ${contrast(text,surface).toFixed(2)}`);assert.ok(contrast(muted,surface)>=4.5,`${t} muted text contrast ${contrast(muted,surface).toFixed(2)}`)}});
test('light themes share one coherent feedback palette',()=>{const light=['mist','rain','tomato','sakura','iris'];for(const role of ['success','success-soft','warning','warning-soft','danger','danger-soft']){const values=light.map(t=>prop(block(t),role));assert.equal(new Set(values).size,1,`${role} drifts across light themes`)}});
test('theme previews and role colors are bound to the new system',()=>{for(const t of themes){assert.match(html,new RegExp(`\\.theme-preview-${t}\\{`));assert.match(html,new RegExp(`html\\[data-theme="${t}"\\]\\{--t-role-kp:`))}});
