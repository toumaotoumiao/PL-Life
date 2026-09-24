'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const projectRoot=path.resolve(__dirname,'../..');
const siteRoot=fs.existsSync(path.join(projectRoot,'site','index.html'))?path.join(projectRoot,'site'):projectRoot;
const html=fs.readFileSync(path.join(siteRoot,'index.html'),'utf8');
function code(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,`source ${a}`);return html.slice(i,j);}
function index(col){let n=0;for(const ch of col)n=n*26+ch.charCodeAt(0)-64;return n-1;}
function rows(cells){const out=[];for(const [ref,v] of Object.entries(cells)){const m=ref.match(/^([A-Z]+)(\d+)$/);const r=+m[2]-1,c=index(m[1]);if(!out[r])out[r]=[];out[r][c]=v;}return out;}
function shiftedSheet(){return {name:'人物卡',rows:rows({
 B3:'姓名',E3:'虚构角色',B5:'职业',E5:'剑修',B15:'技能表',B55:'武器表',B64:'资产',W64:'背景故事',B82:'状态',D82:'部位',F82:'物品名称',B99:'调查员经历',B117:'有故事的调查员经历包：',W132:'调查员伙伴',
 W67:'思想与信念',AA67:'虚构信念',W69:'重要之人',AA69:'虚构师友',W71:'意义非凡之地',AA71:'虚构山门',W73:'宝贵之物',AA73:'虚构佩剑',W75:'特质',AA75:'虚构特质',W77:'伤口和疤痕',AA77:'旧伤',W79:'恐惧症和躁狂症',AA79:'无',W81:'虚构背景补充',
 F18:'会计',J18:5,L18:0,N18:0,P18:0,R18:5,AB19:'聆听',AF19:20,AJ19:17,AN19:37,F21:'技艺①',H21:'厨艺',J21:5,P21:30,R21:35,F50:'神识探知',J50:37,N50:35,R50:72,
 B56:'武器名称',G56:'类型',M56:'使用技能',W56:'伤害',AE56:'次数',AG56:'装弹量',B57:'无',G57:'肉搏',M57:'斗殴',W57:'1D3+DB',AE57:1,AG57:'——',B58:'空山',G58:'中型剑',M58:'剑',W58:'1D6+1+DB',AE58:'1',AG58:'——',B61:'返景',G61:'渡鸦',
 B65:'信用评级',F65:'生活水平',I65:'消费水平',L65:'其他资产',O66:'#NAME?',S66:'日币',L67:'请在这里详述你的资产',B83:'在身',D83:'腰间',F83:'符袋',N83:'干粮'
 })};}
function context(){const c={Map,Set,Date,console,pcExcelColIndex:index,pcExcelColumnName:i=>{let n=i+1,r='';while(n){r=String.fromCharCode(65+(n-1)%26)+r;n=Math.floor((n-1)/26);}return r;},pcExcelNonEmpty:v=>v!==null&&v!==undefined&&String(v).trim()!=='',uid:()=> 'u',normalizedEntityNameKey:s=>String(s||'').trim().toLowerCase(),makeBlankPc:()=>({name:'',era:'',occupation:'',age:'',gender:'',residence:'',birthplace:'',coc:{str:'',dex:'',pow:'',con:'',app:'',edu:'',siz:'',int:'',luck:'',hp:'',hpMax:'',san:'',sanMax:'',mp:'',mpMax:'',mov:'',build:'',db:'',armor:''},skills:[],weapons:[],background:{description:'',ideology:'',significantPeople:'',meaningfulLocations:'',treasuredPossessions:'',traits:'',injuries:'',phobias:'',notes:''},inventory:'',assets:''}),pcDraft:null,selfProfileId:()=>''};vm.createContext(c);
 vm.runInContext(code('function pcExcelA1(', 'function pcExcelKnownTemplate('),c);
 c.pcExcelKnownTemplate=()=>null;c.PC_EXCEL_KAGURA_TEMPLATE={id:'kagura-coc7',name:'CoC7'};c.pcExcelVerifiedVariant=()=>null;
 vm.runInContext(code('const PC_EXCEL_KAGURA_STANDARD_LAYOUT=', '/* 固定模板填写差异'),c);
 vm.runInContext(code('const PC_CARD_TIME_REFS=', 'function pcNormalizeCardTime('),c);
 vm.runInContext(code('function pcExcelWriteIfChanged(', 'function pcExcelSupplementSheet('),c);
 vm.runInContext(code('function pcExcelKaguraCleanSkillBase(', 'function pcMergeNamedRows('),c);
 return c;}

test('2020/06-style shifted Kagura family is detected by section anchors instead of exact B147 version',()=>{const c=context(),sheet=shiftedSheet(),l=c.pcExcelKaguraFamilyLayout(sheet);assert(l);assert.equal(l.skillStart,17);assert.equal(l.skillEnd,53);assert.equal(l.weaponStart,57);assert.equal(l.weaponEnd,62);assert.equal(l.assetValueRow,66);assert.equal(l.inventoryStart,83);assert.equal(l.background.notes,81);});

test('unverified family imports only allocated skills, keeps custom named weapon, and ignores Excel error cash',()=>{const c=context(),sheet=shiftedSheet(),l=c.pcExcelKaguraFamilyLayout(sheet),pc=c.pcParseKaguraCoc7Sheet(sheet,'synthetic.xlsx',l,{familyUnverified:true});const names=pc.skills.map(x=>x.name);assert(!names.includes('会计'));assert(names.includes('聆听'));assert(names.includes('技艺（厨艺）'));assert(names.includes('神识探知'));assert.equal(JSON.stringify(pc.weapons.map(x=>x.name)),JSON.stringify(['空山','返景']));assert.equal(pc.background.ideology,'虚构信念');assert.match(pc.background.notes,/虚构背景补充/);assert.match(pc.inventory,/符袋/);assert.doesNotMatch(pc.assets,/#NAME/);});

test('purposeful extra-cell scope rejects hidden helper cache while keeping visible player/time/history areas',()=>{const c=context(),l=c.pcExcelKaguraFamilyLayout(shiftedSheet());assert.equal(c.pcExcelVisibleExtraRef('BA18',l),false);assert.equal(c.pcExcelVisibleExtraRef('E4',l),true);assert.equal(c.pcExcelVisibleExtraRef('J101',l),true);assert.equal(c.pcExcelVisibleExtraRef('AD134',l),true);});

test('export patch targets shifted background, inventory and asset rows rather than 2020/05 hard-coded cells',()=>{const c=context(),sheet=shiftedSheet(),l=c.pcExcelKaguraFamilyLayout(sheet),pc=c.makeBlankPc();pc.name='导出测试';pc.background.ideology='新信念';pc.background.notes='背景补充：新背景';pc.inventory='护符（状态：在身；部位：腰间）\n背包内：药草';pc.assets='资产说明：新资产\n交通工具：白马';pc.skills=[{name:'聆听',value:45}];pc.weapons=[{name:'空山',skill:'剑',damage:'1D8',attacks:'1',ammo:''}];const r=c.pcExcelPatchKaguraRows(sheet.rows,pc,l);assert.equal(r.changes.get('AA67'),'新信念');assert.equal(r.changes.get('W81'),'新背景');assert.equal(r.changes.get('F83'),'护符');assert.equal(r.changes.get('N83'),'药草');assert.equal(r.changes.get('L67'),'新资产');assert.equal(r.changes.get('B74'),'白马');assert(!r.changes.has('AA63'));});

test('single/batch import and export all route Kagura family variants before generic fallback',()=>{assert.match(html,/pcExcelKaguraFamilyTemplate\(sheets\)/);assert.match(html,/familyUnverified:!family\.familyVerified/);assert.match(html,/pcExcelPatchKaguraRows\(family\.sheet\.rows,pc,family\.layout\)/);assert.match(html,/同系模板结构读取/);});
