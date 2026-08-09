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
    const customInput = room.querySelector('.room-custom');
    const codeInput = room.querySelector('.room-code');

    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'custom') {
        customInput.hidden = false;
        codeInput.hidden = false;
      } else {
        customInput.hidden = true;
        codeInput.hidden = true;
      }
    });

    room.querySelector('.delete-room').addEventListener('click', () => room.remove());
    room.querySelector('.copy-room').addEventListener('click', () => {
      const clone = createRoom(container);
      clone.querySelector('.room-type').value = typeSelect.value;
      clone.querySelector('.room-type').dispatchEvent(new Event('change'));
      clone.querySelector('.room-custom').value = customInput.value;
      clone.querySelector('.room-code').value = codeInput.value;
      clone.querySelector('.room-length').value = room.querySelector('.room-length').value;
      clone.querySelector('.room-width').value = room.querySelector('.room-width').value;
      clone.querySelector('.room-comment').value = room.querySelector('.room-comment').value;
    });

    container.appendChild(room);
    return room;
  }

  function createApartment() {
    const tpl = el('apartmentTpl').content.cloneNode(true);
    const apt = tpl.querySelector('.apartment');
    const roomsContainer = apt.querySelector('.rooms');

    apt.querySelector('.add-room').addEventListener('click', () => createRoom(roomsContainer));
    apt.querySelector('.delete-apt').addEventListener('click', () => apt.remove());
    apt.querySelector('.copy-apt').addEventListener('click', () => {
      const clone = createApartment();
      clone.querySelector('.apt-number').value = apt.querySelector('.apt-number').value;
      clone.querySelector('.apt-name').value = apt.querySelector('.apt-name').value;
      clone.querySelector('.apt-comment').value = apt.querySelector('.apt-comment').value;
      const cloneRooms = clone.querySelector('.rooms');
      roomsContainer.querySelectorAll('.room').forEach(r => {
        const nr = createRoom(cloneRooms);
        nr.querySelector('.room-type').value = r.querySelector('.room-type').value;
        nr.querySelector('.room-type').dispatchEvent(new Event('change'));
        nr.querySelector('.room-custom').value = r.querySelector('.room-custom').value;
        nr.querySelector('.room-code').value = r.querySelector('.room-code').value;
        nr.querySelector('.room-length').value = r.querySelector('.room-length').value;
        nr.querySelector('.room-width').value = r.querySelector('.room-width').value;
        nr.querySelector('.room-comment').value = r.querySelector('.room-comment').value;
      });
    });

    el('apartments').appendChild(apt);
    createRoom(roomsContainer);
    return apt;
  }

  function roomTypeName(select, customInput) {
    if (select.value === 'custom') {
      return customInput.value.trim() || 'Своё помещение';
    }
    const t = ROOM_TYPES.find(t => t.code === select.value);
    return t ? t.name : select.value;
  }

  function collectData(units) {
    const apartments = [];
    document.querySelectorAll('#apartments .apartment').forEach(apt => {
      const number = apt.querySelector('.apt-number').value.trim();
      const name = apt.querySelector('.apt-name').value.trim() || number || 'Квартира';
      const comment = apt.querySelector('.apt-comment').value.trim();
      const rooms = [];
      apt.querySelectorAll('.room').forEach(r => {
        const typeSelect = r.querySelector('.room-type');
        const customInput = r.querySelector('.room-custom');
        const codeInput = r.querySelector('.room-code');
        const rawLength = parseNum(r.querySelector('.room-length').value);
        const rawWidth = parseNum(r.querySelector('.room-width').value);
        const roomComment = r.querySelector('.room-comment').value.trim();
        if (!Number.isFinite(rawLength) || !Number.isFinite(rawWidth)) return;
        rooms.push({
          typeName: roomTypeName(typeSelect, customInput),
          code: codeInput.value.trim(),
          length: toMeters(rawLength, units),
          width: toMeters(rawWidth, units),
          comment: roomComment
        });
      });
      if (rooms.length) apartments.push({ number, name, comment, rooms });
    });
    return apartments;
  }

  function calculateRoom(room, allowanceM, rollWidths, mode) {
    const roomLenWithAllowance = room.length + allowanceM * 2;
    const roomWidthWithAllowance = room.width + allowanceM * 2;
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
            const candidate = { rollWidth: rw, cutLength, usedArea, waste, seams, withAllowance: true };
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
      best = { rollWidth: stripWidth, cutLength, usedArea, waste, seams: Math.max(0, stripsAcross - 1), withAllowance: true, multiStrip: stripsAcross };
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
    const resultsSheetRows = [];
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
          ? `${fmtLen(room.length + settings.allowanceM*2, units)}×${fmtLen(room.width + settings.allowanceM*2, units)} (${calc.multiStrip} полотна)`
          : `${fmtLen(calc.cutLength, units)} по рулону`;
        const roomLabel = room.typeName + (room.code ? ' ('+room.code+')' : '');
        const rollWidthText = fmtLen(calc.rollWidth, units);
        const cutLengthText = fmtLen(calc.cutLength, units);
        const areaText = fmt(calc.usedArea) + ' м²';
        const wasteText = fmt(calc.waste) + ' м²';
        const commentText = room.comment || apt.comment || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${marking}</td>
          <td>${apt.name}</td>
          <td>${roomLabel}</td>
          <td>${roomSizeText}</td>
          <td>${withAllowanceText}</td>
          <td>${rollWidthText}</td>
          <td>${calc.multiStrip || 1}</td>
          <td>${cutLengthText}</td>
          <td>${areaText}</td>
          <td>${wasteText}</td>
          <td>${calc.seams || 0}</td>
          <td>${commentText}</td>
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

        resultsSheetRows.push([
          marking, apt.name, roomLabel, roomSizeText, withAllowanceText,
          rollWidthText, rollWidthText, cutLengthText, areaText, wasteText, calc.seams || 0, commentText
        ]);

        resultsSheetRowsRaw.push({
          marking, apartment: apt.name, room: roomLabel, aptIndex,
          lengthM: room.length, widthM: room.width,
          withAllowanceText,
          rollWidthM: calc.rollWidth, cutLengthM: calc.cutLength,
          multiStrip: calc.multiStrip || 1,
          area: Math.round(calc.usedArea * 100) / 100,
          waste: Math.round(calc.waste * 100) / 100,
          seams: calc.seams || 0,
          comment: commentText
        });

        cuttingRows.push({
          marking, apartment: apt.name,
          rollWidthNum: calc.rollWidth, rollWidthText, cutLengthText
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
    [...summaryMap.entries()].sort((a,b)=>a[0]-b[0]).forEach(([rw, s]) => {
      const rowValues = [
        fmtLen(rw, units), fmtLen(s.totalLength, units), fmt(s.totalArea) + ' м²',
        [...s.apartments].join(', '), s.markings.join(', ')
      ];
      summaryRowsArr.push(rowValues);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rowValues[0]}</td>
        <td>${rowValues[1]}</td>
        <td>${rowValues[2]}</td>
        <td>${rowValues[3]}</td>
        <td>${rowValues[4]}</td>
      `;
      summaryBody.appendChild(tr);
    });

    const apartmentPiecesRowsArr = [];
    if (apartmentPiecesBody) {
      apartmentPieces.forEach(ap => {
        const rangeText = ap.count > 1 ? `${ap.first} — ${ap.last}` : ap.first;
        apartmentPiecesRowsArr.push([ap.apartment, ap.count, rangeText]);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${ap.apartment}</td>
          <td>${ap.count}</td>
          <td>${rangeText}</td>
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
      resultsSheetRows, resultsSheetRowsRaw, cuttingRows, summaryRowsArr, apartmentPiecesRowsArr,
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
    msg.style.color = isError ? '#c53030' : '#2f855a';
  }

  function calculate() {
    const settings = readSettings();
    const apartments = collectData(settings.units);
    if (!apartments.length) {
      showMessage('Добавьте хотя бы одно помещение с размерами.', true);
      return;
    }
    if (!settings.rollWidths.length) {
      showMessage('Укажите хотя бы одну ширину рулона.', true);
      return;
    }
    renderResults(apartments, settings);
    showMessage('Готово: рассчитано ' + apartments.reduce((n,a)=>n+a.rooms.length,0) + ' помещений.');
    const resultsSection = el('results')?.closest('section');
    if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function saveProject() {
    const settings = readSettings();
    const data = { settings, apartments: collectData(settings.units) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showMessage('Параметры сохранены локально в браузере.');
  }

  function autosaveNow() {
    try {
      const settings = readSettings();
      const data = { settings, apartments: collectData(settings.units) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  let autosaveTimer = null;
  function autosaveDebounced() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, 400);
  }

  function resetSettingsToDefault() {
    el('projectName').value = '';
    el('material').value = '';
    el('units').value = 'm';
    el('rollWidths').value = '2, 2.5, 3, 3.5, 4, 5';
    el('allowance').value = '10';
    el('mode').value = 'seams';
  }

  function resetApartmentsArea() {
    el('apartments').innerHTML = '';
    el('results').innerHTML = '';
    el('summary').innerHTML = '';
    if (el('apartmentPieces')) el('apartmentPieces').innerHTML = '';
    ['filterApartment','filterRoom','filterWidth'].forEach(id => {
      el(id).innerHTML = '<option value="">Все</option>';
    });
    window.__linumLastCalc = null;
    createApartment();
  }

  function resetToBlank() {
    resetApartmentsArea();
    resetSettingsToDefault();
  }

  function clearAll() {
    const ok = window.confirm('Удалить все данные проекта (квартиры, помещения, результаты) и начать заполнение с нуля? Сохранённые ранее параметры в браузере также будут удалены.');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    resetToBlank();
    showMessage('Все данные очищены. Можете начинать заполнение снова.', false);
    autosaveNow();
  }

  function clearSettingsOnly() {
    const ok = window.confirm('Очистить только параметры проекта (название, материал, единицы, ширины рулонов, запас, режим)? Квартиры и помещения останутся без изменений.');
    if (!ok) return;
    resetSettingsToDefault();
    showMessage('Параметры проекта сброшены к значениям по умолчанию. Квартиры сохранены.', false);
    autosaveNow();
  }

  function clearApartmentsOnly() {
    const ok = window.confirm('Удалить все квартиры, помещения и результаты расчёта? Параметры проекта (название, единицы, рулоны и т.д.) останутся как есть.');
    if (!ok) return;
    resetApartmentsArea();
    showMessage('Квартиры и результаты очищены. Можете добавлять новые квартиры. Параметры проекта сохранены.', false);
    autosaveNow();
  }

  function loadProjectFromData(data) {
    el('apartments').innerHTML = '';
    el('projectName').value = data.settings?.projectName || '';
    el('material').value = data.settings?.material || '';
    const units = data.settings?.units === 'mm' ? 'mm' : 'm';
    el('units').value = units;
    if (data.settings?.rollWidths?.length) el('rollWidths').value = data.settings.rollWidths.join(', ');
    if (data.settings?.allowanceM !== undefined) el('allowance').value = Math.round(data.settings.allowanceM * 100);
    if (data.settings?.mode) el('mode').value = data.settings.mode;

    if (data.apartments?.length) {
      data.apartments.forEach(apt => {
        const aptEl = createApartment();
        aptEl.querySelectorAll('.room').forEach(r => r.remove());
        aptEl.querySelector('.apt-number').value = apt.number || '';
        aptEl.querySelector('.apt-name').value = apt.name || '';
        aptEl.querySelector('.apt-comment').value = apt.comment || '';
        const roomsContainer = aptEl.querySelector('.rooms');
        apt.rooms.forEach(room => {
          const r = createRoom(roomsContainer);
          const typeMatch = ROOM_TYPES.find(t => t.name === room.typeName);
          r.querySelector('.room-type').value = typeMatch ? typeMatch.code : 'custom';
          r.querySelector('.room-type').dispatchEvent(new Event('change'));
          if (!typeMatch) r.querySelector('.room-custom').value = room.typeName;
          r.querySelector('.room-code').value = room.code || '';
          r.querySelector('.room-length').value = units === 'mm' ? Math.round(room.length * 1000) : room.length;
          r.querySelector('.room-width').value = units === 'mm' ? Math.round(room.width * 1000) : room.width;
          r.querySelector('.room-comment').value = room.comment || '';
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

    function autoWidth(ws, colCount, extraRows) {
      for (let c = 1; c <= colCount; c++) {
        let max = 10;
        ws.getColumn(c).eachCell({ includeEmpty: false }, cell => {
          const v = cell.value == null ? '' : String(cell.value);
          if (v.length > max) max = v.length;
        });
        ws.getColumn(c).width = Math.min(max + 2, 45);
      }
    }

    // Лист 1: Результаты
    const wsResults = wb.addWorksheet('Результаты', { views: [{ state: 'frozen', ySplit: 1 }] });
    const resultsHeader = ['Маркировка','Квартира','Помещение','Длина','Ширина','С запасом','Ширина рулона','Метраж','Площадь','Остаток','Стыков','Комментарий'];
    wsResults.addRow(resultsHeader);
    styleHeaderRow(wsResults.getRow(1));

    let totalArea = 0, totalWaste = 0, totalLength = 0;
    const bandColors = ['FFFFFFFF', 'FFEDF0F1'];
    (last.resultsSheetRowsRaw || []).forEach(r => {
      const row = wsResults.addRow([
        r.marking, r.apartment, r.room, toDisplayLen(r.lengthM), toDisplayLen(r.widthM), r.withAllowanceText,
        toDisplayLen(r.rollWidthM), toDisplayLen(r.cutLengthM), r.area, r.waste, r.seams, r.comment
      ]);
      row.getCell(4).numFmt = lenNumFmt;
      row.getCell(5).numFmt = lenNumFmt;
      row.getCell(7).numFmt = lenNumFmt;
      row.getCell(8).numFmt = lenNumFmt;
      row.getCell(9).numFmt = areaNumFmt;
      row.getCell(10).numFmt = areaNumFmt;
      row.getCell(12).alignment = { wrapText: true };

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
      const totalRow = wsResults.addRow(['', '', '', '', '', '', 'ИТОГО:', totalLength, totalArea, totalWaste, '', '']);
      totalRow.eachCell(cell => { cell.font = { bold: true }; cell.border = { top: { style: 'double' } }; });
      totalRow.getCell(8).numFmt = lenNumFmt;
      totalRow.getCell(9).numFmt = areaNumFmt;
      totalRow.getCell(10).numFmt = areaNumFmt;

      // Условное форматирование: колонка "Остаток" (10) — цветовая шкала зелёный→жёлтый→красный
      wsResults.addConditionalFormatting({
        ref: `J2:J${lastDataRow}`,
        rules: [{
          type: 'colorScale',
          cfvo: [{ type: 'min' }, { type: 'percentile', val: 50 }, { type: 'max' }],
          color: [{ argb: 'FF63BE7B' }, { argb: 'FFFFEB84' }, { argb: 'FFF8696B' }]
        }]
      });
    }
    autoWidth(wsResults, resultsHeader.length);
    wsResults.getColumn(12).width = 40;

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

    // Лист 4: Схема раскроя — упрощённая визуализация каждого куска на полотне рулона
    const wsScheme = wb.addWorksheet('Схема раскроя', { views: [{ showGridLines: false }] });
    const SCHEME_COL_W = 2.2;
    const SCHEME_ROW_H = 12;
    const SCALE_MM_PER_COL = 150;
    const SCALE_MM_PER_ROW = 150;
    const MAX_SCHEME_COLS = 22;
    let schemeCursorRow = 1;
    const MAX_SCHEME_ITEMS = 80;
    const schemeItems = (last.resultsSheetRowsRaw || []);
    if (schemeItems.length > MAX_SCHEME_ITEMS) {
      const noteRow = wsScheme.getRow(schemeCursorRow);
      noteRow.getCell(1).value = `Показаны первые ${MAX_SCHEME_ITEMS} из ${schemeItems.length} кусков. Полный список — на листе "Результаты".`;
      noteRow.getCell(1).font = { italic: true, color: { argb: 'FF9AA5B1' } };
      schemeCursorRow += 2;
    }
    schemeItems.slice(0, MAX_SCHEME_ITEMS).forEach(r => {
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
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF5B686D' } },
              left: { style: 'thin', color: { argb: 'FF5B686D' } },
              right: { style: 'thin', color: { argb: 'FF5B686D' } },
              bottom: { style: 'thin', color: { argb: 'FF5B686D' } }
            };
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
    const last = window.__linumLastCalc;
    if (!last) { showMessage('Сначала выполните расчёт.', true); return; }
    if (!isAppsScriptConfigured()) {
      showMessage('Функция экспорта в Google таблицы требует подключения скрипта (см. google-apps-script/Code.gs и README).', true);
      return;
    }
    const id = 'linum-' + Date.now();
    const dateISO = new Date().toISOString();
    const payload = {
      id, dateISO,
      settings: last.settings,
      apartments: collectData(last.settings.units),
      rows: last.rows,
      resultsRows: last.resultsSheetRows,
      cuttingRows: last.cuttingRows,
      summaryRows: last.summaryRowsArr,
      apartmentPiecesRows: last.apartmentPiecesRowsArr
    };
    showMessage('Сохраняется в Google таблицу…', false);
    try {
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.ok) {
        showMessage('Сохранено в архив и на листы «Результаты», «Карта раскроя», «Куски по квартирам», «Сводка для заказа» (' + new Date(data.dateISO).toLocaleString('ru-RU') + ').', false);
        refreshArchiveList();
      } else {
        showMessage('Ошибка сохранения: ' + (data.error || 'неизвестная ошибка'), true);
      }
    } catch (err) {
      showMessage('Не удалось связаться с Google таблицей. Проверьте адрес и настройки доступа веб-аппа.', true);
    }
  }

  async function refreshArchiveList() {
    const select = el('archiveSelect');
    if (!select) return;
    if (!isAppsScriptConfigured()) {
      select.innerHTML = '<option value="">Архив не настроен</option>';
      return;
    }
    select.innerHTML = '<option value="">Загрузка…</option>';
    try {
      const resp = await fetch(APPS_SCRIPT_URL + '?action=list');
      const data = await resp.json();
      if (!data.ok) { select.innerHTML = '<option value="">Ошибка загрузки</option>'; return; }
      if (!data.items.length) { select.innerHTML = '<option value="">Архив пуст</option>'; return; }
      select.innerHTML = '';
      data.items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        const dt = new Date(item.dateISO).toLocaleString('ru-RU');
        opt.textContent = dt + (item.projectName ? ' — ' + item.projectName : '');
        select.appendChild(opt);
      });
    } catch (err) {
      select.innerHTML = '<option value="">Нет связи с архивом</option>';
    }
  }

  async function loadArchiveItem() {
    const select = el('archiveSelect');
    if (!select || !select.value) { showMessage('Выберите сохранённый расчёт из списка.', true); return; }
    if (!isAppsScriptConfigured()) { showMessage('Архив не настроен.', true); return; }
    try {
      const resp = await fetch(APPS_SCRIPT_URL + '?action=load&id=' + encodeURIComponent(select.value));
      const data = await resp.json();
      if (!data.ok) { showMessage('Не удалось загрузить расчёт: ' + (data.error || ''), true); return; }
      loadProjectFromData({ settings: data.settings, apartments: data.apartments });
      showMessage('Загружен расчёт от ' + new Date(data.dateISO).toLocaleString('ru-RU') + '. Отредактируйте и нажмите «Выгрузить в Google таблицы», чтобы сохранить как новую версию.', false);
      autosaveNow();
    } catch (err) {
      showMessage('Ошибка связи с архивом.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (el('addApartmentBottom')) el('addApartmentBottom').addEventListener('click', createApartment);
    if (el('calculateBottom')) el('calculateBottom').addEventListener('click', calculate);
    el('saveProject').addEventListener('click', saveProject);
    if (el('clearSettings')) el('clearSettings').addEventListener('click', clearSettingsOnly);
    if (el('clearApartments')) el('clearApartments').addEventListener('click', clearApartmentsOnly);
    el('clearAll').addEventListener('click', clearAll);
    el('downloadCsv').addEventListener('click', downloadCsv);
    el('exportSheets').addEventListener('click', exportSheets);
    el('printBtn').addEventListener('click', () => window.print());
    if (el('refreshArchive')) el('refreshArchive').addEventListener('click', refreshArchiveList);
    if (el('loadArchive')) el('loadArchive').addEventListener('click', loadArchiveItem);

    el('filterApartment').addEventListener('change', applyFilters);
    el('filterRoom').addEventListener('change', applyFilters);
    el('filterWidth').addEventListener('change', applyFilters);

    function applyFilters() {
      const aVal = el('filterApartment').value;
      const rVal = el('filterRoom').value;
      const wVal = el('filterWidth').value;
      document.querySelectorAll('#results tr').forEach(tr => {
        const cells = tr.children;
        const aptName = cells[1]?.textContent || '';
        const roomName = (cells[2]?.textContent || '').split(' (')[0];
        const rollWidth = cells[5]?.textContent || '';
        const show = (!aVal || aptName === aVal) && (!rVal || roomName === rVal) && (!wVal || rollWidth === wVal);
        tr.style.display = show ? '' : 'none';
      });
    }

    loadProject();
    refreshArchiveList();

    document.addEventListener('input', autosaveDebounced);
    document.addEventListener('change', autosaveDebounced);
    const apartmentsObserver = new MutationObserver(() => autosaveDebounced());
    apartmentsObserver.observe(el('apartments'), { childList: true, subtree: true });
  });
})();
