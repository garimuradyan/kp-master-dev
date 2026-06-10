/* График выездов. Сейчас хранение локальное, чтобы не ломать Supabase/RPC. */
(function(){
  var scheduleJobs = [];
  var scheduleMonth = new Date();
  var scheduleSelectedDate = dateKey(new Date());
  var loadedForKey = null;
  var scheduleModalItems = [];
  var scheduleModalEquipment = [];
  var scheduleModalLockedByQuote = false;

  var VISIT_TYPES = [
    {value:'inspection',label:'Осмотр'},
    {value:'first_stage',label:'Первый этап'},
    {value:'second_stage',label:'Второй этап'},
    {value:'one_stage',label:'Монтаж в один этап'},
    {value:'route',label:'Закладка трассы'},
    {value:'ready_route',label:'Монтаж на готовую трассу'},
    {value:'maintenance',label:'Тех. обслуживание (ТО)'},
    {value:'repair',label:'Ремонт'}
  ];
  var VISIT_LABELS = VISIT_TYPES.reduce(function(a,x){a[x.value]=x.label;return a;},{});
  var VISIT_STAT_LABELS = {
    inspection:'Осмотров',
    first_stage:'Первых этапов',
    second_stage:'Вторых этапов',
    one_stage:'Монтажей в один этап',
    route:'Закладок трассы',
    ready_route:'Монтажей на готовую трассу',
    maintenance:'Тех. обслуживаний (ТО)',
    repair:'Ремонтов'
  };

  window.renderSchedule = function(){
    ensureScheduleLoaded();
    syncMonthInput();
    renderScheduleStats();
    renderScheduleMonth();
    renderScheduleDay();
  };

  window.goScheduleMonth = function(delta){
    scheduleMonth = new Date(scheduleMonth.getFullYear(), scheduleMonth.getMonth()+delta, 1);
    renderSchedule();
  };

  window.openScheduleMonthPicker = function(){
    var input=document.getElementById('scheduleMonthInput');
    if(!input)return;
    if(input.showPicker) input.showPicker();
    else input.click();
  };

  window.setScheduleToday = function(){
    var now = new Date();
    scheduleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    scheduleSelectedDate = dateKey(now);
    renderSchedule();
  };

  window.setScheduleMonthFromInput = function(){
    var v = val('scheduleMonthInput');
    if(!v) return;
    var p = v.split('-');
    scheduleMonth = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, 1);
    renderSchedule();
  };

  window.selectScheduleDate = function(key){
    scheduleSelectedDate = key;
    var d = parseDateKey(key);
    scheduleMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderSchedule();
  };

  window.openScheduleModal = function(jobId){
    ensureScheduleLoaded();
    var job = jobId ? scheduleJobs.find(function(x){return x.id===jobId;}) : null;
    fillScheduleModal(job || {
      id:'', date:scheduleSelectedDate || dateKey(new Date()), start:'10:00', end:'13:00', visitType:'inspection',
      clientName:'', phone:'', address:'', items:[], equipment:[], works:'', equipmentText:'', total:'', source:'Без КП', notes:''
    });
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.style.display='flex';
  };

  window.openScheduleModalFromQuote = function(){
    if(typeof validateClient === 'function' && !validateClient()) return;
    var c = typeof getClientData === 'function' ? getClientData() : {};
    var t = typeof getTotals === 'function' ? getTotals() : {grand:0};
    var items = JSON.parse(JSON.stringify(window.services || []));
    var eq = JSON.parse(JSON.stringify(window.equipment || []));
    if(!items.length && !eq.length){toast('Добавьте работы или оборудование в КП','error');return;}
    var quoteSnapshot = makeQuoteSnapshot();
    fillScheduleModal({
      id:'', date:scheduleSelectedDate || dateKey(new Date()), start:'10:00', end:'13:00', visitType:'one_stage',
      clientName:c.name||'', phone:c.phone||'', address:c.addr||'', items:items, equipment:eq,
      works:itemsToText(items), equipmentText:itemsToText(eq),
      total:t.grand||0, source:'КП', notes:c.notes||'', quoteSnapshot: quoteSnapshot
    });
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.style.display='flex';
  };

  window.closeScheduleModal = function(){
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.style.display='none';
  };

  window.addScheduleItemFromSelect = function(){
    if(scheduleModalLockedByQuote) return;
    var sel=document.getElementById('schPriceSelect');
    if(!sel || !sel.value){toast('Выберите услугу из списка','error');return;}
    var p=(window.priceItems||[])[parseInt(sel.value,10)];
    if(!p){toast('Услуга не найдена','error');return;}
    scheduleModalItems.push({name:p.name||'',price:parseFloat(p.price)||0,qty:1,unit:p.unit||'шт'});
    renderScheduleEditors();
  };

  window.addScheduleEquipmentFromSelect = function(){
    if(scheduleModalLockedByQuote) return;
    var sel=document.getElementById('schEquipmentSelect');
    if(!sel || !sel.value){toast('Выберите оборудование из списка','error');return;}
    var p=(window.equipmentItems||[])[parseInt(sel.value,10)];
    if(!p){toast('Оборудование не найдено','error');return;}
    scheduleModalEquipment.push({name:p.name||'',price:parseFloat(p.price)||0,qty:1,unit:p.unit||'шт'});
    renderScheduleEditors();
  };

  window.changeScheduleItemQty = function(i,v){
    if(scheduleModalLockedByQuote || !scheduleModalItems[i]) return;
    scheduleModalItems[i].qty = Math.max(1,parseFloat(v)||1);
    renderScheduleEditors();
  };

  window.changeScheduleEquipmentQty = function(i,v){
    if(scheduleModalLockedByQuote || !scheduleModalEquipment[i]) return;
    scheduleModalEquipment[i].qty = Math.max(1,parseFloat(v)||1);
    renderScheduleEditors();
  };

  window.removeScheduleItem = function(i){
    if(scheduleModalLockedByQuote) return;
    scheduleModalItems.splice(i,1);
    renderScheduleEditors();
  };

  window.removeScheduleEquipment = function(i){
    if(scheduleModalLockedByQuote) return;
    scheduleModalEquipment.splice(i,1);
    renderScheduleEditors();
  };

  window.saveScheduleJob = function(){
    ensureScheduleLoaded();
    var id = val('scheduleEditId');
    var old = id ? scheduleJobs.find(function(x){return x.id===id;}) : null;
    var quoteSnapshot = (old && old.quoteSnapshot) || window.__pendingQuoteSnapshot || null;
    var lockedByQuote = !!quoteSnapshot;
    var items = lockedByQuote ? normalizeWorksFromQuoteSnapshot(quoteSnapshot) : JSON.parse(JSON.stringify(scheduleModalItems || []));
    var eq = lockedByQuote ? normalizeEquipmentFromQuoteSnapshot(quoteSnapshot) : JSON.parse(JSON.stringify(scheduleModalEquipment || []));
    var total = lockedByQuote ? quoteTotal(quoteSnapshot) : (calcItemsTotal(items)+calcItemsTotal(eq));
    var source = lockedByQuote ? 'КП' : 'Без КП';

    var job = {
      id: id || ('job_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)),
      date: val('schDate'),
      start: val('schStart') || '10:00',
      end: val('schEnd') || '',
      visitType: val('schVisitType') || 'inspection',
      clientName: val('schClient'),
      phone: val('schPhone'),
      address: val('schAddress'),
      items: items,
      equipment: eq,
      works: itemsToText(items),
      equipmentText: itemsToText(eq),
      total: total,
      source: source,
      notes: val('schNotes'),
      updatedAt: new Date().toISOString()
    };
    if(quoteSnapshot) job.quoteSnapshot = quoteSnapshot;
    window.__pendingQuoteSnapshot = null;

    if(!job.date){toast('Выберите дату','error');return;}
    if(!job.clientName){toast('Введите данные клиента','error');return;}
    if(!items.length && !eq.length){toast('Добавьте работы или оборудование','error');return;}

    var idx = scheduleJobs.findIndex(function(x){return x.id===job.id;});
    if(idx>=0) scheduleJobs[idx]=job; else scheduleJobs.push(job);
    saveScheduleJobs();
    scheduleSelectedDate = job.date;
    var d = parseDateKey(job.date);
    scheduleMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    closeScheduleModal();
    renderSchedule();
    toast('Выезд сохранён ✓','success');
  };

  window.deleteScheduleJobFromModal = function(){
    var id = val('scheduleEditId');
    if(!id) return;
    deleteScheduleJob(id);
    closeScheduleModal();
  };

  window.deleteScheduleJob = function(id){
    if(!confirm('Удалить выезд из графика?')) return;
    scheduleJobs = scheduleJobs.filter(function(x){return x.id!==id;});
    saveScheduleJobs();
    renderSchedule();
    toast('Выезд удалён','success');
  };

  window.loadScheduleQuote = function(id){
    var job = scheduleJobs.find(function(x){return x.id===id;});
    if(!job || !job.quoteSnapshot){toast('К этому выезду не привязано КП','error');return;}
    var q = job.quoteSnapshot;
    setIf('c-name',q.client && q.client.name);
    setIf('c-phone',q.client && q.client.phone);
    setIf('c-email',q.client && q.client.email);
    setIf('c-city',q.client && q.client.city);
    setIf('c-addr',q.client && q.client.addr);
    setIf('c-notes',q.client && q.client.notes);
    window.services = JSON.parse(JSON.stringify(q.services || []));
    window.equipment = JSON.parse(JSON.stringify(q.equipment || []));
    if(q.discount){setIf('discountVal',q.discount.val||'');setIf('discountType',q.discount.type||'percent');}
    if(q.prepay !== undefined) setIf('prepayVal',q.prepay||'');
    showPage('new',null);
    jumpStep(2);
    if(typeof renderEquipment==='function')renderEquipment();
    renderServices();
    toast('КП из графика загружено ✓','success');
  };

  function fillScheduleModal(job){
    var quoteSnapshot = job.quoteSnapshot || null;
    scheduleModalLockedByQuote = !!quoteSnapshot || job.source==='КП';
    scheduleModalItems = scheduleModalLockedByQuote
      ? (quoteSnapshot ? normalizeWorksFromQuoteSnapshot(quoteSnapshot) : normalizeItemsFromJob(job))
      : normalizeItemsFromJob(job);
    scheduleModalEquipment = scheduleModalLockedByQuote
      ? (quoteSnapshot ? normalizeEquipmentFromQuoteSnapshot(quoteSnapshot) : normalizeEquipmentFromJob(job))
      : normalizeEquipmentFromJob(job);

    setIf('scheduleEditId',job.id||'');
    setIf('schDate',job.date||dateKey(new Date()));
    setIf('schStart',job.start||'10:00');
    setIf('schEnd',job.end||'13:00');
    setIf('schVisitType',job.visitType||visitTypeFromLegacy(job.status));
    setIf('schClient',job.clientName||'');
    setIf('schPhone',job.phone||'');
    setIf('schAddress',job.address||'');
    setIf('schWorks',itemsToText(scheduleModalItems));
    setIf('schEquipment',itemsToText(scheduleModalEquipment));
    setIf('schTotal',scheduleModalLockedByQuote && quoteSnapshot ? quoteTotal(quoteSnapshot) : (job.total || calcItemsTotal(scheduleModalItems)+calcItemsTotal(scheduleModalEquipment) || ''));
    setIf('schSource',scheduleModalLockedByQuote ? 'КП' : 'Без КП');
    setIf('schSourceView',scheduleModalLockedByQuote ? 'КП' : 'Без КП');
    setIf('schNotes',job.notes||'');
    var del = document.getElementById('scheduleDeleteBtn');
    if(del) del.style.display = job.id ? '' : 'none';
    window.__pendingQuoteSnapshot = quoteSnapshot;
    renderPriceSelect();
    renderEquipmentSelect();
    setScheduleQuoteLock(scheduleModalLockedByQuote);
    renderScheduleEditors();
  }

  function setScheduleQuoteLock(locked){
    ['schClient','schPhone','schAddress'].forEach(function(id){var el=document.getElementById(id);if(el)el.readOnly=locked;});
    var picker=document.getElementById('schPricePicker');
    if(picker)picker.style.display=locked?'none':'flex';
    var eqPicker=document.getElementById('schEquipmentPicker');
    if(eqPicker)eqPicker.style.display=locked?'none':'flex';
    var note=document.getElementById('schQuoteLockNote');
    if(note)note.style.display=locked?'':'none';
  }

  function renderPriceSelect(){
    var sel=document.getElementById('schPriceSelect');
    if(!sel)return;
    var items=window.priceItems||[];
    if(!items.length){sel.innerHTML='<option value="">Прайс-лист работ пуст</option>';return;}
    sel.innerHTML=items.map(function(p,i){return '<option value="'+i+'">'+esc(p.name)+' — '+fmt(parseFloat(p.price)||0)+'</option>';}).join('');
  }

  function renderEquipmentSelect(){
    var sel=document.getElementById('schEquipmentSelect');
    if(!sel)return;
    var items=window.equipmentItems||[];
    if(!items.length){sel.innerHTML='<option value="">Список оборудования пуст</option>';return;}
    sel.innerHTML=items.map(function(p,i){return '<option value="'+i+'">'+esc(p.name)+' — '+fmt(parseFloat(p.price)||0)+'</option>';}).join('');
  }

  function renderScheduleEditors(){
    renderScheduleBlock('schEquipmentList', scheduleModalEquipment, 'Оборудование не выбрано', 'changeScheduleEquipmentQty', 'removeScheduleEquipment');
    renderScheduleBlock('schItemsList', scheduleModalItems, 'Работы не выбраны', 'changeScheduleItemQty', 'removeScheduleItem');
    setIf('schWorks',itemsToText(scheduleModalItems));
    setIf('schEquipment',itemsToText(scheduleModalEquipment));
    setIf('schTotal',scheduleModalLockedByQuote && window.__pendingQuoteSnapshot ? quoteTotal(window.__pendingQuoteSnapshot) : calcItemsTotal(scheduleModalItems)+calcItemsTotal(scheduleModalEquipment));
  }

  function renderScheduleBlock(listId, arr, emptyText, qtyFn, removeFn){
    var list=document.getElementById(listId);
    if(!list)return;
    if(!arr.length){
      list.innerHTML='<div class="schedule-items-empty">'+emptyText+'</div>';
      return;
    }
    list.innerHTML=arr.map(function(it,i){
      return '<div class="schedule-item-row">'+
        '<div class="schedule-item-name">'+esc(it.name)+'</div>'+ 
        '<div class="schedule-item-price">'+fmt(it.price||0)+'</div>'+ 
        '<input type="number" min="1" value="'+esc(it.qty||1)+'" '+(scheduleModalLockedByQuote?'readonly':'oninput="'+qtyFn+'('+i+',this.value)"')+'>'+ 
        '<div class="schedule-item-total">'+fmt((parseFloat(it.price)||0)*(parseFloat(it.qty)||1))+'</div>'+ 
        (scheduleModalLockedByQuote?'':'<button class="delete-btn" onclick="'+removeFn+'('+i+')">✕</button>')+
      '</div>';
    }).join('');
  }

  function renderScheduleStats(){
    var el = document.getElementById('scheduleStats');
    if(!el) return;
    var ym = scheduleMonth.getFullYear()+'-'+pad2(scheduleMonth.getMonth()+1);
    var monthJobs = scheduleJobs.filter(function(j){return j.date && j.date.indexOf(ym)===0;});
    var counts = VISIT_TYPES.reduce(function(acc,type){acc[type.value]=0;return acc;},{});
    monthJobs.forEach(function(j){
      var type = j.visitType || visitTypeFromLegacy(j.status);
      if(counts[type] === undefined) counts[type] = 0;
      counts[type] += 1;
    });
    el.innerHTML = VISIT_TYPES.map(function(type){
      var label = VISIT_STAT_LABELS[type.value] || type.label;
      return '<div class="schedule-stat-chip"><span class="schedule-stat-name">'+esc(label)+'</span><b class="schedule-stat-count">'+counts[type.value]+'</b></div>';
    }).join('');
  }

  function renderScheduleMonth(){
    var grid = document.getElementById('scheduleMonthGrid');
    if(!grid) return;
    var y = scheduleMonth.getFullYear(), m = scheduleMonth.getMonth();
    var first = new Date(y,m,1);
    var last = new Date(y,m+1,0);
    var startShift = (first.getDay()+6)%7;
    var cells = [];
    for(var i=0;i<startShift;i++) cells.push('<button class="schedule-day is-empty" disabled></button>');
    for(var d=1; d<=last.getDate(); d++){
      var dt = new Date(y,m,d);
      var key = dateKey(dt);
      var dayJobs = scheduleJobs.filter(function(j){return j.date===key;});
      var classes = ['schedule-day'];
      if(key===scheduleSelectedDate) classes.push('is-selected');
      if(key===dateKey(new Date())) classes.push('is-today');
      if(dayJobs.length) classes.push('has-jobs');
      cells.push('<button class="'+classes.join(' ')+'" onclick="selectScheduleDate(\''+key+'\')" aria-label="'+d+' '+scheduleMonth.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})+(dayJobs.length?'. Выездов: '+dayJobs.length:'')+'"><span class="day-num">'+d+'</span>'+(dayJobs.length?'<span class="day-count" title="Выездов: '+dayJobs.length+'">'+dayJobs.length+'</span>':'')+'</button>');
    }
    grid.innerHTML = cells.join('');
  }

  function renderScheduleDay(){
    var title = document.getElementById('scheduleDayTitle');
    var list = document.getElementById('scheduleDayList');
    if(!list) return;
    var date = parseDateKey(scheduleSelectedDate);
    if(title) title.innerHTML = '<span class="icon">🧰</span> '+date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'long'});
    var jobs = scheduleJobs.filter(function(j){return j.date===scheduleSelectedDate;}).sort(function(a,b){return (a.start||'').localeCompare(b.start||'');});
    if(!jobs.length){list.innerHTML='<div class="empty-state" style="padding:30px 10px"><div class="empty-icon">📭</div><p>На этот день выездов нет</p><button class="btn btn-primary btn-sm" onclick="openScheduleModal()">+ Добавить</button></div>';return;}
    list.innerHTML = jobs.map(function(j){
      var typeLabel = VISIT_LABELS[j.visitType] || VISIT_LABELS[visitTypeFromLegacy(j.status)] || 'Выезд';
      var works = j.works || itemsToText(normalizeItemsFromJob(j));
      var eqText = j.equipmentText || itemsToText(normalizeEquipmentFromJob(j));
      return '<div class="schedule-job">'+
        '<div class="schedule-job-time"><b>'+esc(j.start||'—')+'</b>'+(j.end?'–'+esc(j.end):'')+'</div>'+ 
        '<div class="schedule-job-body"><div class="schedule-job-top"><b>'+esc(j.clientName)+'</b><span class="schedule-status visit-type-badge">'+esc(typeLabel)+'</span></div>'+ 
        (j.phone?'<div class="schedule-line">☎ '+esc(j.phone)+'</div>':'')+
        (j.address?'<div class="schedule-line">📍 '+esc(j.address)+'</div>':'')+
        (eqText?'<div class="schedule-works schedule-equipment-view"><b>Оборудование</b><br>'+esc(eqText).replace(/\n/g,'<br>')+'</div>':'')+
        (works?'<div class="schedule-works schedule-services-view"><b>Работы</b><br>'+esc(works).replace(/\n/g,'<br>')+'</div>':'')+
        '<div class="schedule-job-bottom"><span>'+(j.total?fmt(j.total):'Без суммы')+'</span>'+(j.source?'<span>'+esc(j.source)+'</span>':'')+'</div>'+ 
        (j.notes?'<div class="schedule-note">'+esc(j.notes)+'</div>':'')+
        '<div class="schedule-actions"><button class="btn btn-ghost btn-sm" onclick="openScheduleModal(\''+j.id+'\')">Изменить</button>'+(j.quoteSnapshot?'<button class="btn btn-ghost btn-sm" onclick="loadScheduleQuote(\''+j.id+'\')">Открыть КП</button>':'')+'<button class="btn btn-danger btn-sm" onclick="deleteScheduleJob(\''+j.id+'\')">Удалить</button></div>'+ 
        '</div></div>';
    }).join('');
  }

  function makeQuoteSnapshot(){
    var c = typeof getClientData === 'function' ? getClientData() : {};
    var totals = typeof getTotals === 'function' ? getTotals() : {grand:0};
    return {
      client:Object.assign({},c),
      services:JSON.parse(JSON.stringify(window.services || [])),
      equipment:JSON.parse(JSON.stringify(window.equipment || [])),
      totals:Object.assign({},totals),
      discount:{val:parseFloat(val('discountVal'))||0,type:val('discountType')||'percent'},
      prepay:parseFloat(val('prepayVal'))||0,
      createdAt:new Date().toISOString()
    };
  }

  function ensureScheduleLoaded(){
    var key = storageKey();
    if(loadedForKey===key) return;
    loadedForKey = key;
    try{scheduleJobs = JSON.parse(localStorage.getItem(key)||'[]') || [];}
    catch(e){scheduleJobs=[];}
  }

  function saveScheduleJobs(){localStorage.setItem(storageKey(), JSON.stringify(scheduleJobs));}
  function storageKey(){return 'kp_schedule_'+(window.currentKeyId || localStorage.getItem('kp_key_id') || 'guest');}
  function normalizeWorksFromQuoteSnapshot(q){return JSON.parse(JSON.stringify((q && q.services) || []));}
  function normalizeEquipmentFromQuoteSnapshot(q){return JSON.parse(JSON.stringify((q && q.equipment) || []));}
  function quoteTotal(q){return (q && q.totals && parseFloat(q.totals.grand)) || (calcItemsTotal(normalizeWorksFromQuoteSnapshot(q))+calcItemsTotal(normalizeEquipmentFromQuoteSnapshot(q)));}
  function normalizeItemsFromJob(job){
    if(job && Array.isArray(job.items) && job.items.length) return JSON.parse(JSON.stringify(job.items));
    if(job && job.quoteSnapshot) return normalizeWorksFromQuoteSnapshot(job.quoteSnapshot);
    if(job && job.works){return textToItems(job.works);}
    return [];
  }
  function normalizeEquipmentFromJob(job){
    if(job && Array.isArray(job.equipment) && job.equipment.length) return JSON.parse(JSON.stringify(job.equipment));
    if(job && job.quoteSnapshot) return normalizeEquipmentFromQuoteSnapshot(job.quoteSnapshot);
    if(job && job.equipmentText){return textToItems(job.equipmentText);}
    return [];
  }
  function textToItems(text){return String(text||'').split('\n').filter(Boolean).map(function(name){return {name:name.replace(/ × .*$/,''),price:0,qty:1,unit:'шт'};});}
  function itemsToText(items){return (items||[]).map(function(s){return (s.name||'') + (s.qty ? ' × '+s.qty : '');}).filter(Boolean).join('\n');}
  function calcItemsTotal(items){return (items||[]).reduce(function(sum,s){return sum+(parseFloat(s.price)||0)*(parseFloat(s.qty)||1);},0);}
  function visitTypeFromLegacy(status){return 'one_stage';}
  function dateKey(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
  function parseDateKey(key){var p=String(key||dateKey(new Date())).split('-');return new Date(parseInt(p[0],10),parseInt(p[1],10)-1,parseInt(p[2],10));}
  function pad2(n){return String(n).padStart(2,'0');}
  function val(id){var el=document.getElementById(id);return el?el.value:'';}
  function setIf(id,v){var el=document.getElementById(id);if(el)el.value=(v==null?'':v);}
  function syncMonthInput(){
    var v=scheduleMonth.getFullYear()+'-'+pad2(scheduleMonth.getMonth()+1);
    var el=document.getElementById('scheduleMonthInput');if(el)el.value=v;
    var lbl=document.getElementById('scheduleMonthLabel');if(lbl)lbl.textContent=scheduleMonth.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(/^./,function(ch){return ch.toUpperCase();});
  }

  window.addEventListener('DOMContentLoaded',function(){
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.addEventListener('click',function(e){if(e.target===modal)closeScheduleModal();});
  });
})();
