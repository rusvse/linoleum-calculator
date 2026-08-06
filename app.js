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

  function collectData() {
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
        const length = parseNum(r.querySelector('.room-length').value);
        const width = parseNum(r.querySelector('.room-width').value);
        const roomComment = r.querySelector('.room-comment').value.trim();
        if (!Number.isFinite(length) || !Number.isFinite(width)) return;
        rooms.push({
          typeName: roomTypeName(typeSelect, customInput),
          code: codeInput.value.trim(),
          length, width, comment: roomComment
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
    resultsBody.innerHTML = '';
    summaryBody.innerHTML = '';

    const filterApt = el('filterApartment');
    const filterRoom = el('filterRoom');
    const filterWidth = el('filterWidth');
    const aptSet = new Set(), roomSet = new Set(), widthSet = new Set();

    const summaryMap = new Map();
    const flatRows = [];
    let markingCounter = 1;

    apartments.forEach(apt => {
      apt.rooms.forEach(room => {
        const calc = calculateRoom(room, settings.allowanceM, settings.rollWidths, settings.mode);
        const marking = `${apt.number || apt.name}-${String(markingCounter++).padStart(2, '0')}`;
        const roomSizeText = `${fmt(room.length)}×${fmt(room.width)} м`;
        const withAllowanceText = calc.multiStrip
          ? `${fmt(room.length + settings.allowanceM*2)}×${fmt(room.width + settings.allowanceM*2)} м (${calc.multiStrip} полотна)`
          : `${fmt(calc.cutLength)} м по рулону`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${marking}</td>
          <td>${apt.name}</td>
          <td>${room.typeName}${room.code ? ' ('+room.code+')' : ''}</td>
          <td>${roomSizeText}</td>
          <td>${withAllowanceText}</td>
          <td>${fmt(calc.rollWidth)} м</td>
          <td>${fmt(calc.cutLength)} м</td>
          <td>${fmt(calc.rollWidth)}×${fmt(calc.cutLength)}</td>
          <td>${fmt(calc.usedArea)} м²</td>
          <td>${fmt(calc.waste)} м²</td>
          <td>${calc.seams || 0}</td>
          <td>${room.comment || apt.comment || ''}</td>
        `;
        resultsBody.appendChild(tr);

        aptSet.add(apt.name);
        roomSet.add(room.typeName);
        widthSet.add(calc.rollWidth);

        const key = calc.rollWidth;
        if (!summaryMap.has(key)) summaryMap.set(key, { totalLength: 0, totalArea: 0, apartments: new Set(), markings: [] });
        const s = summaryMap.get(key);
        s.totalLength += calc.cutLength * (calc.multiStrip || 1);
        s.totalArea += calc.usedArea;
        s.apartments.add(apt.name);
        s.markings.push(marking);

        flatRows.push({
          marking, apartment: apt.name, room: room.typeName + (room.code ? ' ('+room.code+')' : ''),
          size: roomSizeText, rollWidth: calc.rollWidth, length: calc.cutLength,
          area: calc.usedArea, waste: calc.waste, seams: calc.seams || 0,
          comment: room.comment || apt.comment || ''
        });
      });
    });

    [...summaryMap.entries()].sort((a,b)=>a[0]-b[0]).forEach(([rw, s]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(rw)} м</td>
        <td>${fmt(s.totalLength)} м</td>
        <td>${fmt(s.totalArea)} м²</td>
        <td>${[...s.apartments].join(', ')}</td>
        <td>${s.markings.join(', ')}</td>
      `;
      summaryBody.appendChild(tr);
    });

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
    fillSelect(filterWidth, [...widthSet].map(fmt));

    window.__linumLastCalc = { apartments, settings, summaryMap, rows: flatRows };
  }

  function readSettings() {
    return {
      projectName: el('projectName').value.trim(),
      material: el('material').value.trim(),
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
    const apartments = collectData();
    const settings = readSettings();
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
  }

  function saveProject() {
    const data = { settings: readSettings(), apartments: collectData() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showMessage('Параметры сохранены локально в браузере.');
  }

  function resetToBlank() {
    el('apartments').innerHTML = '';
    el('results').innerHTML = '';
    el('summary').innerHTML = '';
    el('projectName').value = '';
    el('material').value = '';
    el('rollWidths').value = '2, 2.5, 3, 3.5, 4, 5';
    el('allowance').value = '10';
    el('mode').value = 'seams';
    ['filterApartment','filterRoom','filterWidth'].forEach(id => {
      el(id).innerHTML = '<option value="">Все</option>';
    });
    window.__linumLastCalc = null;
    createApartment();
  }

  function clearAll() {
    const ok = window.confirm('Удалить все данные проекта (квартиры, помещения, результаты) и начать заполнение с нуля? Сохранённые ранее параметры в браузере также будут удалены.');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    resetToBlank();
    showMessage('Все данные очищены. Можете начинать заполнение снова.', false);
  }

  function loadProjectFromData(data) {
    el('apartments').innerHTML = '';
    el('projectName').value = data.settings?.projectName || '';
    el('material').value = data.settings?.material || '';
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
          r.querySelector('.room-length').value = room.length;
          r.querySelector('.room-width').value = room.width;
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

  function downloadCsv() {
    const last = window.__linumLastCalc;
    if (!last) { showMessage('Сначала выполните расчёт.', true); return; }
    const rows = [['Ширина рулона','Погонный метраж','Площадь','Помещений','Маркировки']];
    [...last.summaryMap.entries()].sort((a,b)=>a[0]-b[0]).forEach(([rw, s]) => {
      rows.push([fmt(rw), fmt(s.totalLength), fmt(s.totalArea), [...s.apartments].join('; '), s.markings.join('; ')]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = (last.settings.projectName || 'linum') + '_zakaz.csv';
    link.click();
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
      apartments: collectData(),
      rows: last.rows
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
        showMessage('Сохранено в архив (' + new Date(data.dateISO).toLocaleString('ru-RU') + ').', false);
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
    } catch (err) {
      showMessage('Ошибка связи с архивом.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    el('addApartment').addEventListener('click', createApartment);
    el('calculate').addEventListener('click', calculate);
    el('saveProject').addEventListener('click', saveProject);
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
        const rollWidth = cells[5]?.textContent?.replace(' м','').trim() || '';
        const show = (!aVal || aptName === aVal) && (!rVal || roomName === rVal) && (!wVal || rollWidth === wVal);
        tr.style.display = show ? '' : 'none';
      });
    }

    loadProject();
    refreshArchiveList();
  });
})();
