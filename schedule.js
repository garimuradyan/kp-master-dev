/* График монтажей. Сейчас хранение локальное, чтобы не ломать Supabase/RPC. */
(function(){
  var scheduleJobs = [];
  var scheduleMonth = new Date();
  var scheduleSelectedDate = dateKey(new Date());
  var loadedForKey = null;

  var STATUS = {
    new:['Новая заявка','status-new'],
    planned:['Запланирован','status-planned'],
    confirmed:['Подтверждён','status-confirmed'],
    inwork:['В работе','status-inwork'],
    done:['Выполнен','status-done'],
    paid:['Оплачен','status-paid'],
    moved:['Перенесён','status-moved'],
    cancelled:['Отменён','status-cancelled']
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

  window.setScheduleToday = function(){
    var now = new Date();
    scheduleMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    scheduleSelectedDate = dateKey(now);
    renderSchedule();
  };

  window.setScheduleMonthFromInput = function(){
    var val = document.getElementById('scheduleMonthInput').value;
    if(!val) return;
    var p = val.split('-');
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
      id:'', date:scheduleSelectedDate || dateKey(new Date()), start:'10:00', end:'13:00', status:'planned',
      clientName:'', phone:'', address:'', works:'', total:'', source:'', notes:''
    });
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.style.display='flex';
  };

  window.openScheduleModalFromQuote = function(){
    if(typeof validateClient === 'function' && !validateClient()) return;
    var c = typeof getClientData === 'function' ? getClientData() : {};
    var t = typeof getTotals === 'function' ? getTotals() : {grand:0};
    var works = (window.services || []).map(function(s){return s.name + (s.qty ? ' × '+s.qty : '');}).filter(Boolean).join('\n');
    fillScheduleModal({
      id:'', date:scheduleSelectedDate || dateKey(new Date()), start:'10:00', end:'13:00', status:'planned',
      clientName:c.name||'', phone:c.phone||'', address:c.addr||'', works:works,
      total:t.grand||'', source:'КП', notes:c.notes||'',
      quoteSnapshot: makeQuoteSnapshot()
    });
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.style.display='flex';
  };

  window.closeScheduleModal = function(){
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.style.display='none';
  };

  window.saveScheduleJob = function(){
    ensureScheduleLoaded();
    var id = val('scheduleEditId');
    var job = {
      id: id || ('job_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)),
      date: val('schDate'),
      start: val('schStart') || '10:00',
      end: val('schEnd') || '',
      status: val('schStatus') || 'planned',
      clientName: val('schClient'),
      phone: val('schPhone'),
      address: val('schAddress'),
      works: val('schWorks'),
      total: parseFloat(val('schTotal')) || 0,
      source: val('schSource'),
      notes: val('schNotes'),
      updatedAt: new Date().toISOString()
    };
    if(!job.date){toast('Выберите дату','error');return;}
    if(!job.clientName){toast('Введите клиента','error');return;}
    var old = id ? scheduleJobs.find(function(x){return x.id===id;}) : null;
    if(old && old.quoteSnapshot) job.quoteSnapshot = old.quoteSnapshot;
    if(!old && window.__pendingQuoteSnapshot) job.quoteSnapshot = window.__pendingQuoteSnapshot;
    window.__pendingQuoteSnapshot = null;

    var idx = scheduleJobs.findIndex(function(x){return x.id===job.id;});
    if(idx>=0) scheduleJobs[idx]=job; else scheduleJobs.push(job);
    saveScheduleJobs();
    scheduleSelectedDate = job.date;
    var d = parseDateKey(job.date);
    scheduleMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    closeScheduleModal();
    renderSchedule();
    toast('Монтаж сохранён ✓','success');
  };

  window.deleteScheduleJobFromModal = function(){
    var id = val('scheduleEditId');
    if(!id) return;
    deleteScheduleJob(id);
    closeScheduleModal();
  };

  window.deleteScheduleJob = function(id){
    if(!confirm('Удалить монтаж из графика?')) return;
    scheduleJobs = scheduleJobs.filter(function(x){return x.id!==id;});
    saveScheduleJobs();
    renderSchedule();
    toast('Монтаж удалён','success');
  };

  window.loadScheduleQuote = function(id){
    var job = scheduleJobs.find(function(x){return x.id===id;});
    if(!job || !job.quoteSnapshot){toast('К этому монтажу не привязан снимок КП','error');return;}
    var q = job.quoteSnapshot;
    setIf('c-name',q.client && q.client.name);
    setIf('c-phone',q.client && q.client.phone);
    setIf('c-email',q.client && q.client.email);
    setIf('c-city',q.client && q.client.city);
    setIf('c-addr',q.client && q.client.addr);
    setIf('c-notes',q.client && q.client.notes);
    window.services = JSON.parse(JSON.stringify(q.services || []));
    if(q.discount){setIf('discountVal',q.discount.val||'');setIf('discountType',q.discount.type||'percent');}
    if(q.prepay !== undefined) setIf('prepayVal',q.prepay||'');
    showPage('new',null);
    jumpStep(2);
    renderServices();
    toast('КП из графика загружено ✓','success');
  };

  function fillScheduleModal(job){
    setIf('scheduleEditId',job.id||'');
    setIf('schDate',job.date||dateKey(new Date()));
    setIf('schStart',job.start||'10:00');
    setIf('schEnd',job.end||'13:00');
    setIf('schStatus',job.status||'planned');
    setIf('schClient',job.clientName||'');
    setIf('schPhone',job.phone||'');
    setIf('schAddress',job.address||'');
    setIf('schWorks',job.works||'');
    setIf('schTotal',job.total||'');
    setIf('schSource',job.source||'');
    setIf('schNotes',job.notes||'');
    var del = document.getElementById('scheduleDeleteBtn');
    if(del) del.style.display = job.id ? '' : 'none';
    window.__pendingQuoteSnapshot = job.quoteSnapshot || null;
  }

  function renderScheduleStats(){
    var el = document.getElementById('scheduleStats');
    if(!el) return;
    var ym = scheduleMonth.getFullYear()+'-'+pad2(scheduleMonth.getMonth()+1);
    var monthJobs = scheduleJobs.filter(function(j){return j.date && j.date.indexOf(ym)===0;});
    var total = monthJobs.reduce(function(s,j){return s+(parseFloat(j.total)||0);},0);
    var done = monthJobs.filter(function(j){return j.status==='done'||j.status==='paid';}).length;
    var planned = monthJobs.filter(function(j){return ['new','planned','confirmed','inwork'].indexOf(j.status)>=0;}).length;
    el.innerHTML = '<div><b>'+monthJobs.length+'</b><span>монтажей за месяц</span></div><div><b>'+planned+'</b><span>в работе/плане</span></div><div><b>'+done+'</b><span>выполнено</span></div><div><b>'+fmt(total)+'</b><span>сумма месяца</span></div>';
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
      var total = dayJobs.reduce(function(s,j){return s+(parseFloat(j.total)||0);},0);
      var classes = ['schedule-day'];
      if(key===scheduleSelectedDate) classes.push('is-selected');
      if(key===dateKey(new Date())) classes.push('is-today');
      if(dayJobs.length) classes.push('has-jobs');
      cells.push('<button class="'+classes.join(' ')+'" onclick="selectScheduleDate(\''+key+'\')"><span class="day-num">'+d+'</span>'+(dayJobs.length?'<span class="day-count">'+dayJobs.length+'</span><span class="day-money">'+shortMoney(total)+'</span>':'')+'</button>');
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
    if(!jobs.length){list.innerHTML='<div class="empty-state" style="padding:30px 10px"><div class="empty-icon">📭</div><p>На этот день монтажей нет</p><button class="btn btn-primary btn-sm" onclick="openScheduleModal()">+ Добавить</button></div>';return;}
    list.innerHTML = jobs.map(function(j){
      var st = STATUS[j.status] || STATUS.planned;
      return '<div class="schedule-job">'+
        '<div class="schedule-job-time"><b>'+esc(j.start||'—')+'</b>'+(j.end?'–'+esc(j.end):'')+'</div>'+
        '<div class="schedule-job-body"><div class="schedule-job-top"><b>'+esc(j.clientName)+'</b><span class="schedule-status '+st[1]+'">'+st[0]+'</span></div>'+
        (j.phone?'<div class="schedule-line">☎ '+esc(j.phone)+'</div>':'')+
        (j.address?'<div class="schedule-line">📍 '+esc(j.address)+'</div>':'')+
        (j.works?'<div class="schedule-works">'+esc(j.works).replace(/\n/g,'<br>')+'</div>':'')+
        '<div class="schedule-job-bottom"><span>'+(j.total?fmt(j.total):'Без суммы')+'</span>'+(j.source?'<span>'+esc(j.source)+'</span>':'')+'</div>'+
        (j.notes?'<div class="schedule-note">'+esc(j.notes)+'</div>':'')+
        '<div class="schedule-actions"><button class="btn btn-ghost btn-sm" onclick="openScheduleModal(\''+j.id+'\')">Изменить</button>'+(j.quoteSnapshot?'<button class="btn btn-ghost btn-sm" onclick="loadScheduleQuote(\''+j.id+'\')">Открыть КП</button>':'')+'<button class="btn btn-danger btn-sm" onclick="deleteScheduleJob(\''+j.id+'\')">Удалить</button></div>'+ 
        '</div></div>';
    }).join('');
  }

  function makeQuoteSnapshot(){
    var c = typeof getClientData === 'function' ? getClientData() : {};
    return {
      client:Object.assign({},c),
      services:JSON.parse(JSON.stringify(window.services || [])),
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

  function saveScheduleJobs(){
    localStorage.setItem(storageKey(), JSON.stringify(scheduleJobs));
  }

  function storageKey(){return 'kp_schedule_'+(window.currentKeyId || localStorage.getItem('kp_key_id') || 'guest');}
  function dateKey(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
  function parseDateKey(key){var p=String(key||dateKey(new Date())).split('-');return new Date(parseInt(p[0],10),parseInt(p[1],10)-1,parseInt(p[2],10));}
  function pad2(n){return String(n).padStart(2,'0');}
  function val(id){var el=document.getElementById(id);return el?el.value:'';}
  function setIf(id,v){var el=document.getElementById(id);if(el)el.value=(v==null?'':v);}
  function shortMoney(n){n=Number(n)||0;if(n>=1000000)return Math.round(n/100000)/10+'м';if(n>=1000)return Math.round(n/1000)+'к';return n?String(n):'';}
  function syncMonthInput(){var el=document.getElementById('scheduleMonthInput');if(el)el.value=scheduleMonth.getFullYear()+'-'+pad2(scheduleMonth.getMonth()+1);}

  window.addEventListener('DOMContentLoaded',function(){
    var modal = document.getElementById('scheduleModal');
    if(modal) modal.addEventListener('click',function(e){if(e.target===modal)closeScheduleModal();});
  });
})();
