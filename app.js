(()=>{
  const STORAGE_KEY='linum_project_v3';
  const el=id=>document.getElementById(id);
  const n=v=>{const x=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(x)?x:NaN};
  const fmt=n=>Number.isFinite(n)?(Math.round(n*100)/100).toLocaleString('ru-RU'):'';
  const mFromInput=(v,units)=>units==='mm'?n(v)/1000:n(v);
  const len=(m,units)=>units==='mm'?`${Math.round(m*1000).toLocaleString('ru-RU')} мм`:`${fmt(m)} м`;
  const area=m2=>`${fmt(m2)} м²`;
  const pct=(waste,used)=>{if(!used)return '0%';return `${Math.round((waste/used)*100)}%`};
  const clone=id=>el(id).content.cloneNode(true);
  let lastCalc=null;

  function show(text,error=false){const box=el('message');box.textContent=text;box.className=`message ${error?'error':'success'}`;setTimeout(()=>{if(box.textContent===text)box.textContent=''},5000)}
  function parseRollWidths(){return el('rollWidths').value.split(',').map(n).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b)}
  function activeUnits(){return el('units').value}
  function effectiveAllowance(room,defaultM){return Number.isFinite(room.allowanceM)?room.allowanceM:defaultM}

  function addRoom(container,data={}){
    const row=clone('roomTpl').querySelector('.room');
    row.querySelector('.room-type').value=data.type||'гостиная';
    row.querySelector('.room-length').value=data.lengthInput??'';
    row.querySelector('.room-width').value=data.widthInput??'';
    row.querySelector('.room-allowance').value=Number.isFinite(data.allowanceCm)?data.allowanceCm:'';
    row.querySelector('.room-comment').value=data.comment||'';
    row.querySelector('.delete-room').onclick=()=>row.remove();
    row.querySelector('.copy-room').onclick=()=>addRoom(container,roomToForm(row));
    container.appendChild(row);
  }
  function roomToForm(row){const rawA=row.querySelector('.room-allowance').value;return {type:row.querySelector('.room-type').value,lengthInput:row.querySelector('.room-length').value,widthInput:row.querySelector('.room-width').value,allowanceCm:rawA===''?NaN:n(rawA),comment:row.querySelector('.room-comment').value.trim()}}

  function addApartment(data={}){
    const node=clone('apartmentTpl').querySelector('.apartment');
    node.querySelector('.apt-number').value=data.number||'';
    node.querySelector('.apt-name').value=data.name||'';
    node.querySelector('.apt-comment').value=data.comment||'';
    const rooms=node.querySelector('.rooms');
    (data.rooms?.length?data.rooms:[{}]).forEach(r=>addRoom(rooms,r));
    node.querySelector('.add-room').onclick=()=>addRoom(rooms);
    node.querySelector('.delete-apt').onclick=()=>node.remove();
    node.querySelector('.copy-apt').onclick=()=>addApartment(apartmentToData(node));
    el('apartments').appendChild(node);
  }
  function apartmentToData(node){return {number:node.querySelector('.apt-number').value.trim(),name:node.querySelector('.apt-name').value.trim(),comment:node.querySelector('.apt-comment').value.trim(),rooms:[...node.querySelectorAll('.room')].map(roomToForm)}}

  function getSettings(){const allowanceCm=Math.max(0,n(el('allowanceDefault').value)||0);return {projectName:el('projectName').value.trim(),material:el('material').value.trim(),units:activeUnits(),rollWidths:parseRollWidths(),allowanceDefaultM:allowanceCm/100,mode:el('mode').value,rawAllowanceDef:el('allowanceDefault').value}}
  function getApartments(settings){
    return [...el('apartments').querySelectorAll('.apartment')].map((node,i)=>{
      const raw=apartmentToData(node);const name=raw.name||raw.number||`Квартира ${i+1}`;
      const rooms=raw.rooms.map((r,j)=>({type:r.type,length:mFromInput(r.lengthInput,settings.units),width:mFromInput(r.widthInput,settings.units),allowanceM:Number.isFinite(r.allowanceCm)&&r.allowanceCm>=0?r.allowanceCm/100:NaN,comment:r.comment,index:j})).filter(r=>Number.isFinite(r.length)&&r.length>0&&Number.isFinite(r.width)&&r.width>0);
      return {...raw,name,rooms};
    }).filter(a=>a.rooms.length);
  }

  function calculateRoom(room,allowanceM,widths,mode){
    const cutL=room.length+2*allowanceM, cutW=room.width+2*allowanceM, roomArea=room.length*room.width;
    let best=null;
    widths.forEach(rw=>[[cutW,cutL],[cutL,cutW]].forEach(([across,along])=>{
      if(across<=rw){const used=rw*along,waste=used-roomArea;const candidate={rollWidth:rw,cutLength:along,usedArea:used,waste,seams:0,strips:1};
        if(!best||(mode==='waste'?candidate.waste<best.waste:candidate.waste<best.waste))best=candidate;
      }
    }));
    if(!best){const rw=widths.at(-1);if(!rw)return null;const across=Math.min(cutL,cutW),along=Math.max(cutL,cutW),strips=Math.ceil(across/rw);const used=rw*along*strips;best={rollWidth:rw,cutLength:along,usedArea:used,waste:used-roomArea,seams:Math.max(0,strips-1),strips};}
    return {...best,roomArea,cutL,cutW};
  }

  function calculate(){
    const settings=getSettings();if(!settings.rollWidths.length)return show('Укажите хотя бы одну ширину рулона.',true);
    const apartments=getApartments(settings);if(!apartments.length)return show('Добавьте помещение с корректной длиной и шириной.',true);
    const rows=[],summary=new Map(),pieces=[];
    apartments.forEach((apt,aptIndex)=>{
      const markings=[];apt.rooms.forEach((room,roomIndex)=>{
        const allowanceM=effectiveAllowance(room,settings.allowanceDefaultM);const calc=calculateRoom(room,allowanceM,settings.rollWidths,settings.mode);if(!calc)return;
        const marking=`${apt.number||apt.name}-${String(roomIndex+1).padStart(2,'0')}`;markings.push(marking);
        const r={marking,apartment:apt.name,type:room.type,lengthM:room.length,widthM:room.width,allowanceM,comment:room.comment||apt.comment,aptIndex,...calc};rows.push(r);
        const s=summary.get(calc.rollWidth)||{rollWidth:calc.rollWidth,lengthM:0,area:0,apartments:new Set(),markings:[]};s.lengthM+=calc.cutLength*calc.strips;s.area+=calc.usedArea;s.apartments.add(apt.name);s.markings.push(marking);summary.set(calc.rollWidth,s);
      });
      if(markings.length)pieces.push({apartment:apt.name,count:markings.length,range:markings.length===1?markings[0]:`${markings[0]} — ${markings.at(-1)}`});
    });
    lastCalc={settings,rows,summary,pieces};render(lastCalc);save();show('Расчёт выполнен.');
  }

  function render(data){
    const body=el('results');body.innerHTML='';
    data.rows.forEach(r=>{
      const tr=document.createElement('tr');if(r.aptIndex%2===1)tr.style.backgroundColor='#edf0f1';
      tr.innerHTML=`<td>${r.marking}</td><td>${r.apartment}</td><td>${r.type}</td><td>${len(r.lengthM,data.settings.units)} × ${len(r.widthM,data.settings.units)}</td><td>${fmt(r.allowanceM*100)} см</td><td>${len(r.cutL,data.settings.units)} × ${len(r.cutW,data.settings.units)}</td><td>${len(r.rollWidth,data.settings.units)}</td><td>${len(r.cutLength,data.settings.units)}</td><td>${area(r.usedArea)}</td><td>${area(r.waste)}</td><td>${pct(r.waste,r.usedArea)}</td><td>${r.seams}</td><td>${r.comment||''}</td>`;
      body.appendChild(tr);
    });
    const p=el('apartmentPieces');p.innerHTML='';data.pieces.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${x.apartment}</td><td>${x.count}</td><td>${x.range}</td>`;p.appendChild(tr)});
    const s=el('summary');s.innerHTML='';[...data.summary.values()].sort((a,b)=>a.rollWidth-b.rollWidth).forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${len(x.rollWidth,data.settings.units)}</td><td>${len(x.lengthM,data.settings.units)}</td><td>${area(x.area)}</td><td>${[...x.apartments].join(', ')}</td><td>${x.markings.join(', ')}</td>`;s.appendChild(tr)});
  }

  function save(){const project={settings:{projectName:el('projectName').value,material:el('material').value,units:el('units').value,rollWidths:el('rollWidths').value,allowanceDefault:el('allowanceDefault').value,mode:el('mode').value},apartments:[...el('apartments').querySelectorAll('.apartment')].map(apartmentToData)};localStorage.setItem(STORAGE_KEY,JSON.stringify(project))}
  function load(){try{const project=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!project)return addApartment();Object.entries(project.settings||{}).forEach(([k,v])=>{if(el(k))el(k).value=v});(project.apartments||[]).forEach(addApartment);if(!el('apartments').children.length)addApartment()}catch{addApartment()}}
  function clearSettings(){el('projectName').value='';el('material').value='Линолеум';el('units').value='mm';el('rollWidths').value='1.5, 2, 2.5, 3, 3.5';el('allowanceDefault').value='5';el('mode').value='seams';save();show('Параметры сброшены.')}
  function clearAll(){if(!confirm('Очистить параметры, квартиры и результаты?'))return;localStorage.removeItem(STORAGE_KEY);el('apartments').innerHTML='';el('results').innerHTML='';el('apartmentPieces').innerHTML='';el('summary').innerHTML='';lastCalc=null;clearSettings();addApartment();show('Все данные очищены.')}

  async function downloadXlsx(){
    if(!lastCalc)return show('Сначала выполните расчёт.',true);if(typeof ExcelJS==='undefined')return show('Не удалось загрузить модуль Excel.',true);
    const {settings,rows,summary,pieces}=lastCalc,units=settings.units,toDisplay=m=>units==='mm'?Math.round(m*1000):Math.round(m*100)/100,lenFmt=units==='mm'?'#,##0 "мм"':'0.00 "м"',areaFmt='0.00 "м²"',pctFmt='0%';
    const wb=new ExcelJS.Workbook();wb.creator='Линум';
    const header=row=>{row.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF5B686D'}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true}})};
    const widths=(ws,count)=>{for(let i=1;i<=count;i++){let max=10;ws.getColumn(i).eachCell({includeEmpty:false},c=>{const val=c.numFmt===pctFmt?`${Math.round(c.value*100)}%`:String(c.value??'');max=Math.max(max,val.length)});ws.getColumn(i).width=Math.min(max+2,45)}};
    
    // Лист 1: Результаты
    const ws=wb.addWorksheet('Результаты',{views:[{state:'frozen',ySplit:1}]});
    ws.addRow(['Маркировка','Квартира','Помещение','Длина','Ширина','Запас','С запасом','Ширина рулона','Метраж','Площадь','Остаток','%','Стыков','Комментарий']);
    header(ws.getRow(1));let totalLen=0,totalArea=0,totalWaste=0;
    rows.forEach(r=>{
      const pctVal = r.usedArea > 0 ? (r.waste / r.usedArea) : 0;
      const row=ws.addRow([r.marking,r.apartment,r.type,toDisplay(r.lengthM),toDisplay(r.widthM),r.allowanceM*100,`${len(r.cutL,units)} × ${len(r.cutW,units)}`,toDisplay(r.rollWidth),toDisplay(r.cutLength),r.usedArea,r.waste,pctVal,r.seams,r.comment]);
      [4,5,8,9].forEach(i=>row.getCell(i).numFmt=lenFmt);row.getCell(6).numFmt='0.0 "см"';[10,11].forEach(i=>row.getCell(i).numFmt=areaFmt);
      row.getCell(12).numFmt=pctFmt; row.getCell(14).alignment={wrapText:true};
      if(r.aptIndex%2===1)row.eachCell({includeEmpty:true},c=>{if(!c.fill)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDF0F1'}}});
      totalLen+=toDisplay(r.cutLength*r.strips);totalArea+=r.usedArea;totalWaste+=r.waste;
    });
    const dataEnd=ws.rowCount;if(dataEnd>1){
      const tr=ws.addRow(['','','','','','','','ИТОГО:',totalLen,totalArea,totalWaste,'','','']);
      tr.eachCell(c=>{c.font={bold:true};c.border={top:{style:'double'}}});
      tr.getCell(9).numFmt=lenFmt;tr.getCell(10).numFmt=areaFmt;tr.getCell(11).numFmt=areaFmt;
      ws.addConditionalFormatting({ref:`K2:K${dataEnd}`,rules:[{type:'colorScale',cfvo:[{type:'min'},{type:'percentile',val:50},{type:'max'}],color:[{argb:'FF63BE7B'},{argb:'FFFFEB84'},{argb:'FFF8696B'}]}]});
      ws.addConditionalFormatting({ref:`L2:L${dataEnd}`,rules:[{type:'colorScale',cfvo:[{type:'min'},{type:'percentile',val:50},{type:'max'}],color:[{argb:'FF63BE7B'},{argb:'FFFFEB84'},{argb:'FFF8696B'}]}]});
    }
    widths(ws,14);ws.getColumn(14).width=40;

    // Лист 2: Куски по квартирам
    const wp=wb.addWorksheet('Куски по квартирам',{views:[{state:'frozen',ySplit:1}]});
    wp.addRow(['Квартира','Кол-во кусков','Диапазон маркировки']);header(wp.getRow(1));let totalPieces=0;
    pieces.forEach(x=>{wp.addRow([x.apartment,x.count,x.range]);totalPieces+=x.count});
    wp.addRow(['ИТОГО:',totalPieces,'']);widths(wp,3);

    // Лист 3: Сводка для заказа
    const wsum=wb.addWorksheet('Сводка для заказа',{views:[{state:'frozen',ySplit:1}]});
    wsum.addRow(['Ширина рулона','Погонный метраж','Площадь','Квартиры','Маркировки для отрезки']);header(wsum.getRow(1));let sl=0,sa=0;
    [...summary.values()].sort((a,b)=>a.rollWidth-b.rollWidth).forEach(x=>{
      const row=wsum.addRow([toDisplay(x.rollWidth),toDisplay(x.lengthM),x.area,[...x.apartments].join(', '),x.markings.join(', ')]);
      row.getCell(1).numFmt=lenFmt;row.getCell(2).numFmt=lenFmt;row.getCell(3).numFmt=areaFmt;sl+=toDisplay(x.lengthM);sa+=x.area;
    });
    const sr=wsum.addRow(['ИТОГО:',sl,sa,'','']);sr.eachCell(c=>{c.font={bold:true};c.border={top:{style:'double'}}});
    sr.getCell(2).numFmt=lenFmt;sr.getCell(3).numFmt=areaFmt;widths(wsum,5);wsum.getColumn(4).width=30;wsum.getColumn(5).width=42;

    // Лист 4: Схема раскроя
    const wsScheme = wb.addWorksheet('Схема раскроя', { views: [{ showGridLines: false }] });
    const SC_W=2.2, SC_H=12, SC_MM=150, MAX_C=22; let rCur=1;
    if(rows.length>80){wsScheme.getRow(rCur).getCell(1).value='Показаны первые 80 кусков.';wsScheme.getRow(rCur).getCell(1).font={italic:true,color:{argb:'FF9AA5B1'}};rCur+=2;}
    rows.slice(0,80).forEach(r=>{
      const rwMm=units==='mm'?r.rollWidth*1000:r.rollWidth*1000, cMm=r.cutLength*1000, str=r.strips||1;
      const cR=Math.max(2,Math.min(MAX_C,Math.round(rwMm/SC_MM))), cC=Math.max(2,Math.round(cMm/SC_MM));
      const tr=wsScheme.getRow(rCur);tr.getCell(1).value=`${r.marking} — ${r.apartment}, ${r.type} (рулон ${rwMm} мм, отрез ${cMm} мм${str>1?', '+str+' полотна':''})`;tr.getCell(1).font={bold:true,size:11};rCur++;
      const bSt=rCur;
      for(let i=0;i<str;i++){
        const off=i*(cR+1);
        for(let rr=0;rr<cC;rr++){
          const er=wsScheme.getRow(bSt+rr);er.height=SC_H;
          for(let cc=0;cc<cR;cc++){
            const c=er.getCell(off+cc+1);c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFBFD4D8'}};
            c.border={top:{style:'thin',color:{argb:'FF5B686D'}},left:{style:'thin',color:{argb:'FF5B686D'}},right:{style:'thin',color:{argb:'FF5B686D'}},bottom:{style:'thin',color:{argb:'FF5B686D'}}};
          }
        }
        const lc=wsScheme.getRow(bSt).getCell(off+1);lc.value=str>1?`Полотно ${i+1}`:r.marking;lc.font={bold:true,size:9,color:{argb:'FF1F2933'}};lc.alignment={wrapText:true,vertical:'top'};
      }
      rCur=bSt+cC+2;
    });
    for(let c=1;c<=MAX_C*2+2;c++)wsScheme.getColumn(c).width=SC_W;

    const buffer=await wb.xlsx.writeBuffer(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=`${settings.projectName||'linum'}_zakaz.xlsx`;a.click();URL.revokeObjectURL(a.href);
  }

  el('addApartment').onclick=()=>addApartment();el('calculate').onclick=calculate;el('saveProject').onclick=()=>{save();show('Данные сохранены в браузере.')};el('clearSettings').onclick=clearSettings;el('clearAll').onclick=clearAll;el('downloadXlsx').onclick=downloadXlsx;el('printBtn').onclick=()=>window.print();load();
})();