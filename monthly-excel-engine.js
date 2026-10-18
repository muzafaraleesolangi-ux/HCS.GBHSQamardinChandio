(()=>{'use strict';const roman=g=>['','I','II','III','IV','V'][Number(g)]||String(g);
function buildExcel(d,m,semis){
 const zip=fflate.unzipSync(Uint8Array.from(atob(window.MPR_TEMPLATE),c=>c.charCodeAt(0))), enc=new TextEncoder(),dec=new TextDecoder(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const parse=s=>new DOMParser().parseFromString(s,'application/xml'),serialize=x=>new XMLSerializer().serializeToString(x),original=dec.decode(zip['xl/worksheets/sheet1.xml']);
 // Preserve existing formatting and add wrapped variants for readable data.
 let styleXML=dec.decode(zip['xl/styles.xml']);
 const xfBlock=styleXML.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/),baseXfs=xfBlock[1].match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g),extraXfs=[],styleMap=new Map();
 const fontBlock=styleXML.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/),fontCount=Number(fontBlock[0].match(/count="(\d+)"/)[1]);
 styleXML=styleXML.replace(fontBlock[0],fontBlock[0].replace(/count="\d+"/,'count="'+(fontCount+1)+'"').replace('</fonts>','<font><b/><sz val="12"/><color rgb="FF173B36"/><name val="Cambria"/><family val="2"/></font></fonts>'));
 const readableStyle=(base,kind='normal')=>{const key=base+':'+kind;if(styleMap.has(key))return styleMap.get(key);let xf=baseXfs[Number(base)||0]||extraXfs[Number(base)-baseXfs.length];xf=xf.replace(/<alignment\b[^>]*\/>/g,'').replace(/ applyAlignment="[^"]*"/g,'');if(xf.endsWith('/>'))xf=xf.slice(0,-2)+'></xf>';xf=xf.replace('<xf ','<xf applyAlignment="1" ');if(kind==='signature')xf=xf.replace(/fontId="\d+"/,'fontId="'+fontCount+'"').replace(/ applyFont="[^"]*"/g,'').replace('<xf ','<xf applyFont="1" ');xf=xf.replace('</xf>','<alignment horizontal="'+(kind==='school'?'left':'center')+'" vertical="'+(kind==='school'?'top':'center')+'" wrapText="1" textRotation="'+(kind==='school'?'90':'0')+'"/></xf>');const id=baseXfs.length+extraXfs.length;extraXfs.push(xf);styleMap.set(key,id);return id;};
 const slots=[[8,10],[11,12],[13,15],[16,18],[19,21],[22,25],[26,28],[29,32],[33,35],[36,38],[39,42],[43,46],[47,50]];
 const office=d.profile.gender==='Female'?'Head Mistress':d.profile.gender==='Male'?'Head Master':d.profile.office||'Head Master';
 const tasks=(d.teachers||[]).map((teacher,index)=>({teacher,index,items:(d.assignments||[]).filter(a=>a.teacher===teacher.id)}));
 let taskIndex=0,offset=0,page=0;const retainedStrings=new Set();
 do{
  page++;const doc=parse(original),rows=doc.getElementsByTagName('row');
  const cell=ref=>{let c=doc.querySelector('c[r="'+ref+'"]');if(c)return c;const row=Array.from(rows).find(r=>r.getAttribute('r')===ref.match(/\d+/)[0]);c=doc.createElementNS(ns,'c');c.setAttribute('r',ref);const col=s=>Array.from(s.match(/^[A-Z]+/)[0]).reduce((n,v)=>n*26+v.charCodeAt(0)-64,0);const next=Array.from(row.children).find(n=>n.getAttribute('r')&&col(n.getAttribute('r'))>col(ref));row.insertBefore(c,next||null);return c;};
  const widths={A:6.7,B:9.28,C:20,D:10.28,E:10.28,F:12.57,G:15.98,H:11.49,I:9.71,J:8.57,K:12.43,L:12.43,M:13.09,N:13.14};
  const fit=(ref,value)=>{if(value==null||String(value)==='')return;const c=cell(ref),kind=ref==='B8'?'school':ref==='K56'?'signature':'normal';c.setAttribute('s',readableStyle(c.getAttribute('s')||'0',kind));const start=Number(ref.match(/\d+/)[0]),col=ref.match(/^[A-Z]+/)[0];const merge=Array.from(doc.getElementsByTagName('mergeCell')).map(x=>x.getAttribute('ref')).find(x=>x.split(':')[0]===ref);const endRef=merge?merge.split(':')[1]:ref,end=Number(endRef.match(/\d+/)[0]),lastCol=endRef.match(/^[A-Z]+/)[0];let width=0;for(let n=col.charCodeAt(0);n<=lastCol.charCodeAt(0);n++)width+=widths[String.fromCharCode(n)]||10;
   if(kind==='school')return;const capacity=Math.max(3,Math.floor(width*(kind==='signature'?0.8:kind==='school'?0.65:0.9))-1);let lines=0;for(const paragraph of String(value).split('\n')){let line=0;for(const word of paragraph.split(/\s+/)){const size=Array.from(word).reduce((n,ch)=>n+(/[^\x00-\x7F]/.test(ch)?1.3:/[MW@]/.test(ch)?1.4:0.95),0);if(line&&line+size+1>capacity){lines++;line=0;}if(size>capacity){lines+=Math.floor(size/capacity);line=size%capacity;}else line+=size+(line?1:0);}lines++;}
   const targets=Array.from(rows).filter(r=>Number(r.getAttribute('r'))>=start&&Number(r.getAttribute('r'))<=end&&r.getAttribute('hidden')!=='1'),height=targets.reduce((n,r)=>n+(Number(r.getAttribute('ht'))||15),0),needed=lines*(kind==='signature'?17:16)+6;if(needed>height&&targets.length){const add=(needed-height)/targets.length;targets.forEach(r=>{r.setAttribute('ht',Math.ceil((Number(r.getAttribute('ht'))||15)+add));r.setAttribute('customHeight','1');});}
  };
  const put=(ref,value)=>{const c=cell(ref);fit(ref,value);c.textContent='';if(typeof value==='number'){c.setAttribute('t','n');const v=doc.createElementNS(ns,'v');v.textContent=String(value);c.append(v);return;}c.setAttribute('t','inlineStr');const is=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value??'');is.append(t);c.append(is);};
  Array.from(doc.getElementsByTagName('c')).forEach(c=>{const ref=c.getAttribute('r'),r=Number(ref.match(/\d+/)[0]);if(r>=8&&r<=50||ref==='K56'||ref==='K64')put(ref,'');});
  put('A2','OFFICE OF THE '+office.toUpperCase()+' '+(d.profile.school||''));
  const merges=doc.getElementsByTagName('mergeCells')[0];Array.from(merges.children).filter(x=>/^A5:/.test(x.getAttribute('ref')||'')).forEach(x=>x.remove());
  for(const ref of ['A5:F5','I5:N5']){const merge=doc.createElementNS(ns,'mergeCell');merge.setAttribute('ref',ref);merges.append(merge);}merges.setAttribute('count',merges.children.length);
  const monthParts=String(m).split('-'),monthLabel=['January','February','March','April','May','June','July','August','September','October','November','December'][Number(monthParts[1])-1]||monthParts[1];
  const today=new Date().toLocaleDateString('en-GB',{timeZone:'Asia/Karachi'});
  put('A5','Report Month: '+monthLabel+' '+monthParts[0]);put('I5','Reporting Date: '+today);
  for(const [ref,horizontal] of [['A5','left'],['I5','right']]){const c=cell(ref),base=Number(c.getAttribute('s')),xf=(baseXfs[base]||extraXfs[base-baseXfs.length]).replace(/horizontal="[^"]*"/,'horizontal="'+horizontal+'"');c.setAttribute('s',baseXfs.length+extraXfs.length);extraXfs.push(xf);}

  put('B8',(d.profile.school||'')+'\nSEMIS CODE: '+semis);
  for(const [start,end] of slots){
   if(taskIndex>=tasks.length)break;const task=tasks[taskIndex],visible=[];for(let r=start;r<=end;r++)if(r!==28)visible.push(r);
   put('A'+start,task.index+1);put('C'+start,task.teacher.name);put('D'+start,task.teacher.pid);put('E'+start,task.teacher.designation);
   let used=0;while(used<visible.length&&offset<task.items.length){const a=task.items[offset++],r=visible[used++],total=Number(a.total)||0,previous=Number(a.previous)||0,current=Number(a.current)||0;
    const values={F:(a.name||'')+' — Class '+roman(a.grade),G:total,H:previous,I:current,J:Math.max(0,total-previous-current),K:a.notebooks===''?'':String(a.notebooks??'')+'%',L:a.cleanliness,M:a.feedback,N:a.suggestions};
    Object.entries(values).forEach(([col,value])=>put(col+r,value));
   }
   if(offset>=task.items.length){taskIndex++;offset=0;}
  }
  put('K56',(d.profile.hm||'')+'\n'+office.toUpperCase()+(d.profile.bps?' BS-'+d.profile.bps:'')+'\n'+(d.profile.school||''));
  Array.from(doc.getElementsByTagName('c')).filter(c=>c.getAttribute('t')==='s').forEach(c=>{const v=c.getElementsByTagName('v')[0];if(v)retainedStrings.add(Number(v.textContent));});
  zip['xl/worksheets/sheet'+page+'.xml']=enc.encode(serialize(doc));
  if(page>1){
   if(zip['xl/worksheets/_rels/sheet1.xml.rels'])zip['xl/worksheets/_rels/sheet'+page+'.xml.rels']=zip['xl/worksheets/_rels/sheet1.xml.rels'];
   const id='mprSheet'+page;
   zip['xl/workbook.xml']=enc.encode(dec.decode(zip['xl/workbook.xml']).replace('</sheets>','<sheet name="Report '+page+'" sheetId="'+page+'" r:id="'+id+'"/></sheets>'));
   zip['xl/_rels/workbook.xml.rels']=enc.encode(dec.decode(zip['xl/_rels/workbook.xml.rels']).replace('</Relationships>','<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+page+'.xml"/></Relationships>'));
   zip['[Content_Types].xml']=enc.encode(dec.decode(zip['[Content_Types].xml']).replace('</Types>','<Override PartName="/xl/worksheets/sheet'+page+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
  }
 }while(taskIndex<tasks.length);
 // Keep the template's string indexes while removing its old sample records.
 const shared=parse(dec.decode(zip['xl/sharedStrings.xml']));Array.from(shared.getElementsByTagName('si')).forEach((si,i)=>{if(!retainedStrings.has(i))si.textContent='';});zip['xl/sharedStrings.xml']=enc.encode(serialize(shared));
 styleXML=styleXML.replace(xfBlock[0],xfBlock[0].replace(/count="\d+"/,'count="'+(baseXfs.length+extraXfs.length)+'"').replace('</cellXfs>',extraXfs.join('')+'</cellXfs>'));zip['xl/styles.xml']=enc.encode(styleXML);
 return fflate.zipSync(zip,{level:6});
}

window.MPRAdminBuildExcel=buildExcel;})();
