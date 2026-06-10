/*
  Шаблоны документов КП Мастер.
  Когда будет готов официальный текст договора/акта — заменяем только текст внутри этих функций.
  Логика данных и печати лежит в documents.js.
*/
window.KP_DOCUMENT_TEMPLATES = {
  contract: function(ctx){
    var c = ctx.client;
    var m = ctx.master;
    var t = ctx.totals;
    var rows = ctx.services.map(function(s,i){
      return '<tr><td>'+(i+1)+'</td><td>'+ctx.esc(s.name)+'</td><td>'+ctx.fmt(s.price)+'</td><td>'+ctx.esc(s.qty)+'</td><td>'+ctx.fmt(s.price*s.qty)+'</td></tr>';
    }).join('');

    return ''+
      '<section class="doc-page">'+
      '<div class="doc-title">Договор подряда на выполнение монтажных работ № '+ctx.num+'</div>'+
      '<div class="doc-meta">г. '+ctx.esc(c.city || m.city || '__________')+' · '+ctx.today+'</div>'+
      '<p><b>Исполнитель:</b> '+ctx.esc(m.company || '____________________________')+(m.inn?' · ИНН '+ctx.esc(m.inn):'')+(m.phone?' · тел. '+ctx.esc(m.phone):'')+', именуемый далее «Исполнитель», с одной стороны, и <b>Заказчик:</b> '+ctx.esc(c.name || '____________________________')+(c.phone?' · тел. '+ctx.esc(c.phone):'')+', именуемый далее «Заказчик», с другой стороны, заключили настоящий договор о нижеследующем.</p>'+
      '<h2>1. Предмет договора</h2>'+
      '<p>Исполнитель обязуется выполнить монтажные работы по адресу: '+ctx.esc(c.addr || '____________________________')+', а Заказчик обязуется принять результат работ и оплатить его в порядке и на условиях настоящего договора.</p>'+
      '<h2>2. Перечень работ и стоимость</h2>'+
      '<table><thead><tr><th>№</th><th>Наименование</th><th>Цена</th><th>Кол.</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="doc-total"><span>Итого к оплате:</span><b>'+ctx.fmt(t.grand)+'</b></div>'+
      '<h2>3. Порядок выполнения и оплаты</h2>'+
      '<p>Срок и время выполнения работ согласуются сторонами дополнительно. Оплата производится наличным или безналичным способом по договорённости сторон.</p>'+
      (t.prepay>0?'<p>Предоплата по заказу: '+ctx.fmt(t.prepay)+'.</p>':'')+
      '<h2>4. Приёмка работ</h2>'+
      '<p>После завершения работ стороны подписывают акт выполненных монтажных работ. Подписание акта подтверждает выполнение работ Исполнителем и отсутствие претензий по объёму работ на момент приёмки.</p>'+
      (m.warranty?'<h2>5. Гарантия и условия</h2><p>'+ctx.esc(m.warranty)+'</p>':'')+
      '<h2>6. Реквизиты сторон</h2>'+
      '<div class="doc-sign-grid">'+
      '<div><b>Исполнитель</b><br>'+ctx.esc(m.company || '')+'<br>'+(m.phone?'Тел.: '+ctx.esc(m.phone)+'<br>':'')+(m.email?'Email: '+ctx.esc(m.email)+'<br>':'')+(m.inn?'ИНН: '+ctx.esc(m.inn)+'<br>':'')+(m.requisites?ctx.esc(m.requisites):'')+'<div class="sign-line">Подпись</div></div>'+
      '<div><b>Заказчик</b><br>'+ctx.esc(c.name || '')+'<br>'+(c.phone?'Тел.: '+ctx.esc(c.phone)+'<br>':'')+(c.email?'Email: '+ctx.esc(c.email)+'<br>':'')+(c.addr?'Адрес: '+ctx.esc(c.addr):'')+'<div class="sign-line">Подпись</div></div>'+
      '</div>'+
      '</section>';
  },

  act: function(ctx){
    var c = ctx.client;
    var m = ctx.master;
    var t = ctx.totals;
    var rows = ctx.services.map(function(s,i){
      return '<tr><td>'+(i+1)+'</td><td>'+ctx.esc(s.name)+'</td><td>'+ctx.fmt(s.price)+'</td><td>'+ctx.esc(s.qty)+'</td><td>'+ctx.fmt(s.price*s.qty)+'</td></tr>';
    }).join('');

    return ''+
      '<section class="doc-page">'+
      '<div class="doc-title">Акт выполненных монтажных работ № '+ctx.num+'</div>'+
      '<div class="doc-meta">'+ctx.today+'</div>'+
      '<p>Мы, нижеподписавшиеся, <b>Исполнитель</b> '+ctx.esc(m.company || '____________________________')+' и <b>Заказчик</b> '+ctx.esc(c.name || '____________________________')+', составили настоящий акт о том, что Исполнитель выполнил монтажные работы по адресу: '+ctx.esc(c.addr || '____________________________')+'.</p>'+
      '<table><thead><tr><th>№</th><th>Наименование работ</th><th>Цена</th><th>Кол.</th><th>Сумма</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="doc-total"><span>Итого по акту:</span><b>'+ctx.fmt(t.grand)+'</b></div>'+
      '<p>Работы выполнены в полном объёме. Заказчик результат работ принял. Претензий по объёму выполненных работ на момент подписания акта стороны не имеют.</p>'+
      '<div class="doc-sign-grid">'+
      '<div><b>Исполнитель</b><br>'+ctx.esc(m.company || '')+'<div class="sign-line">Подпись</div></div>'+
      '<div><b>Заказчик</b><br>'+ctx.esc(c.name || '')+'<div class="sign-line">Подпись</div></div>'+
      '</div>'+
      '</section>';
  }
};
