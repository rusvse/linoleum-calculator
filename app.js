const GOOGLE_APPS_SCRIPT_URL='https://script.google.com/macros/s/AKfycbyBYSVpeYNMW9bM_76ZR36gUG2YdZoCJRwwCbb5GHf-KePxCbOMNR-SNSXfJ_LhK9-NJw/exec';
const TYPES={"Спальня":"СП","Кухня":"КУ","Гостиная":"ГС","Коридор":"КР","Прихожая":"ПР","Гардеробная":"ГД","Детская":"ДТ","Кабинет":"КБ","Другое":""};
let state=JSON.parse(localStorage.getItem('linum-v1')||'null')||{projectName:'',material:'',rollWidths:'2, 2.5, 3, 3.5, 4, 5',allowance:10,mode:'seams',apartments:[]};
let lastSummaryRaw=[];
const $=s=>document.querySelector(s),num=v=>Number(String(v||'').replace(',','.'))||0,rnd=v=>Math.round(v*100)/100;
function esc(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML}
function message(t,e=false){const x=$('#message');x.textContent=t;x.style.color=e?'#b13e3e':'#087d8c'}
function save(s=true){['projectName','material','rollWidths','allowance','mode'].forEach(k=>state[k]=$('#'+k).value);state.allowance=num(state.allowance);localStorage.setItem('linum-v1',JSON.stringify(state));if(s)message('Данные сохранены на этом устройстве.')}
function options(v){return Object.keys(TYPES).map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('')}
function render(){
  const box=$('#apartments');box.innerHTML='';
  state.apartments.forEach((a,ai)=>{
    const el=$('#apartmentTpl').content.firstElementChild.cloneNode(true);
    [['apt-number','number'],['apt-name','name'],['apt-comment','comment']].forEach(([c,k])=>{
      el.querySelector('.'+c).value=a[k]||'';
      el.querySelector('.'+c).oninput=e=>{a[k]=e.target.value;save(false);calculate()}
    });
    a.rooms.forEach((r,ri)=>{
      const re=$('#roomTpl').content.firstElementChild.cloneNode(true);
      re.querySelector('.room-type').innerHTML=options(r.type);
      ['custom','code','length','width','comment'].forEach(k=>{
        const q=re.querySelector('.room-'+k);
        q.value=r[k]||'';
        q.oninput=e=>{r[k]=e.target.value;save(false);calculate()}
      });
      re.querySelector('.room-type').onchange=e=>{r.type=e.target.value;render();save(false);calculate()};
      re.querySelector('.room-custom').hidden=r.type!=='Другое';
      re.querySelector('.room-code').hidden=r.type!=='Другое';
      re.querySelector('.copy-room').onclick=()=>{a.rooms.splice(ri+1,0,structuredClone(r));render();calculate()};
      re.querySelector('.delete-room').onclick=()=>{a.rooms.splice(ri,1);render();calculate()};
      el.querySelector('.rooms').append(re)
    });
    el.querySelector('.add-room').onclick=()=>{a.rooms.push({type:'Спальня',custom:'',code:'',length:'',width:'',comment:''});render()};
    el.querySelector('.copy-apt').onclick=()=>{const c=structuredClone(a);c.number=(a.number||'')+' копия';c.name=(a.name||'')+' копия';state.apartments.splice(ai+1,0,c);render();calculate()};
    el.querySelector('.delete-apt').onclick=()=>{if(confirm('Удалить квартиру и все помещения?')){state.apartments.splice(ai,1);render();calculate()}};
    box.append(el)
  })
}
function rooms(){
  const out=[];
  state.apartments.forEach((a,ai)=>{
    const n={};
    const aptLabel=a.name||('КВ'+(a.number||String(ai+1).padStart(2,'0')));
    a.rooms.forEach(r=>{
      const c=r.type==='Другое'?(r.code||'ДР'):TYPES[r.type];
      n[c]=(n[c]||0)+1;
      out.push({r,a,ai,aptLabel,mark:`${aptLabel} ${c} ${String(n[c]).padStart(2,'0')}`})
    })
  });
  return out
}
function calc(r){
  const l=num(r.length),w=num(r.width),z=num(state.allowance)/100,A=l+2*z,B=w+2*z,
  widths=state.rollWidths.split(',').map(num).filter(Boolean);
  if(!l||!w||!widths.length)return null;
  const all=[];
  widths.forEach(roll=>[[A,B],[B,A]].forEach(([across,cut])=>{
    const strips=Math.ceil(across/roll),meters=strips*cut,area=meters*roll;
    all.push({roll,strips,meters,area,waste:Math.max(0,area-A*B),seams:strips-1,A,B})
  }));
  all.sort((x,y)=>state.mode==='waste'?(x.waste-y.waste||x.seams-y.seams):(x.seams-y.seams||x.waste-y.waste));
  return all[0]
}
function calculate(){
  save(false);
  const rows=rooms().map(x=>({...x,c:calc(x.r)})).filter(x=>x.c);
  const fa=$('#filterApartment').value,fr=$('#filterRoom').value,fw=$('#filterWidth').value;
  const body=$('#results');
  body.innerHTML=rows.filter(x=>(!fa||String(x.ai)===fa)&&(!fr||x.r.type===fr)&&(!fw||String(x.c.roll)===fw)).map(x=>`<tr><td>${esc(x.mark)}</td><td>${esc(x.aptLabel)}</td><td>${esc(x.r.type==='Другое'?(x.r.custom||'Другое'):x.r.type)}</td><td>${num(x.r.length)} × ${num(x.r.width)} м</td><td>${rnd(x.c.A)} × ${rnd(x.c.B)} м</td><td>${x.c.roll} м</td><td>${x.c.strips}</td><td>${rnd(x.c.meters)} п.м.</td><td>${rnd(x.c.area)} м²</td><td>${rnd(x.c.waste)} м²</td><td>${x.c.seams}</td><td>${esc(x.r.comment||'')}</td></tr>`).join('')||'<tr><td colspan="12" class="muted">Добавьте помещения с размерами, чтобы получить расчёт.</td></tr>';
  const map={};
  rows.forEach(x=>{const k=x.c.roll;(map[k]??={m:0,a:0,marks:[]}).m+=x.c.meters;map[k].a+=x.c.area;map[k].marks.push(x.mark)});
  const summaryEntries=Object.entries(map).sort((a,b)=>num(a[0])-num(b[0]));
  $('#summary').innerHTML=summaryEntries.map(([k,v])=>`<tr><td>${k} м</td><td>${rnd(v.m)} п.м.</td><td>${rnd(v.a)} м²</td><td>${v.marks.length}</td><td>${esc(v.marks.join(', '))}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Нет данных для заказа.</td></tr>';
  lastSummaryRaw=summaryEntries.map(([k,v])=>[Number(k),rnd(v.m),rnd(v.a),v.marks.length,v.marks.join(', ')]);
  const aptMap={};
  rows.forEach(x=>{aptMap[x.ai]=x.aptLabel});
  const selApt=$('#filterApartment'),curApt=selApt.value,aptTitle=selApt.options[0]?selApt.options[0].text:'Все квартиры';
  selApt.innerHTML=`<option value="">${aptTitle}</option>`+Object.entries(aptMap).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
  selApt.value=curApt;selApt.onchange=calculate;
  [['filterRoom',rows.map(x=>x.r.type)],['filterWidth',rows.map(x=>String(x.c.roll))]].forEach(([id,arr])=>{
    const e=$('#'+id),v=e.value,t=e.options[0].text;
    e.innerHTML=`<option value="">${t}</option>`+[...new Set(arr)].map(x=>`<option>${esc(x)}</option>`).join('');
    e.value=v;e.onchange=calculate
  });
  return rows
}
function csv(rows){
  const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  return '\ufeff'+[['Маркировка','Квартира','Помещение','Размер','С запасом','Рулон','Полос','Метраж','Площадь','Остаток','Стыков','Комментарий'],...rows.map(x=>[x.mark,x.aptLabel,x.r.type,`${x.r.length} x ${x.r.width}`,`${rnd(x.c.A)} x ${rnd(x.c.B)}`,x.c.roll,x.c.strips,rnd(x.c.meters),rnd(x.c.area),rnd(x.c.waste),x.c.seams,x.r.comment])].map(r=>r.map(q).join(';')).join('\n')
}
function download(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv(calculate())],{type:'text/csv;charset=utf-8'}));a.download='raschet-linoleuma.csv';a.click()}
async function exportSheets(){
  const rows=calculate(),
  rs=rooms().map(x=>[x.a.number,x.a.name,x.r.type,x.r.custom||'',x.mark,x.r.length,x.r.width,x.r.comment||'']),
  cal=rows.map(x=>[x.mark,x.a.number,x.a.name,x.r.type,x.r.length,x.r.width,rnd(x.c.A),rnd(x.c.B),x.c.roll,x.c.strips,rnd(x.c.meters),rnd(x.c.area),rnd(x.c.waste),x.c.seams,x.r.comment||'']),
  sum=lastSummaryRaw;
  message('Выгрузка выполняется…');
  try{
    const r=await fetch(GOOGLE_APPS_SCRIPT_URL,{method:'POST',body:JSON.stringify({project:state.projectName,material:state.material,rooms:rs,calculation:cal,summary:sum})}),
    d=await r.json();
    if(d.spreadsheetUrl||d.url){message('Готово. Расчёт добавлен в Google Таблицу.');window.open(d.spreadsheetUrl||d.url,'_blank')}
    else message('Ошибка выгрузки: '+JSON.stringify(d),true)
  }catch(e){message('Не удалось выгрузить расчёт. Проверьте доступ Apps Script.',true)}
}
function init(){
  ['projectName','material','rollWidths','allowance','mode'].forEach(k=>$('#'+k).value=state[k]??'');
  render();calculate();
  $('#saveProject').onclick=save;
  $('#calculate').onclick=calculate;
  $('#addApartment').onclick=()=>{state.apartments.push({number:'',name:'',comment:'',rooms:[]});render()};
  $('#downloadCsv').onclick=download;
  $('#exportSheets').onclick=exportSheets;
  $('#printBtn').onclick=()=>print()
}
init();
