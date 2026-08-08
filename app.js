(function(){
  const ROOM_TYPES = [
    {code:'living', name:'гостиная'},
    {code:'bedroom', name:'спальня'},
    {code:'kitchen', name:'кухня'},
    {code:'hall', name:'коридор'},
    {code:'bath', name:'ванная'},
    {code:'balcony', name:'балкон/лоджия'},
    {code:'custom', name:'Своё...'}
  ];

  const STORAGE_KEY = 'linum_project_v1';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDgb9kcSqO75OzhMGxktfUQroonmLS8NIDCfTphROe0W02Aln3MBzTTV6iQZWRx5Np/exec';

  const el = id => document.getElementById(id);
  const parseNum = v => {
    if (v === undefined || v === null) return NaN;
    const s = String(v).trim().replace(',', '.');
    return s === '' ? NaN : parseFloat(s);
  };
  const fmt = n => Number.isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString('ru-RU') : '—';
  const pct = (waste, used) => { if (!used) return '0%'; return `${Math.round((waste / used) * 100)}%`; };

  function toMeters(value, units) {
    return units === 'mm' ? value / 1000 : value;
  }
  function fmtLen(valueMeters, units) {
    if (!Number.isFinite(valueMeters)) return '—';
    if (units === 'mm') {
      return Math.round(valueMeters * 1000).toLocaleString('ru-RU') + ' мм';
    }
    return fmt(valueMeters) + ' м';
  }

  function parseRollWidths(str) {
    return str.split(',').map(s => parseNum(s)).filter(n => Number.isFinite(n) && n > 0).sort((a,b)=>a-b);
  }

  function populateRoomTypeSelect(select) {
    select.innerHTML = '';
    ROOM_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.code;
      opt.textContent = t.name;
      select.appendChild(opt);
    });
  }

  function createRoom(container) {
    const tpl = el('roomTpl').content.cloneNode(true);
    const room = tpl.querySelector('.room');
    
    const typeSelect = room.querySelector('.room-type');
    populateRoomTypeSelect(typeSelect);
    
    let customInput = null;
    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'custom') {
        if (!customInput) {
          customInput = document.createElement('input');
          customInput.className = 'room-type-custom';
          customInput.placeholder = 'Название...';
          customInput.style.cssText = 'padding:6px; border:1px solid #d3dae0; border-radius:4px; width:100%; margin-top:4px;';
          typeSelect.parentNode.insertBefore(customInput, typeSelect.nextSibling);
        }
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        if (customInput) customInput.style.display = 'none';
      }
      autosaveDebounced();
    });

    room.querySelector('.delete-room').addEventListener('click', () => {
      room.remove();
      autosaveDebounced();
    });

    room.querySelector('.copy-room').addEventListener('click', () => {
      const clone = room.cloneNode(true);
      clone.querySelector('.room-type').value = typeSelect.value;
      if (customInput) {
        let ci = clone.querySelector('.room-type-custom');
        if (!ci) {
          ci = document.createElement('input');
          ci.className = 'room-type-custom';
          ci.style.cssText = 'padding:6px; border:1px solid #d3dae0; border-radius:4px; width:100%; margin-top:4px;';
          clone.querySelector('.room-type').parentNode.insertBefore(ci, clone.querySelector('.room-type').nextSibling);
        }
        ci.value = customInput.value;
        ci.style.display = customInput.style.display;
      }
      
      clone.querySelector('.delete-room').addEventListener('click', () => { clone.remove(); autosaveDebounced(); });
      clone.querySelector('.copy-room').addEventListener('click', () => { container.appendChild(clone.cloneNode(true)); autosaveDebounced(); });
      
      clone.querySelectorAll('input, select').forEach(i => i.addEventListener('input', autosaveDebounced));
      container.appendChild(clone);
      autosaveDebounced();
    });

    room.querySelectorAll('input, select').forEach(i => i.addEventListener('input', autosaveDebounced));
    container.appendChild(room);
    return room;
  }

  function createApartment() {
    const tpl = el('apartmentTpl').content.cloneNode(true);
    const apt = tpl.querySelector('.apartment');
    const roomsContainer = apt.querySelector('.rooms');
    
    createRoom(roomsContainer);

    apt.querySelector('.add-room').addEventListener('click', () => {
      createRoom(roomsContainer);
      autosaveDebounced();
    });

    apt.querySelector('.delete-apt').addEventListener('click', () => {
      apt.remove();
      autosaveDebounced();
    });

    apt.querySelector('.copy-apt').addEventListener('click', () => {
      const cloneApt = apt.cloneNode(true);
      cloneApt.querySelector('.delete-apt').addEventListener('click', () => { cloneApt.remove(); autosaveDebounced(); });
      cloneApt.querySelector('.copy-apt').addEventListener('click', () => { el('apartments').appendChild(cloneApt.cloneNode(true)); autosaveDebounced(); });
      cloneApt.querySelector('.add-room').addEventListener('click', () => { createRoom(cloneApt.querySelector('.rooms')); autosaveDebounced(); });
      
      const newRoomsContainer = cloneApt.querySelector('.rooms');
      newRoomsContainer.innerHTML = '';
      apt.querySelectorAll('.room').forEach(oldRoom => {
        const nr = createRoom(newRoomsContainer);
        nr.querySelector('.room-type').value = oldRoom.querySelector('.room-type').value;
        nr.querySelector('.room-length').value = oldRoom.querySelector('.room-length').value;
        nr.querySelector('.room-width').value = oldRoom.querySelector('.room-width').value;
        nr.querySelector('.room-allowance').value = oldRoom.querySelector('.room-allowance').value;
        nr.querySelector('.room-comment').value = oldRoom.querySelector('.room-comment').value;
      });
      
      cloneApt.querySelectorAll('input, select').forEach(i => i.addEventListener('input', autosaveDebounced));
      el('apartments').appendChild(cloneApt);
      autosaveDebounced();
    });

    apt.querySelectorAll('input, select').forEach(i => i.addEventListener('input', autosaveDebounced));
    el('apartments').appendChild(apt);
    return apt;
  }

  function roomTypeName(select, customInput) {
    if (select.value === 'custom' && customInput && customInput.value.trim()) {
      return customInput.value.trim();
    }
    const opt = select.options[select.selectedIndex];
    return opt ? opt.text : '';
  }

  function collectData(units) {
    const apartments = [];
    document.querySelectorAll('.apartment').forEach((aptNode, i) => {
      const number = aptNode.querySelector('.apt-number').value.trim();
      const name = aptNode.querySelector('.apt-name').value.trim() || `Квартира ${i + 1}`;
      const comment = aptNode.querySelector('.apt-comment').value.trim();
      const rooms = [];

      aptNode.querySelectorAll('.room').forEach((roomNode, j) => {
        const typeSelect = roomNode.querySelector('.room-type');
        const customInput = roomNode.querySelector('.room-type-custom');
        const lengthInput = parseNum(roomNode.querySelector('.room-length').value);
        const widthInput = parseNum(roomNode.querySelector('.room-width').value);
        const rawAllowance = roomNode.querySelector('.room-allowance').value;
        const allowanceCm = rawAllowance === '' ? NaN : parseNum(rawAllowance);
        const roomComment = roomNode.querySelector('.room-comment').value.trim();

        if (Number.isNaN(lengthInput) || Number.isNaN(widthInput) || lengthInput <= 0 || widthInput <= 0) return;

        rooms.push({
          index: j,
          code: typeSelect.value,
          typeName: roomTypeName(typeSelect, customInput),
          length: toMeters(lengthInput, units),
          width: toMeters(widthInput, units),
          allowanceCm: allowanceCm,
          comment: roomComment
        });
      });
      if (rooms.length) apartments.push({ number, name, comment, rooms });
    });
    return apartments;
  }

  function calculateRoom(room, defaultAllowanceM, rollWidths, mode) {
    const effAllowanceM = Number.isFinite(room.allowanceCm) && room.allowanceCm >= 0 ? room.allowanceCm / 100 : defaultAllowanceM;
    const roomLenWithAllowance = room.length + effAllowanceM * 2;
    const roomWidthWithAllowance = room.width + effAllowanceM * 2;
    const area = room.length * room.width;

    let best = null;
    rollWidths.forEach(rw => {
      [ [roomWidthWithAllowance, roomLenWithAllowance], [roomLenWithAllowance, roomWidthWithAllowance] ]
        .forEach(([acrossRoll, alongRoll]) => {
          if (acrossRoll <= rw) {
            const cutLength = alongRoll;
            const usedArea = rw * cutLength;
            const waste = usedArea - area;
            const seams = 0;
            const candidate = { rollWidth: rw, cutLength, usedArea, waste, seams, withAllowance: true, appliedAllowanceM: effAllowanceM };
            if (!best) { best = candidate; return; }
            if (mode === 'waste') {
              if (candidate.waste < best.waste) best = candidate;
            } else {
              if (candidate.seams < best.seams || (candidate.seams === best.seams && candidate.waste < best.waste)) best = candidate;
            }
          }
        });
    });

    if (!best) {
      const maxRw = rollWidths[rollWidths.length - 1] || 0;
      const acrossRoll = Math.min(roomWidthWithAllowance, roomLenWithAllowance);
      const alongRoll = Math.max(roomWidthWithAllowance, roomLenWithAllowance);
      const stripWidth = maxRw > 0 ? maxRw : acrossRoll;
      const stripsAcross = Math.ceil(acrossRoll / stripWidth);
      const cutLength = alongRoll;
      const usedArea = stripWidth * cutLength * stripsAcross;
      const waste = usedArea - area;
      best = { rollWidth: stripWidth, cutLength, usedArea, waste, seams: Math.max(0, stripsAcross - 1), withAllowance: true, multiStrip: stripsAcross, appliedAllowanceM: effAllowanceM };
    }
    return { area, ...best };
  }

  function renderResults(apartments, settings) {
    const resultsBody = el('results');
    const summaryBody = el('summary');
    const apartmentPiecesBody = el('apartmentPieces');
    resultsBody.innerHTML = '';
    summaryBody.innerHTML = '';
    if (apartmentPiecesBody) apartmentPiecesBody.innerHTML = '';

    const units = settings.units;
    const filterApt = el('filterApartment');
    const filterRoom = el('filterRoom');
    const filterWidth = el('filterWidth');
    const aptSet = new Set(), roomSet = new Set(), widthSet = new Set();

    const summaryMap = new Map();
    const flatRows = [];
    const apartmentPieces = [];
    const resultsSheetRowsRaw = [];
    const cuttingRows = [];

    apartments.forEach((apt, aptIndex) => {
      const aptLabel = apt.number || apt.name;
      let markingCounter = 1;
      const markingsForApt = [];

      apt.rooms.forEach(room => {
        const calc = calculateRoom(room, settings.allowanceM, settings.rollWidths, settings.mode);
        const marking = `${aptLabel}-${String(markingCounter++).padStart(2, '0')}`;
        markingsForApt.push(marking);
        
        const roomSizeText = `${fmtLen(room.length, units)}×${fmtLen(room.width, units)}`;
        const withAllowanceText = calc.multiStrip
          ? `${fmtLen(room.length + calc.appliedAllowanceM*2, units)}×${fmtLen(room.width + calc.appliedAllowanceM*2, units)} (${calc.multiStrip} полотна)`
          : `${fmtLen(calc.cutLength, units)} по рулону`;
        
        const roomLabel = room.typeName + (room.code && room.code !== 'custom' && room.typeName !== ROOM_TYPES.find(t=>t.code===room.code)?.name ? ' ('+room.code+')' : '');
        const rollWidthText = fmtLen(calc.rollWidth, units);
        const cutLengthText = fmtLen(calc.cutLength, units);
        const areaText = fmt(calc.usedArea) + ' м²';
        const wasteText = fmt(calc.waste) + ' м²';
        const pctText = pct(calc.waste, calc.usedArea);
        const commentText = room.comment || apt.comment || '';

        const tr = document.createElement('tr');
        if (aptIndex % 2 === 1) tr.style.backgroundColor = '#edf0f1';
        
        tr.innerHTML = `
          <td style="padding:8px; border:1px solid #e4e7eb;">${marking}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${apt.name}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${roomLabel}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${roomSizeText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${fmt(calc.appliedAllowanceM*100)} см</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${withAllowanceText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${rollWidthText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${calc.multiStrip || 1}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${cutLengthText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${areaText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${wasteText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${pctText}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${calc.seams || 0}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${commentText}</td>
        `;
        resultsBody.appendChild(tr);

        aptSet.add(apt.name);
        roomSet.add(room.typeName);
        widthSet.add(rollWidthText);

        const key = calc.rollWidth;
        if (!summaryMap.has(key)) summaryMap.set(key, { totalLength: 0, totalArea: 0, apartments: new Set(), markings: [] });
        const s = summaryMap.get(key);
        s.totalLength += calc.cutLength * (calc.multiStrip || 1);
        s.totalArea += calc.usedArea;
        s.apartments.add(apt.name);
        s.markings.push(marking);

        flatRows.push({
          marking, apartment: apt.name, room: roomLabel,
          size: roomSizeText, rollWidth: calc.rollWidth, length: calc.cutLength,
          area: calc.usedArea, waste: calc.waste, seams: calc.seams || 0,
          comment: commentText
        });

        resultsSheetRowsRaw.push({
          marking, apartment: apt.name, room: roomLabel, aptIndex,
          lengthM: room.length, widthM: room.width,
          appliedAllowanceM: calc.appliedAllowanceM,
          withAllowanceText,
          rollWidthM: calc.rollWidth, cutLengthM: calc.cutLength,
          multiStrip: calc.multiStrip || 1,
          area: Math.round(calc.usedArea * 100) / 100,
          waste: Math.round(calc.waste * 100) / 100,
          seams: calc.seams || 0,
          comment: commentText
        });
      });

      if (markingsForApt.length) {
        apartmentPieces.push({
          apartment: apt.name,
          number: aptLabel,
          count: markingsForApt.length,
          first: markingsForApt[0],
          last: markingsForApt[markingsForApt.length - 1]
        });
      }
    });

    const summaryRowsArr = [];
    const apartmentPiecesRowsArr = [];

    [...summaryMap.entries()].sort((a,b)=>a[0]-b[0]).forEach(([rw, s]) => {
      const rowValues = [
        fmtLen(rw, units), fmtLen(s.totalLength, units), fmt(s.totalArea) + ' м²',
        [...s.apartments].join(', '), s.markings.join(', ')
      ];
      summaryRowsArr.push(rowValues);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px; border:1px solid #e4e7eb;">${rowValues[0]}</td>
        <td style="padding:8px; border:1px solid #e4e7eb;">${rowValues[1]}</td>
        <td style="padding:8px; border:1px solid #e4e7eb;">${rowValues[2]}</td>
        <td style="padding:8px; border:1px solid #e4e7eb;">${rowValues[3]}</td>
        <td style="padding:8px; border:1px solid #e4e7eb;">${rowValues[4]}</td>
      `;
      summaryBody.appendChild(tr);
    });

    if (apartmentPiecesBody) {
      apartmentPieces.forEach(ap => {
        const rangeText = ap.count > 1 ? `${ap.first} — ${ap.last}` : ap.first;
        apartmentPiecesRowsArr.push([ap.apartment, ap.count, rangeText]);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding:8px; border:1px solid #e4e7eb;">${ap.apartment}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${ap.count}</td>
          <td style="padding:8px; border:1px solid #e4e7eb;">${rangeText}</td>
        `;
        apartmentPiecesBody.appendChild(tr);
      });
    }

    function fillSelect(select, values, current) {
      const prev = current || select.value;
      select.innerHTML = '<option value="">Все</option>';
      [...values].sort().forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        select.appendChild(opt);
      });
      select.value = prev;
    }
    fillSelect(filterApt, aptSet);
    fillSelect(filterRoom, roomSet);
    fillSelect(filterWidth, widthSet);

    window.__linumLastCalc = {
      apartments, settings, summaryMap, rows: flatRows, apartmentPieces,
      resultsSheetRowsRaw, summaryRowsArr, apartmentPiecesRowsArr,
      summaryMapRaw: summaryMap
    };
  }

  function readSettings() {
    return {
      projectName: el('projectName').value.trim(),
      material: el('material').value.trim(),
      units: el('units').value,
      rollWidths: parseRollWidths(el('rollWidths').value),
      allowanceM: (parseNum(el('allowance').value) || 0) / 100,
      mode: el('mode').value
    };
  }

  function showMessage(text, isError) {
    const msg = el('message');
    msg.textContent = text;
    msg.className = 'message ' + (isError ? 'error' : 'success');
    msg.style.color = isError ? '#c53030' : '#217a45';
    setTimeout(() => { if (msg.textContent === text) msg.textContent = ''; }, 5000);
  }

  function calculate() {
    const settings = readSettings();
    if (!settings.rollWidths.length) {
      showMessage('Укажите хотя бы одну ширину рулона (число больше нуля).', true);
      return;
    }
    const apartments = collectData(settings.units);
    if (!apartments.length) {
      showMessage('Добавьте хотя бы одно помещение с корректными размерами.', true);
      return;
    }
    renderResults(apartments, settings);
    saveProject();
    showMessage('Расчёт выполнен успешно.', false);
  }

  function saveProject() {
    const settings = readSettings();
    const apartments = collectData(settings.units);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, apartments, timestamp: new Date().toISOString() }));
  }

  let autosaveTimer = null;
  function autosaveDebounced() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveProject, 1000);
  }

  function clearSettingsOnly() {
    el('projectName').value = '';
    el('material').value = 'Линолеум';
    el('units').value = 'mm';
    el('rollWidths').value = '2, 2.5, 3, 3.5, 4, 5';
    el('allowance').value = '5';
    el('mode').value = 'seams';
    saveProject();
  }

  function clearApartmentsOnly() {
    el('apartments').innerHTML = '';
    createApartment();
    saveProject();
  }

  function clearAll() {
    if (!confirm('Очистить все параметры и квартиры?')) return;
    clearSettingsOnly();
    clearApartmentsOnly();
    el('results').innerHTML = '';
    el('summary').innerHTML = '';
    el('apartmentPieces').innerHTML = '';
    window.__linumLastCalc = null;
  }

  function loadProjectFromData(data) {
    if (data.settings) {
      if (data.settings.projectName !== undefined) el('projectName').value = data.settings.projectName;
      if (data.settings.material !== undefined) el('material').value = data.settings.material;
      if (data.settings.units) el('units').value = data.settings.units;
      if (data.settings.rollWidths?.length) el('rollWidths').value = data.settings.rollWidths.join(', ');
      if (data.settings.allowanceM !== undefined) el('allowance').value = data.settings.allowanceM * 100;
      if (data.settings.mode) el('mode').value = data.settings.mode;
    }
    
    el('apartments').innerHTML = '';
    if (data.apartments && data.apartments.length > 0) {
      data.apartments.forEach(apt => {
        const aptNode = createApartment();
        aptNode.querySelector('.apt-number').value = apt.number || '';
        aptNode.querySelector('.apt-name').value = apt.name || '';
        aptNode.querySelector('.apt-comment').value = apt.comment || '';
        
        const roomsContainer = aptNode.querySelector('.rooms');
        roomsContainer.innerHTML = '';
        apt.rooms.forEach(room => {
          const rNode = createRoom(roomsContainer);
          const typeSelect = rNode.querySelector('.room-type');
          const exists = ROOM_TYPES.some(t => t.code === room.code);
          if (exists) {
            typeSelect.value = room.code;
          } else {
            typeSelect.value = 'custom';
            let ci = rNode.querySelector('.room-type-custom');
            if (!ci) {
              ci = document.createElement('input');
              ci.className = 'room-type-custom';
              ci.style.cssText = 'padding:6px; border:1px solid #d3dae0; border-radius:4px; width:100%; margin-top:4px;';
              typeSelect.parentNode.insertBefore(ci, typeSelect.nextSibling);
            }
            ci.value = room.typeName || '';
            ci.style.display = 'block';
          }
          
          rNode.querySelector('.room-length').value = data.settings.units === 'mm' ? Math.round(room.length * 1000) : room.length;
          rNode.querySelector('.room-width').value = data.settings.units === 'mm' ? Math.round(room.width * 1000) : room.width;
          if (Number.isFinite(room.allowanceCm)) {
            rNode.querySelector('.room-allowance').value = room.allowanceCm;
          } else {
            rNode.querySelector('.room-allowance').value = '';
          }
          rNode.querySelector('.room-comment').value = room.comment || '';
        });
      });
    } else {
      createApartment();
    }
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { createApartment(); return; }
      const data = JSON.parse(raw);
      loadProjectFromData(data);
    } catch (e) {
      createApartment();
    }
  }

  async function downloadCsv() {
    const last = window.__linumLastCalc;
    if (!last) { showMessage('Сначала выполните расчёт.', true); return; }
    if (typeof ExcelJS === 'undefined') { showMessage('Не удалось загрузить модуль Excel. Проверьте подключение к интернету.', true); return; }
    
    const units = last.settings.units;
    const lenNumFmt = units === 'mm' ? '#,##0 "мм"' : '0.00 "м"';
    const areaNumFmt = '0.00 "м²"';
    const pctNumFmt = '0%';
    const toDisplayLen = m => units === 'mm' ? Math.round(m * 1000) : Math.round(m * 100) / 100;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Линум';
    wb.created = new Date();

    function styleHeaderRow(row) {
      row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B686D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      row.height = 22;
    }

    function autoWidth(ws, colCount) {
      for (let c = 1; c <= colCount; c++) {
        let max = 8;
        ws.getColumn(c).eachCell({ includeEmpty: false }, cell => {
          const v = cell.numFmt === pctNumFmt ? `${Math.round(cell.value * 100)}%` : String(cell.value || '');
          if (v.length > max) max = v.length;
        });
        ws.getColumn(c).width = Math.min(max + 2, 45);
      }
    }

    // Лист 1: Результаты
    const wsResults = wb.addWorksheet('Результаты', { views: [{ state: 'frozen', ySplit: 1 }] });
    const resultsHeader = ['Маркировка','Квартира','Помещение','Длина','Ширина','Запас','С запасом','Ширина рулона','Полос','Метраж','Площадь','Остаток','% ост.','Стыков','Комментарий'];
    wsResults.addRow(resultsHeader);
    styleHeaderRow(wsResults.getRow(1));

    let totalArea = 0, totalWaste = 0, totalLength = 0;
    const bandColors = ['FFFFFFFF', 'FFEDF0F1'];
    
    (last.resultsSheetRowsRaw || []).forEach(r => {
      const pctVal = r.area > 0 ? (r.waste / r.area) : 0;
      const row = wsResults.addRow([
        r.marking, r.apartment, r.room, toDisplayLen(r.lengthM), toDisplayLen(r.widthM), r.appliedAllowanceM * 100, r.withAllowanceText,
        toDisplayLen(r.rollWidthM), r.multiStrip, toDisplayLen(r.cutLengthM), r.area, r.waste, pctVal, r.seams, r.comment
      ]);
      row.getCell(4).numFmt = lenNumFmt;
      row.getCell(5).numFmt = lenNumFmt;
      row.getCell(6).numFmt = '0.0 "см"';
      row.getCell(8).numFmt = lenNumFmt;
      row.getCell(10).numFmt = lenNumFmt;
      row.getCell(11).numFmt = areaNumFmt;
      row.getCell(12).numFmt = areaNumFmt;
      row.getCell(13).numFmt = pctNumFmt;
      row.getCell(15).alignment = { wrapText: true };

      const bandColor = bandColors[r.aptIndex % 2];
      row.eachCell({ includeEmpty: true }, cell => {
        if (!cell.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandColor } };
      });

      totalArea += r.area;
      totalWaste += r.waste;
      totalLength += toDisplayLen(r.cutLengthM * r.multiStrip);
    });

    const lastDataRow = wsResults.rowCount;
    if (lastDataRow > 1) {
      const totalRow = wsResults.addRow(['', '', '', '', '', '', '', '', 'ИТОГО:', totalLength, totalArea, totalWaste, '', '', '']);
      totalRow.eachCell(cell => { cell.font = { bold: true }; cell.border = { top: { style: 'double' } }; });
      totalRow.getCell(10).numFmt = lenNumFmt;
      totalRow.getCell(11).numFmt = areaNumFmt;
      totalRow.getCell(12).numFmt = areaNumFmt;

      wsResults.addConditionalFormatting({
        ref: `L2:L${lastDataRow}`,
        rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', val: 50 }, { type: 'max' }], color: [{ argb: 'FF63BE7B' }, { argb: 'FFFFEB84' }, { argb: 'FFF8696B' }] }]
      });
      wsResults.addConditionalFormatting({
        ref: `M2:M${lastDataRow}`,
        rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', val: 50 }, { type: 'max' }], color: [{ argb: 'FF63BE7B' }, { argb: 'FFFFEB84' }, { argb: 'FFF8696B' }] }]
      });
    }
    autoWidth(wsResults, resultsHeader.length);
    wsResults.getColumn(15).width = 40;

    // Лист 2: Куски по квартирам
    const wsPieces = wb.addWorksheet('Куски по квартирам', { views: [{ state: 'frozen', ySplit: 1 }] });
    const piecesHeader = ['Квартира','Кол-во кусков','Диапазон маркировки'];
    wsPieces.addRow(piecesHeader);
    styleHeaderRow(wsPieces.getRow(1));
    let totalPieces = 0;
    (last.apartmentPiecesRowsArr || []).forEach(r => {
      wsPieces.addRow(r);
      totalPieces += Number(r[1]) || 0;
    });
    if (wsPieces.rowCount > 1) {
      const totalRow = wsPieces.addRow(['ИТОГО:', totalPieces, '']);
      totalRow.eachCell(cell => { cell.font = { bold: true }; cell.border = { top: { style: 'double' } }; });
    }
    autoWidth(wsPieces, piecesHeader.length);

    // Лист 3: Сводка для заказа
    const wsSummary = wb.addWorksheet('Сводка для заказа', { views: [{ state: 'frozen', ySplit: 1 }] });
    const summaryHeader = ['Ширина рулона','Погонный метраж','Площадь','Квартиры','Маркировки для отрезки'];
    wsSummary.addRow(summaryHeader);
    styleHeaderRow(wsSummary.getRow(1));
    let sumLength = 0, sumArea = 0;
    [...last.summaryMapRaw.entries()].sort((a,b)=>a[0]-b[0]).forEach(([rw, s]) => {
      const row = wsSummary.addRow([toDisplayLen(rw), toDisplayLen(s.totalLength), Math.round(s.totalArea * 100) / 100, [...s.apartments].join(', '), s.markings.join(', ')]);
      row.getCell(1).numFmt = lenNumFmt;
      row.getCell(2).numFmt = lenNumFmt;
      row.getCell(3).numFmt = areaNumFmt;
      row.getCell(4).alignment = { wrapText: true };
      row.getCell(5).alignment = { wrapText: true };
      sumLength += toDisplayLen(s.totalLength);
      sumArea += s.totalArea;
    });
    if (wsSummary.rowCount > 1) {
      const totalRow = wsSummary.addRow(['ИТОГО:', sumLength, Math.round(sumArea * 100) / 100, '', '']);
      totalRow.eachCell(cell => { cell.font = { bold: true }; cell.border = { top: { style: 'double' } }; });
      totalRow.getCell(2).numFmt = lenNumFmt;
      totalRow.getCell(3).numFmt = areaNumFmt;
    }
    autoWidth(wsSummary, summaryHeader.length);
    wsSummary.getColumn(4).width = 30;
    wsSummary.getColumn(5).width = 40;

    // Лист 4: Схема раскроя
    const wsScheme = wb.addWorksheet('Схема раскроя', { views: [{ showGridLines: false }] });
    const SCHEME_COL_W = 2.2, SCHEME_ROW_H = 12, SCALE_MM_PER_COL = 150, SCALE_MM_PER_ROW = 150, MAX_SCHEME_COLS = 22;
    let schemeCursorRow = 1;
    
    const schemeItems = (last.resultsSheetRowsRaw || []);
    if (schemeItems.length > 80) {
      const noteRow = wsScheme.getRow(schemeCursorRow);
      noteRow.getCell(1).value = `Показаны первые 80 из ${schemeItems.length} кусков. Полный список — на листе "Результаты".`;
      noteRow.getCell(1).font = { italic: true, color: { argb: 'FF9AA5B1' } };
      schemeCursorRow += 2;
    }
    
    schemeItems.slice(0, 80).forEach(r => {
      const rollWidthMm = units === 'mm' ? Math.round(r.rollWidthM * 1000) : Math.round(r.rollWidthM * 1000);
      const cutLengthMm = Math.round(r.cutLengthM * 1000);
      const stripsCount = r.multiStrip || 1;

      const colsForRoll = Math.max(2, Math.min(MAX_SCHEME_COLS, Math.round(rollWidthMm / SCALE_MM_PER_COL)));
      const rowsForCut = Math.max(2, Math.round(cutLengthMm / SCALE_MM_PER_ROW));

      const titleRow = wsScheme.getRow(schemeCursorRow);
      titleRow.getCell(1).value = `${r.marking} — ${r.apartment}, ${r.room} (рулон ${units === 'mm' ? rollWidthMm + ' мм' : (rollWidthMm/1000).toFixed(2) + ' м'}, отрез ${units === 'mm' ? cutLengthMm + ' мм' : (cutLengthMm/1000).toFixed(2) + ' м'}${stripsCount > 1 ? ', ' + stripsCount + ' полотна' : ''})`;
      titleRow.getCell(1).font = { bold: true, size: 11 };
      schemeCursorRow += 1;

      const blockStartRow = schemeCursorRow;
      for (let stripIdx = 0; stripIdx < stripsCount; stripIdx++) {
        const colOffset = stripIdx * (colsForRoll + 1);
        for (let rr = 0; rr < rowsForCut; rr++) {
          const excelRow = wsScheme.getRow(blockStartRow + rr);
          excelRow.height = SCHEME_ROW_H;
          for (let cc = 0; cc < colsForRoll; cc++) {
            const cell = excelRow.getCell(colOffset + cc + 1);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFD4D8' } };
            cell.border = { top: { style: 'thin', color: { argb: 'FF5B686D' } }, left: { style: 'thin', color: { argb: 'FF5B686D' } }, right: { style: 'thin', color: { argb: 'FF5B686D' } }, bottom: { style: 'thin', color: { argb: 'FF5B686D' } } };
          }
        }
        const labelCell = wsScheme.getRow(blockStartRow).getCell(colOffset + 1);
        labelCell.value = stripsCount > 1 ? `Полотно ${stripIdx + 1}` : r.marking;
        labelCell.font = { bold: true, size: 9, color: { argb: 'FF1F2933' } };
        labelCell.alignment = { wrapText: true, vertical: 'top' };
      }
      schemeCursorRow = blockStartRow + rowsForCut + 2;
    });

    for (let c = 1; c <= MAX_SCHEME_COLS * 2 + 2; c++) {
      wsScheme.getColumn(c).width = SCHEME_COL_W;
    }

    const fileName = (last.settings.projectName || 'linum') + '_zakaz.xlsx';
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function isAppsScriptConfigured() {
    return !!APPS_SCRIPT_URL && APPS_SCRIPT_URL.indexOf('https://') === 0;
  }

  async function exportSheets() {
    if (!isAppsScriptConfigured()) return showMessage('URL Google Apps Script не настроен в app.js.', true);
    const last = window.__linumLastCalc;
    if (!last) return showMessage('Сначала выполните расчёт.', true);
    
    const btn = el('exportSheets');
    btn.disabled = true;
    btn.textContent = 'Выгрузка...';
    
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        settings: last.settings,
        results: last.resultsSheetRowsRaw,
        pieces: last.apartmentPiecesRowsArr,
        summary: last.summaryRowsArr
      };
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showMessage('Выгрузка завершена (отправлено в Google Таблицу).', false);
      setTimeout(refreshArchiveList, 1500);
    } catch (err) {
      console.error(err);
      showMessage('Ошибка выгрузки: ' + err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Выгрузить в Google таблицы';
    }
  }

  async function refreshArchiveList() {
    if (!isAppsScriptConfigured()) return;
    const select = el('archiveList');
    try {
      const response = await fetch(APPS_SCRIPT_URL + '?action=list');
      const data = await response.json();
      select.innerHTML = '<option value="">Выберите сохранённый расчёт...</option>';
      if (data.status === 'success' && data.items && data.items.length > 0) {
        data.items.forEach(item => {
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.textContent = `${new Date(item.timestamp).toLocaleString('ru-RU')} — ${item.projectName}`;
          select.appendChild(opt);
        });
      } else {
        select.innerHTML = '<option value="">Нет сохранённых расчётов</option>';
      }
    } catch (e) {
      select.innerHTML = '<option value="">Ошибка загрузки списка</option>';
    }
  }

  async function loadArchiveItem() {
    const select = el('archiveList');
    const id = select.value;
    if (!id) return showMessage('Выберите расчёт из списка.', true);
    
    const btn = el('loadArchiveBtn');
    btn.disabled = true;
    btn.textContent = 'Загрузка...';
    
    try {
      const response = await fetch(APPS_SCRIPT_URL + '?action=get&id=' + encodeURIComponent(id));
      const data = await response.json();
      if (data.status === 'success' && data.data) {
        loadProjectFromData(data.data);
        saveProject();
        showMessage('Проект загружен из архива.', false);
      } else {
        showMessage('Не удалось загрузить данные проекта.', true);
      }
    } catch (e) {
      showMessage('Ошибка загрузки: ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Загрузить выбранный расчёт';
    }
  }

  el('addApartmentBottom').addEventListener('click', () => { createApartment(); autosaveDebounced(); });
  el('calculateBottom').addEventListener('click', calculate);
  el('saveProject').addEventListener('click', () => { saveProject(); showMessage('Параметры сохранены в браузере.', false); });
  el('clearSettings').addEventListener('click', clearSettingsOnly);
  el('clearApartments').addEventListener('click', clearApartmentsOnly);
  el('clearAll').addEventListener('click', clearAll);
  el('downloadCsv').addEventListener('click', downloadCsv);
  el('printBtn').addEventListener('click', () => window.print());
  
  el('exportSheets').addEventListener('click', exportSheets);
  el('refreshArchive').addEventListener('click', refreshArchiveList);
  el('loadArchiveBtn').addEventListener('click', loadArchiveItem);

  document.querySelectorAll('input, select').forEach(i => i.addEventListener('input', autosaveDebounced));

  function applyFilters() {
    const aVal = el('filterApartment').value;
    const rVal = el('filterRoom').value;
    const wVal = el('filterWidth').value;
    document.querySelectorAll('#results tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 13) return;
      const aptName = cells[1].textContent;
      const roomName = cells[2].textContent.split(' (')[0];
      const rollWidth = cells[6].textContent;
      const show = (!aVal || aptName === aVal) && (!rVal || roomName === rVal) && (!wVal || rollWidth === wVal);
      tr.style.display = show ? '' : 'none';
    });
  }
  ['filterApartment', 'filterRoom', 'filterWidth'].forEach(id => {
    el(id).addEventListener('change', applyFilters);
  });

  loadProject();
  refreshArchiveList();

})();