const SPREADSHEET_ID_KEY = 'LINUM_SPREADSHEET_ID';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const spreadsheet = getOrCreateSpreadsheet_();
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH-mm-ss');
    const sheet = spreadsheet.insertSheet(stamp);
    writeCalculation_(sheet, data, stamp);
    return json_({ ok: true, spreadsheetUrl: spreadsheet.getUrl(), sheetName: stamp });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function getOrCreateSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(SPREADSHEET_ID_KEY);
  if (savedId) {
    try { return SpreadsheetApp.openById(savedId); } catch (error) { properties.deleteProperty(SPREADSHEET_ID_KEY); }
  }
  const spreadsheet = SpreadsheetApp.create('Расчёты линолеума');
  properties.setProperty(SPREADSHEET_ID_KEY, spreadsheet.getId());
  return spreadsheet;
}

function writeCalculation_(sheet, data, stamp) {
  sheet.getRange('A1').setValue('РАСЧЁТ ЛИНОЛЕУМА').setFontSize(16).setFontWeight('bold');
  sheet.getRange('A2').setValue('Дата и время расчёта');
  sheet.getRange('B2').setValue(stamp);
  sheet.getRange('A3').setValue('Проект');
  sheet.getRange('B3').setValue(data.project || 'Без названия');
  sheet.getRange('A4').setValue('Материал / артикул');
  sheet.getRange('B4').setValue(data.material || '—');

  let row = 6;
  row = writeBlock_(sheet, row, 'ПОМЕЩЕНИЯ', ['№ квартиры', 'Название квартиры', 'Тип помещения', 'Своё название', 'Маркировка', 'Длина, м', 'Ширина, м', 'Комментарий'], data.rooms || []);
  row += 2;
  row = writeBlock_(sheet, row, 'РАСЧЁТ', ['Маркировка', '№ квартиры', 'Название квартиры', 'Тип помещения', 'Длина, м', 'Ширина, м', 'С запасом: сторона 1, м', 'С запасом: сторона 2, м', 'Ширина рулона, м', 'Полос', 'Метраж, п.м.', 'Площадь закупки, м²', 'Остаток, м²', 'Стыков', 'Комментарий'], data.calculation || []);
  row += 2;
  writeBlock_(sheet, row, 'СВОДКА ЗАКАЗА', ['Ширина рулона', 'Погонный метраж', 'Площадь, м²', 'Количество помещений', 'Маркировки'], data.summary || []);
  sheet.setFrozenRows(6);
  sheet.autoResizeColumns(1, 15);
}

function writeBlock_(sheet, startRow, title, headers, rows) {
  sheet.getRange(startRow, 1).setValue(title).setFontWeight('bold').setBackground('#0b7886').setFontColor('#ffffff');
  sheet.getRange(startRow + 1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#d9eef1');
  if (rows.length) sheet.getRange(startRow + 2, 1, rows.length, headers.length).setValues(rows);
  return startRow + 1 + Math.max(rows.length, 1);
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
