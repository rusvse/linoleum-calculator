function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const title = 'Расчёт линолеума ' + (data.project || 'Без названия') + ' ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
    const ss = SpreadsheetApp.create(title);
    writeSheet_(ss.getActiveSheet(), 'Помещения', ['№ квартиры','Название квартиры','Тип помещения','Своё название','Маркировка','Длина, м','Ширина, м','Комментарий'], data.rooms || []);
    writeSheet_(ss.insertSheet(), 'Расчёт', ['Маркировка','№ квартиры','Название квартиры','Тип помещения','Длина, м','Ширина, м','С запасом: сторона 1, м','С запасом: сторона 2, м','Ширина рулона, м','Полос','Метраж, п.м.','Площадь закупки, м²','Остаток, м²','Стыков','Комментарий'], data.calculation || []);
    writeSheet_(ss.insertSheet(), 'Заказ', ['Ширина рулона','Погонный метраж','Площадь','Помещений','Маркировки'], data.summary || []);
    return ContentService.createTextOutput(JSON.stringify({ok:true,url:ss.getUrl()})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(error)})).setMimeType(ContentService.MimeType.JSON);
  }
}
function writeSheet_(sheet, name, headers, rows) {
  sheet.setName(name);
  sheet.clear();
  sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#d9eef1');
  if (rows.length) sheet.getRange(2,1,rows.length,headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1,headers.length);
}