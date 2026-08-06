const SPREADSHEET_ID_KEY = 'LINUM_SPREADSHEET_ID';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const spreadsheet = getOrCreateSpreadsheet_();
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH-mm-ss');

    writeSheet_(spreadsheet, 'Помещения ' + stamp,
      ['№ квартиры', 'Название квартиры', 'Тип помещения', 'Своё название', 'Маркировка', 'Длина, м', 'Ширина, м', 'Комментарий'],
      data.rooms || []);
    writeSheet_(spreadsheet, 'Расчёт ' + stamp,
      ['Маркировка', '№ квартиры', 'Название квартиры', 'Тип помещения', 'Длина, м', 'Ширина, м', 'С запасом: сторона 1, м', 'С запасом: сторона 2, м', 'Ширина рулона, м', 'Полос', 'Метраж, п.м.', 'Площадь закупки, м²', 'Остаток, м²', 'Стыков', 'Комментарий'],
      data.calculation || []);
    writeSheet_(spreadsheet, 'Заказ ' + stamp,
      ['Ширина рулона', 'Погонный метраж', 'Площадь, м²', 'Количество помещений', 'Маркировки'],
      data.summary || []);

    return json_({ ok: true, spreadsheetUrl: spreadsheet.getUrl(), stamp: stamp });
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

function writeSheet_(spreadsheet, sheetName, headers, rows) {
  const sheet = spreadsheet.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#d9eef1');
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}