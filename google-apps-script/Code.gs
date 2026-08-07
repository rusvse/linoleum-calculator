/**
 * Linum — архив расчётов линолеума в Google таблице.
 *
 * Результаты, Карта раскроя, Куски по квартирам, Сводка для заказа перезаписываются каждый экспорт.
 * Архив и История позиционно дополняются.
 */

var SHEET_ARCHIVE = 'Архив';
var SHEET_HISTORY = 'История';
var SHEET_RESULTS = 'Результаты';
var SHEET_CUTTING = 'Карта раскроя';
var SHEET_PIECES = 'Куски по квартирам';
var SHEET_SUMMARY = 'Сводка для заказа';

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clearAndWrite_(name, headers, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clear();
  }
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  if (rows && rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var id = payload.id || Utilities.getUuid();
    var dateISO = payload.dateISO || new Date().toISOString();

    var archiveSheet = getOrCreateSheet_(SHEET_ARCHIVE, ['ID', 'Дата', 'Название проекта', 'Материал', 'JSON']);
    archiveSheet.appendRow([
      id,
      dateISO,
      (payload.settings && payload.settings.projectName) || '',
      (payload.settings && payload.settings.material) || '',
      JSON.stringify({ settings: payload.settings, apartments: payload.apartments })
    ]);

    var historySheet = getOrCreateSheet_(SHEET_HISTORY, ['ID', 'Дата', 'Квартира', 'Помещение', 'Размер', 'Ширина рулона', 'Метраж', 'Площадь', 'Остаток', 'Стыков', 'Комментарий']);
    var rows = payload.rows || [];
    rows.forEach(function(r) {
      historySheet.appendRow([
        id, dateISO, r.apartment, r.room, r.size, r.rollWidth, r.length, r.area, r.waste, r.seams, r.comment || ''
      ]);
    });

    var resultsRows = payload.resultsRows || [];
    clearAndWrite_(SHEET_RESULTS, [
      'Маркировка', 'Квартира', 'Помещение', 'Размер', 'С запасом',
      'Рулон', 'Полос', 'Метраж', 'Площадь', 'Остаток', 'Стыков', 'Комментарий'
    ], resultsRows);

    var cuttingRaw = payload.cuttingRows || [];
    cuttingRaw.sort(function (a, b) {
      if (a.rollWidthNum !== b.rollWidthNum) return a.rollWidthNum - b.rollWidthNum;
      return String(a.marking).localeCompare(String(b.marking));
    });
    var cuttingRows = cuttingRaw.map(function (r) {
      return [r.marking, r.apartment, r.rollWidthText, r.cutLengthText];
    });
    clearAndWrite_(SHEET_CUTTING, ['Маркировка', 'Квартира', 'Ширина рулона', 'Длина отреза'], cuttingRows);

    var piecesRows = payload.apartmentPiecesRows || [];
    clearAndWrite_(SHEET_PIECES, ['Квартира', 'Кол-во кусков', 'Диапазон маркировки'], piecesRows);

    var summaryRows = payload.summaryRows || [];
    clearAndWrite_(SHEET_SUMMARY, ['Ширина рулона', 'Погонный метраж', 'Площадь', 'Помещений', 'Маркировки'], summaryRows);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, id: id, dateISO: dateISO }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action || 'list';
    var archiveSheet = getOrCreateSheet_(SHEET_ARCHIVE, ['ID', 'Дата', 'Название проекта', 'Материал', 'JSON']);
    var data = archiveSheet.getDataRange().getValues();
    data.shift();

    if (action === 'list') {
      var list = data.map(function(row) {
        return { id: row[0], dateISO: row[1], projectName: row[2], material: row[3] };
      }).sort(function(a, b) { return new Date(b.dateISO) - new Date(a.dateISO); });
      return ContentService.createTextOutput(JSON.stringify({ ok: true, items: list }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'load') {
      var id = e.parameter.id;
      var found = data.find(function(row) { return String(row[0]) === String(id); });
      if (!found) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'not_found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var parsed = JSON.parse(found[4]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, id: found[0], dateISO: found[1], settings: parsed.settings, apartments: parsed.apartments }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
