(()=>{'use strict';
const root=document.getElementById('building-admin-root');if(!root)return;
let reports=[],activeToken=null;
const nav=document.getElementById("building-admin-nav"),shortcut=document.getElementById("building-admin-shortcut");
function allowed(){return typeof OFFICER!=="undefined"&&["MASTER","HUBHM"].includes(OFFICER?.role)&&typeof TOKEN!=="undefined"&&!!TOKEN;}
function sync(){const ok=allowed();nav?.classList.toggle("hidden",!ok);shortcut?.classList.toggle("hidden",!ok);if(!ok||activeToken!==TOKEN){reports=[];qs("#building-admin-table").innerHTML="";qs("#building-admin-status").textContent="Open this tab to view cloud submissions.";}activeToken=ok?TOKEN:null;return ok;}
window.qdcBuildingAdmin={sync};
const qs=s=>root.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function refresh(){
  qs('#building-admin-status').textContent='Loading cloud submissions…';
  try{
    if(!sync())throw Error('Sign in as Hub Cluster Incharge or Master Admin first.');
    const requestedToken=TOKEN;
    reports=await callFn('qdc_building_admin_list',{p_token:TOKEN});
    if(!allowed()||TOKEN!==requestedToken){reports=[];return false;}
    if(!Array.isArray(reports))throw Error('Unexpected response from server.');
    draw();return true;
  }catch(e){reports=[];qs('#building-admin-status').textContent=e.message;qs('#building-admin-table').innerHTML='';return false}
}
function draw(){
  qs('#building-admin-status').textContent=reports.length+' schools · '+reports.reduce((n,r)=>n+Number(r.danger),0)+' dangerously damaged rooms · '+reports.reduce((n,r)=>n+Number(r.partial),0)+' partially damaged rooms';
  const cell=qs('#building-admin-cell').value;
  const rows=reports.filter(r=>!cell||r.cell_code===cell);
  qs('#building-admin-table').innerHTML=rows.length?rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.feeder_school)+'<br><small>'+esc(r.feeder_semis)+'</small></td><td>'+esc(r.cell_code)+'</td><td>'+esc(r.rooms)+'</td><td>'+esc(r.danger)+'</td><td>'+esc(r.partial)+'</td><td><button class="btn sm ghost" data-school="'+esc(r.id)+'" type="button">Single-school Excel</button></td></tr>').join(''):'<tr><td colspan="7">No submissions found.</td></tr>';
  qs('#building-admin-table').querySelectorAll('[data-school]').forEach(btn=>btn.addEventListener('click',()=>download(reports.filter(r=>String(r.id)===btn.dataset.school)).catch(e=>alert(e.message))));
}
function setCell(xml,ref,value){const re=new RegExp('<c r="'+ref+'"[^>]*?\\/>|<c r="'+ref+'"[^>]*?>[\\s\\S]*?<\\/c>'),found=xml.match(re);if(!found)throw Error('Master template cell '+ref+' missing');const style=found[0].match(/\bs="(\d+)"/)?.[1]||'0';const numeric=typeof value==='number'&&Number.isFinite(value);return xml.replace(re,'<c r="'+ref+'" s="'+style+'" t="'+(numeric?'n':'str')+'"><v>'+(numeric?value:esc(value))+'</v></c>')}
function setCached(xml,ref,value){const re=new RegExp('<c r="'+ref+'"[^>]*?>[\\s\\S]*?<\\/c>'),found=xml.match(re);if(!found)throw Error('Master template formula cell '+ref+' missing');const cachedValue=/<v\s*\/>|<v[^>]*>[\s\S]*?<\/v>/;if(!cachedValue.test(found[0]))throw Error('Master formula value missing: '+ref);const next=found[0].replace(cachedValue,'<v>'+value+'</v>');return xml.replace(re,next)}
function monochrome(styles){return styles.replace(/<fonts\b[^>]*>[\s\S]*?<\/fonts>/,whole=>whole.replace(/<font>([\s\S]*?)<\/font>/g,(tag,inner)=>{inner=inner.replace(/<color\b[^>]*\/>/g,'');if(inner.includes('<sz val="22"/>')&&!inner.includes('<b/>'))inner='<b/>'+inner;return '<font>'+inner+'<color rgb="FF111111"/></font>'})).replace(/<fills\b[^>]*>[\s\S]*?<\/fills>/,whole=>{let i=0;return whole.replace(/<fill>[\s\S]*?<\/fill>/g,tag=>i++<2?tag:'<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>')}).replace(/<dxfs\b[^>]*>[\s\S]*?<\/dxfs>/,whole=>whole.replace(/<color\b[^>]*\/>/g,'<color rgb="FF111111"/>').replace(/<bgColor\b[^>]*\/>/g,'<bgColor rgb="FFFFFFFF"/>')).replace(/rgb="FF(?:183447|173F58|A93F38)"/g,'rgb="FF222222"')}

async function download(rows){
if(!allowed())throw Error('Hub Cluster Incharge or Master Admin access required.');
if(!rows.length)throw Error('No school submissions to export.');
if(rows.length>40)throw Error('The DEO master workbook supports up to 40 rows.');
if(!window.fflate||!window.BUILDING_SURVEY_TEMPLATE)throw Error('Excel template not loaded.');
const bytes=Uint8Array.from(atob(window.BUILDING_SURVEY_TEMPLATE),s=>s.charCodeAt(0)),zip=fflate.unzipSync(bytes),path='xl/worksheets/sheet1.xml',enc=new TextEncoder(),dec=new TextDecoder();
let sheet=dec.decode(zip[path]);
sheet=setCell(sheet,'A2','OFFICE OF THE CLUSTER HUB SCHOOL — GBHS QAMAR DIN CHANDIO · SEMIS CODE 416030640');
sheet=setCell(sheet,'A3','SURVEY OF DANGEROUS / PARTIALLY DANGEROUS GOVERNMENT SCHOOL BUILDINGS');
sheet=sheet.replace('IF(COUNTA(B6:J6)=0,"",ROW()-8)','IF(COUNTA(B6:J6)=0,"",ROW()-5)');
rows.forEach((v,i)=>{const n=i+6,fields={B:'GBHS Qamar Din Chandio · SEMIS 416030640',C:v.cell_hub,D:v.feeder_school+' · SEMIS '+v.feeder_semis,E:v.blocks+' blocks / '+v.rooms+' rooms',F:Number(v.danger),G:Number(v.partial),H:v.requirement,I:v.substitute,J:v.remarks||''};for(const [col,value] of Object.entries(fields))sheet=setCell(sheet,col+n,value);sheet=setCached(sheet,'A'+n,i+1)});
for(const [ref,value] of Object.entries({E46:rows.length,F46:rows.reduce((n,r)=>n+Number(r.danger),0),G46:rows.reduce((n,r)=>n+Number(r.partial),0)}))sheet=setCached(sheet,ref,value);
zip[path]=enc.encode(sheet);
zip['xl/styles.xml']=enc.encode(monochrome(dec.decode(zip['xl/styles.xml'])));
const blob=new Blob([fflate.zipSync(zip,{level:6})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
a.href=url;a.download='Qamardin_Building_Safety_'+(rows.length===1?rows[0].feeder_semis:'Combined_All_Schools')+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);
}
nav.addEventListener('click',refresh);
document.getElementById('building-overview-schools').addEventListener('click',()=>{if(sync())nav.click();});
document.getElementById('building-overview-combined').addEventListener('click',async()=>{if(!sync())return;openTab('building');if(await refresh())download(reports).catch(e=>alert(e.message));});
sync();
qs('#building-admin-refresh').addEventListener('click',refresh);
qs('#building-admin-cell').addEventListener('change',draw);
qs('#building-admin-export').addEventListener('click',()=>download(reports).catch(e=>alert(e.message)));
})();