
var SURL='https://otrghpobpaftixuaknvt.supabase.co';
var SKEY='sb_publishable_gwb8J6z0aGUBOWYgXvzeeQ_xZvBrVj-';
var sb=null;
try{
  if(window.supabase&&window.supabase.createClient){sb=window.supabase.createClient(SURL,SKEY);}
}catch(e){console.error('Supabase init error',e);}
var currentKeyId=null,currentKeyData=null;
var services=[],equipment=[],priceItems=[],equipmentItems=[],settings={},historyData=[],logoDataURL=null,quotePhotos=[];
var MAX_KP=15,MAX_PHOTOS=6,MAX_PHOTO_MB=5;
var ALLOWED_TYPES=['image/jpeg','image/jpg','image/png','image/webp'];

function getStoredKey(){return localStorage.getItem('kp_access_key')||'';}
function rpcAuthParams(){return{p_key_id:currentKeyId,p_key:getStoredKey(),p_device_id:getDeviceId()};}
function rpcFailed(res){return res&&res.data&&res.data.ok===false;}
function rpcMsg(res,def){return(res&&res.data&&res.data.message)||def||'Ошибка';}


function daysLeft(exp){if(!exp)return 0;return Math.max(0,Math.ceil((new Date(exp)-new Date())/(864e5)));}

function getDeviceId(){
  var id=localStorage.getItem('kp_device_id');
  if(!id){id='dev_'+Math.random().toString(36).substr(2,9)+'_'+Date.now().toString(36);localStorage.setItem('kp_device_id',id);}
  return id;
}

window.addEventListener('DOMContentLoaded',function(){
  try{
    var sk=localStorage.getItem('kp_access_key'),sid=localStorage.getItem('kp_key_id');
    if(sk&&sid) verifyKey(sk,parseInt(sid,10),true);
    var keyInput=document.getElementById('keyInput');
    if(keyInput) keyInput.addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
    var priceModal=document.getElementById('priceModal');
    if(priceModal) priceModal.addEventListener('click',function(e){if(e.target===this)closeModal();});
    var photoUrlInput=document.getElementById('photoUrlInput');
    if(photoUrlInput) photoUrlInput.addEventListener('keydown',function(e){if(e.key==='Enter')loadPhotoFromUrl();});
    if(typeof setupSignaturePad==='function') setupSignaturePad();
    var contractBody=document.getElementById('s-contract-body');
    if(contractBody && window.KP_DEFAULT_CONTRACT_BODY) contractBody.value=window.KP_DEFAULT_CONTRACT_BODY;
  }catch(e){
    console.error('Init error',e);
    setAuthMsg('Ошибка загрузки приложения. Обновите страницу.');
  }
});

async function doLogin(){
  try{
    var input=document.getElementById('keyInput');
    var key=(input?input.value:'').trim().toUpperCase();
    if(!key){setAuthMsg('Введите ключ доступа');return;}
    if(!sb){setAuthMsg('Ошибка соединения. Обновите страницу и попробуйте снова.');return;}
    setAuthMsg('Проверяю...','var(--text2)');
    var res=await sb.rpc('kp_login',{p_key:key,p_device_id:getDeviceId()});
    if(res.error||rpcFailed(res)){setAuthMsg(rpcMsg(res,'Ключ не найден'));return;}
    var data=res.data&&res.data.key_data;
    if(!data||!data.id){setAuthMsg('Ошибка входа. Данные ключа не получены.');return;}
    localStorage.setItem('kp_access_key',key);
    localStorage.setItem('kp_key_id',data.id);
    currentKeyId=data.id;currentKeyData=data;
    showApp();
  }catch(e){
    console.error('Login error',e);
    setAuthMsg('Ошибка входа. Попробуйте обновить страницу.');
  }
}

async function verifyKey(key,keyId,silent){
  if(!sb){if(!silent)setAuthMsg('Ошибка соединения. Обновите страницу.');return;}
  var res;
  try{res=await sb.rpc('kp_verify',{p_key:key,p_key_id:keyId,p_device_id:getDeviceId()});}
  catch(e){console.error('Verify error',e);if(!silent)setAuthMsg('Ошибка проверки ключа');return;}
  if(res.error||rpcFailed(res)){
    // Не удаляем ключ из localStorage - просто показываем экран входа
    document.getElementById('authWrap').style.display='flex';
    document.getElementById('appWrap').style.display='none';
    if(!silent){setAuthMsg(rpcMsg(res,'Ошибка входа'));}
    return;
  }
  var data=res.data.key_data;
  currentKeyId=data.id;currentKeyData=data;
  showApp();
}

function setAuthMsg(msg,color){
  var el=document.getElementById('authMsg');
  el.textContent=msg;el.style.color=color||'var(--danger)';
}

function doLogout(){
  if(demoTimer){clearInterval(demoTimer);demoTimer=null;}
  localStorage.removeItem('kp_access_key');localStorage.removeItem('kp_key_id');
  currentKeyId=null;currentKeyData=null;
  services=[];equipment=[];priceItems=[];equipmentItems=[];settings={};historyData=[];logoDataURL=null;quotePhotos=[];
  document.getElementById('authWrap').style.display='flex';
  document.getElementById('appWrap').style.display='none';
  document.getElementById('keyInput').value='';
  setAuthMsg('');
}

var demoTimer = null;

function showApp(){
  document.getElementById('authWrap').style.display='none';
  document.getElementById('appWrap').style.display='block';
  if(currentKeyData){
    document.getElementById('masterName').textContent=currentKeyData.master_name||'';
    if(!currentKeyData.is_admin){
      var dl=daysLeft(currentKeyData.expires_at);
      var dc=document.getElementById('daysCounter');
      if(dc){dc.style.display='';dc.textContent=dl+' дн.';dc.style.color=dl<=3?'var(--danger)':'var(--success)';}
    }
    if(currentKeyData.is_admin){
      document.getElementById('bnav-admin').style.display='';
    }
  }
  loadUserData();
}

async function loadUserData(){
  if(!currentKeyId)return;
  var res=await sb.rpc('kp_get_user_data',rpcAuthParams());
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка загрузки данных'),'error');return;}
  settings=res.data.settings||{};applySettings();
  priceItems=res.data.price_items||defaultPrices();
  equipmentItems=(settings&&Array.isArray(settings.equipmentItems))?settings.equipmentItems:defaultEquipmentItems();
  renderPriceList();
  renderEquipmentList();
  historyData=res.data.quotes||[];
  updateHistoryBadge();
}

function applySettings(){
  if(settings.company)document.getElementById('s-company').value=settings.company;
  if(settings.phone)document.getElementById('s-phone').value=settings.phone;
  if(settings.email)document.getElementById('s-email').value=settings.email;
  if(settings.city)document.getElementById('s-city').value=settings.city;
  if(settings.inn)document.getElementById('s-inn').value=settings.inn;
  if(settings.requisites)document.getElementById('s-requisites').value=settings.requisites;
  if(settings.warranty)document.getElementById('s-warranty').value=settings.warranty;
  if(settings.color){document.getElementById('s-color').value=settings.color;document.getElementById('colorHex').textContent=settings.color;}
  if(settings.signature)document.getElementById('s-signature').value=settings.signature;
  if(document.getElementById('s-contract-body')) document.getElementById('s-contract-body').value = settings.contractBody || window.KP_DEFAULT_CONTRACT_BODY || '';
  if(settings.signatureImage) drawSavedSignature(settings.signatureImage);
  if(settings.logo){logoDataURL=settings.logo;document.getElementById('logoPreviewWrap').innerHTML='<img src="'+logoDataURL+'" class="logo-preview">';}
}

// NAV
function showPage(name,el){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.bottom-nav-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+name).classList.add('active');
  var bnav=document.getElementById('bnav-'+name);
  if(bnav)bnav.classList.add('active');
  if(name==='history')renderHistory();
  if(name==='schedule'&&typeof renderSchedule==='function')renderSchedule();
  if(name==='settings'){renderPriceList();renderEquipmentList();setTimeout(resizeSignatureCanvas,50);}
  if(name==='admin')loadAdminData();
  window.scrollTo({top:0,behavior:'smooth'});
}

function nextStep(n){
  if(n===2&&!validateClient())return;
  if(n===3)buildPreview();
  jumpStep(n);
}

function jumpStep(n){
  if(n===2){if(typeof renderEquipment==='function')renderEquipment();if(typeof renderServices==='function')renderServices();}
  document.getElementById('section-client').style.display=n===1?'':'none';
  document.getElementById('section-services').style.display=n===2?'':'none';
  document.getElementById('section-preview').style.display=n===3?'':'none';
  [1,2,3].forEach(function(i){
    var el=document.getElementById('step'+i);
    el.classList.remove('active','done');
    if(i<n)el.classList.add('done');
    if(i===n)el.classList.add('active');
  });
  window.scrollTo({top:0,behavior:'smooth'});
}

function validateClient(){
  if(!document.getElementById('c-name').value.trim()){toast('Введите ФИО клиента','error');return false;}
  if(!document.getElementById('c-phone').value.trim()){toast('Введите телефон','error');return false;}
  return true;
}

// SERVICES
function addServiceRow(name,price,qty){services.push({name:name||'',price:price||0,qty:qty||1});renderServices();}
function addEquipmentRow(name,price,qty){equipment.push({name:name||'',price:price||0,qty:qty||1});renderEquipment();}
function removeEquipment(i){equipment.splice(i,1);renderEquipment();}
function removeService(i){services.splice(i,1);renderServices();}
function renderServices(){
  var list=document.getElementById('servicesList');
  if(!services.length){list.innerHTML='<div class="empty-state" style="padding:24px"><div class="empty-icon">🔧</div><p>Добавьте услуги</p></div>';recalc();return;}
  list.innerHTML=services.map(function(s,i){
    return'<div class="service-row">'+
    '<textarea class="svc-name" rows="2" maxlength="120" placeholder="Наименование" oninput="services['+i+'].name=this.value">'+esc(s.name)+'</textarea>'+
    '<input type="number" min="0" maxlength="10" value="'+s.price+'" oninput="services['+i+'].price=parseFloat(this.value)||0;recalc()">'+
    '<input type="number" min="1" maxlength="6" value="'+s.qty+'" oninput="services['+i+'].qty=parseFloat(this.value)||1;recalc()">'+
    '<div class="svc-total" id="svcTotal'+i+'">'+fmt(s.price*s.qty)+'</div>'+
    '<button class="delete-btn" onclick="removeService('+i+')" style="padding-top:4px">✕</button></div>';
  }).join('');
  recalc();
}

function renderEquipment(){
  var list=document.getElementById('equipmentList');
  if(!list)return;
  if(!equipment.length){list.innerHTML='<div class="empty-state" style="padding:20px"><div class="empty-icon">❄️</div><p>Оборудование не добавлено</p></div>';recalc();return;}
  list.innerHTML=equipment.map(function(s,i){
    return'<div class="service-row equipment-row">'+
    '<textarea class="svc-name" rows="2" maxlength="140" placeholder="Оборудование" oninput="equipment['+i+'].name=this.value">'+esc(s.name)+'</textarea>'+ 
    '<input type="number" min="0" maxlength="10" value="'+s.price+'" oninput="equipment['+i+'].price=parseFloat(this.value)||0;recalc()">'+
    '<input type="number" min="1" maxlength="6" value="'+s.qty+'" oninput="equipment['+i+'].qty=parseFloat(this.value)||1;recalc()">'+
    '<div class="svc-total" id="eqTotal'+i+'">'+fmt(s.price*s.qty)+'</div>'+ 
    '<button class="delete-btn" onclick="removeEquipment('+i+')" style="padding-top:4px">✕</button></div>';
  }).join('');
  recalc();
}


function recalc(){
  var worksSub=services.reduce(function(s,x){return s+(parseFloat(x.price)||0)*(parseFloat(x.qty)||1);},0);
  var equipmentSub=equipment.reduce(function(s,x){return s+(parseFloat(x.price)||0)*(parseFloat(x.qty)||1);},0);
  var sub=worksSub+equipmentSub;
  services.forEach(function(s,i){var el=document.getElementById('svcTotal'+i);if(el)el.textContent=fmt((parseFloat(s.price)||0)*(parseFloat(s.qty)||1));});
  equipment.forEach(function(s,i){var el=document.getElementById('eqTotal'+i);if(el)el.textContent=fmt((parseFloat(s.price)||0)*(parseFloat(s.qty)||1));});
  var dv=parseFloat(document.getElementById('discountVal').value)||0;
  var dt=document.getElementById('discountType').value;
  var disc=dv>0?(dt==='percent'?sub*dv/100:dv):0;
  if(dv>0){document.getElementById('discountRow').style.display='';document.getElementById('discountDisplay').textContent='−'+fmt(disc);}
  else{document.getElementById('discountRow').style.display='none';}
  var prepay=parseFloat(document.getElementById('prepayVal')?document.getElementById('prepayVal').value:0)||0;
  if(prepay>0&&document.getElementById('prepayRow')){document.getElementById('prepayRow').style.display='';document.getElementById('prepayDisplay').textContent='−'+fmt(prepay);}
  else if(document.getElementById('prepayRow')){document.getElementById('prepayRow').style.display='none';}
  var eqRow=document.getElementById('equipmentTotalRow');if(eqRow)eqRow.style.display=equipmentSub>0?'':'none';
  var eqEl=document.getElementById('equipmentTotalDisplay');if(eqEl)eqEl.textContent=fmt(equipmentSub);
  var workEl=document.getElementById('worksTotalDisplay');if(workEl)workEl.textContent=fmt(worksSub);
  document.getElementById('subtotalDisplay').textContent=fmt(sub);
  document.getElementById('grandTotalDisplay').textContent=fmt(Math.max(0,sub-disc-prepay));
}


// PRICE LIST
function renderPriceList(){
  var list=document.getElementById('priceList');if(!list)return;
  list.innerHTML=priceItems.map(function(p,i){
    return'<div class="service-row settings-price-row">'+
    '<label class="settings-price-cell settings-name-cell"><em class="settings-row-label">Услуга</em><textarea rows="2" maxlength="120" placeholder="Услуга" oninput="priceItems['+i+'].name=this.value">'+esc(p.name)+'</textarea></label>'+
    '<label class="settings-price-cell settings-price-cell-price"><em class="settings-row-label">Цена</em><input type="number" min="0" value="'+p.price+'" placeholder="Цена" oninput="priceItems['+i+'].price=parseFloat(this.value)||0"></label>'+
    '<label class="settings-price-cell settings-price-cell-unit"><em class="settings-row-label">Ед.</em><input type="text" maxlength="10" value="'+esc(p.unit||'шт')+'" placeholder="Ед." oninput="priceItems['+i+'].unit=this.value"></label>'+
    '<button class="delete-btn" onclick="removePriceItem('+i+')">✕</button></div>';
  }).join('');
}
function addPriceItem(){priceItems.push({name:'',price:0,unit:'шт'});renderPriceList();}
function removePriceItem(i){priceItems.splice(i,1);renderPriceList();}
function defaultPrices(){return[
  {name:'Монтаж кондиционера до 2,5 кВт',price:4500,unit:'шт'},
  {name:'Монтаж кондиционера 3,5–5 кВт',price:5500,unit:'шт'},
  {name:'Демонтаж кондиционера',price:2000,unit:'шт'},
  {name:'Прокладка трассы (1 м.п.)',price:350,unit:'м.п.'},
  {name:'Штробление стены (1 м.п.)',price:800,unit:'м.п.'},
  {name:'Установка дренажной помпы',price:1800,unit:'шт'},
  {name:'Подключение к электросети',price:1200,unit:'шт'},
  {name:'Заправка фреоном R-32 (1 кг)',price:1500,unit:'кг'},
  {name:'Выезд мастера',price:500,unit:'шт'}
];}

function defaultEquipmentItems(){return[
  {name:'Кондиционер настенный сплит-система 7 BTU',price:0,unit:'шт'},
  {name:'Кондиционер настенный сплит-система 9 BTU',price:0,unit:'шт'},
  {name:'Кондиционер настенный сплит-система 12 BTU',price:0,unit:'шт'},
  {name:'Кондиционер настенный сплит-система 18 BTU',price:0,unit:'шт'},
  {name:'Кондиционер настенный сплит-система 24 BTU',price:0,unit:'шт'}
];}
function renderEquipmentList(){
  var list=document.getElementById('equipmentPriceList');if(!list)return;
  list.innerHTML=equipmentItems.map(function(p,i){
    return'<div class="service-row settings-price-row">'+
    '<label class="settings-price-cell settings-name-cell"><em class="settings-row-label">Оборудование</em><textarea rows="2" maxlength="140" placeholder="Оборудование" oninput="equipmentItems['+i+'].name=this.value">'+esc(p.name)+'</textarea></label>'+
    '<label class="settings-price-cell settings-price-cell-price"><em class="settings-row-label">Цена</em><input type="number" min="0" value="'+p.price+'" placeholder="Цена" oninput="equipmentItems['+i+'].price=parseFloat(this.value)||0"></label>'+
    '<label class="settings-price-cell settings-price-cell-unit"><em class="settings-row-label">Ед.</em><input type="text" maxlength="10" value="'+esc(p.unit||'шт')+'" placeholder="Ед." oninput="equipmentItems['+i+'].unit=this.value"></label>'+
    '<button class="delete-btn" onclick="removeEquipmentItem('+i+')">✕</button></div>';
  }).join('');
}
function addEquipmentItem(){equipmentItems.push({name:'',price:0,unit:'шт'});renderEquipmentList();}
function removeEquipmentItem(i){equipmentItems.splice(i,1);renderEquipmentList();}


// MODAL
var priceModalTarget='services';
function addFromPriceList(){
  priceModalTarget='services';
  var mt=document.getElementById('modalPriceTitle');if(mt)mt.textContent='📋 Выбрать из прайса работ';
  if(!priceItems.length){toast('Прайс пуст','error');return;}
  document.getElementById('modalPriceList').innerHTML=priceItems.map(function(p,i){
    return'<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;min-width:0">'+
    '<input type="checkbox" data-idx="'+i+'" style="width:16px;height:16px;flex-shrink:0;margin-top:2px">'+
    '<span style="flex:1;font-size:14px;word-break:break-word;min-width:0;overflow-wrap:break-word">'+esc(p.name)+'</span>'+
    '<span style="color:var(--accent);font-weight:700;white-space:nowrap;flex-shrink:0;margin-left:8px">'+fmt(p.price)+'</span></label>';
  }).join('');
  document.getElementById('priceModal').style.display='flex';
}
function addFromEquipmentList(){
  priceModalTarget='equipment';
  var mt=document.getElementById('modalPriceTitle');if(mt)mt.textContent='❄️ Выбрать оборудование';
  if(!equipmentItems.length){toast('Список оборудования пуст','error');return;}
  document.getElementById('modalPriceList').innerHTML=equipmentItems.map(function(p,i){
    return'<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;min-width:0">'+
    '<input type="checkbox" data-idx="'+i+'" style="width:16px;height:16px;flex-shrink:0;margin-top:2px">'+
    '<span style="flex:1;font-size:14px;word-break:break-word;min-width:0;overflow-wrap:break-word">'+esc(p.name)+'</span>'+
    '<span style="color:var(--accent);font-weight:700;white-space:nowrap;flex-shrink:0;margin-left:8px">'+fmt(p.price)+'</span></label>';
  }).join('');
  document.getElementById('priceModal').style.display='flex';
}
function closeModal(){document.getElementById('priceModal').style.display='none';}
function applyModalItems(){
  document.querySelectorAll('#modalPriceList input:checked').forEach(function(cb){
    if(priceModalTarget==='equipment'){
      var e=equipmentItems[cb.dataset.idx];if(e)addEquipmentRow(e.name,e.price,1);
    }else{
      var p=priceItems[cb.dataset.idx];if(p)addServiceRow(p.name,p.price,1);
    }
  });
  closeModal();
}


// SETTINGS
async function saveSettings(showMsg){
  settings={
    company:document.getElementById('s-company').value,
    phone:document.getElementById('s-phone').value,
    email:document.getElementById('s-email').value,
    city:document.getElementById('s-city').value,
    inn:document.getElementById('s-inn').value,
    requisites:document.getElementById('s-requisites').value,
    warranty:document.getElementById('s-warranty').value,
    color:document.getElementById('s-color').value,
    signature:document.getElementById('s-signature').value,
    signatureImage:(typeof getSignatureImageForSave==='function' ? getSignatureImageForSave() : ((settings && settings.signatureImage) || '')),
    contractBody:document.getElementById('s-contract-body') ? document.getElementById('s-contract-body').value : '',
    equipmentItems:JSON.parse(JSON.stringify(equipmentItems||[])),
    logo:logoDataURL
  };
  var args=Object.assign(rpcAuthParams(),{p_settings:settings,p_items:priceItems});
  var res=await sb.rpc('kp_save_settings',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка сохранения'),'error');return;}
  if(showMsg)toast('Настройки сохранены ✓','success');
}

function handleLogo(e){
  var file=e.target.files[0];if(!file)return;
  if(file.size>5*1024*1024){toast('Файл слишком большой','error');return;}
  var r=new FileReader();
  r.onload=function(ev){
    var img=new Image();
    img.onload=function(){
      var c=document.createElement('canvas'),max=200,w=img.naturalWidth,h=img.naturalHeight;
      if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}
      c.width=w;c.height=h;
      var ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
      logoDataURL=c.toDataURL('image/jpeg',0.6);
      document.getElementById('logoPreviewWrap').innerHTML='<img src="'+logoDataURL+'" class="logo-preview">';
      toast('Логотип загружен ✓','success');
    };
    img.src=ev.target.result;
  };
  r.readAsDataURL(file);
}
function clearLogo(){logoDataURL=null;document.getElementById('logoPreviewWrap').innerHTML='<div style="color:var(--text3);font-size:13px"><div style="font-size:32px;margin-bottom:8px">🖼</div><p>Нажмите для загрузки</p></div>';}

// SIGNATURE PAD
var signatureCanvas=null,signatureCtx=null,signatureDrawing=false,signatureHasInk=false;
function setupSignaturePad(){
  signatureCanvas=document.getElementById('signatureCanvas');
  if(!signatureCanvas)return;
  signatureCtx=signatureCanvas.getContext('2d');
  resizeSignatureCanvas();
  ['pointerdown','pointermove','pointerup','pointerleave','pointercancel'].forEach(function(ev){signatureCanvas.addEventListener(ev,handleSignaturePointer);});
  window.addEventListener('resize',function(){setTimeout(resizeSignatureCanvas,80);});
}
function resizeSignatureCanvas(){
  if(!signatureCanvas)return;
  var saved = settings && settings.signatureImage ? settings.signatureImage : (signatureHasInk ? signatureCanvas.toDataURL('image/png') : '');
  var rect=signatureCanvas.getBoundingClientRect();
  var ratio=Math.max(1,window.devicePixelRatio||1);
  var w=Math.max(320,Math.round((rect.width||640)*ratio)), h=Math.round(180*ratio);
  if(signatureCanvas.width!==w || signatureCanvas.height!==h){signatureCanvas.width=w;signatureCanvas.height=h;}
  signatureCtx=signatureCanvas.getContext('2d');
  signatureCtx.setTransform(1,0,0,1,0,0);
  signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
  signatureCtx.lineWidth=2.4*ratio;signatureCtx.lineCap='round';signatureCtx.lineJoin='round';signatureCtx.strokeStyle='#2563eb';
  if(saved) drawSavedSignature(saved);
}
function handleSignaturePointer(e){
  if(!signatureCtx)return;
  e.preventDefault();
  var p=getSignaturePoint(e);
  if(e.type==='pointerdown'){
    signatureDrawing=true;signatureHasInk=true;signatureCanvas.setPointerCapture&&signatureCanvas.setPointerCapture(e.pointerId);
    signatureCtx.beginPath();signatureCtx.moveTo(p.x,p.y);return;
  }
  if(e.type==='pointermove'&&signatureDrawing){signatureCtx.lineTo(p.x,p.y);signatureCtx.stroke();return;}
  if(e.type==='pointerup'||e.type==='pointerleave'||e.type==='pointercancel') signatureDrawing=false;
}
function getSignaturePoint(e){
  var rect=signatureCanvas.getBoundingClientRect();
  return {x:(e.clientX-rect.left)*(signatureCanvas.width/rect.width),y:(e.clientY-rect.top)*(signatureCanvas.height/rect.height)};
}
function clearSignaturePad(){
  if(!signatureCanvas||!signatureCtx)return;
  signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
  signatureHasInk=false;
  if(settings)settings.signatureImage='';
  toast('Подпись очищена','success');
}
function getSignatureImageForSave(){
  if(signatureCanvas && signatureHasInk) return signatureCanvas.toDataURL('image/png');
  return (settings && settings.signatureImage) || '';
}
function saveSignaturePad(){
  if(!signatureCanvas){toast('Поле подписи не найдено','error');return;}
  if(!signatureHasInk && !(settings&&settings.signatureImage)){toast('Сначала поставьте подпись','error');return;}
  settings.signatureImage=signatureCanvas.toDataURL('image/png');
  toast('Подпись сохранена ✓','success');
}
function drawSavedSignature(dataURL){
  if(!signatureCanvas||!signatureCtx||!dataURL)return;
  var img=new Image();
  img.onload=function(){
    signatureCtx.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);
    var ratio=Math.min(signatureCanvas.width/img.width,signatureCanvas.height/img.height);
    var w=img.width*ratio,h=img.height*ratio;
    signatureCtx.drawImage(img,(signatureCanvas.width-w)/2,(signatureCanvas.height-h)/2,w,h);
    signatureHasInk=true;
  };
  img.src=dataURL;
}
function resetContractTemplate(){
  var el=document.getElementById('s-contract-body');
  if(!el)return;
  if(!confirm('Вернуть стандартный текст договора?'))return;
  el.value=window.KP_DEFAULT_CONTRACT_BODY||'';
  toast('Стандартный договор восстановлен','success');
}

// PHOTOS
function renderPhotos(){
  var g=document.getElementById('photoGrid');
  document.getElementById('photoCount').textContent=quotePhotos.length+' / '+MAX_PHOTOS+' фото';
  document.getElementById('photoClearBtn').style.display=quotePhotos.length?'':'none';
  if(!quotePhotos.length){g.innerHTML='<div class="photo-empty">Фото пока не добавлены</div>';return;}
  g.innerHTML=quotePhotos.map(function(p,i){return'<div class="photo-card"><img src="'+p.dataURL+'"><button class="photo-del" onclick="removePhoto('+i+')">✕</button></div>';}).join('');
}
function removePhoto(i){quotePhotos.splice(i,1);renderPhotos();}
function clearAllPhotos(){if(!confirm('Удалить все фото?'))return;quotePhotos=[];renderPhotos();}
function loadPhotoFromUrl(){
  var url=document.getElementById('photoUrlInput').value.trim();
  if(!url){toast('Введите ссылку','error');return;}
  if(quotePhotos.length>=MAX_PHOTOS){toast('Максимум '+MAX_PHOTOS+' фото','error');return;}
  var img=new Image();img.crossOrigin='anonymous';
  img.onload=function(){
    try{var c=document.createElement('canvas'),M=800,w=img.naturalWidth,h=img.naturalHeight;
    if(w>M||h>M){if(w>h){h=Math.round(h*M/w);w=M;}else{w=Math.round(w*M/h);h=M;}}
    c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
    quotePhotos.push({dataURL:c.toDataURL('image/jpeg',.85),name:'фото'});
    document.getElementById('photoUrlInput').value='';renderPhotos();toast('Фото добавлено ✓','success');
    }catch(e){toast('CORS — сайт запрещает копирование','error');}
  };
  img.onerror=function(){toast('Не удалось загрузить','error');};
  img.src=url+(url.indexOf('?')>=0?'&':'?')+'_cb='+Date.now();
}
function loadPhotoFromFile(e){
  Array.from(e.target.files).forEach(function(file){
    if(ALLOWED_TYPES.indexOf(file.type)===-1){toast(file.name+': только JPG, PNG, WebP','error');return;}
    if(file.size>MAX_PHOTO_MB*1024*1024){toast(file.name+': превышает '+MAX_PHOTO_MB+' МБ','error');return;}
    if(quotePhotos.length>=MAX_PHOTOS){toast('Максимум '+MAX_PHOTOS+' фото','error');return;}
    var r=new FileReader();
    r.onload=function(ev){var img=new Image();img.onload=function(){
      var c=document.createElement('canvas'),M=800,w=img.naturalWidth,h=img.naturalHeight;
      if(w>M||h>M){if(w>h){h=Math.round(h*M/w);w=M;}else{w=Math.round(w*M/h);h=M;}}
      c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
      quotePhotos.push({dataURL:c.toDataURL('image/jpeg',.85),name:file.name});renderPhotos();
    };img.src=ev.target.result;};
    r.readAsDataURL(file);
  });
  e.target.value='';
}

// PREVIEW
function buildPreview(){
  var c=getClientData(),t=getTotals();
  var today=new Date().toLocaleDateString('ru-RU'),num=generateQuoteNumber(),color=settings.color||'#0066ff';
  var workRows=services.map(function(s){return'<tr><td>'+esc(s.name)+'</td><td style="text-align:right">'+fmt(s.price)+'</td><td style="text-align:center">'+s.qty+'</td><td style="text-align:right;font-weight:700">'+fmt((parseFloat(s.price)||0)*(parseFloat(s.qty)||1))+'</td></tr>';}).join('');
  var eqRows=equipment.map(function(s){return'<tr><td>'+esc(s.name)+'</td><td style="text-align:right">'+fmt(s.price)+'</td><td style="text-align:center">'+s.qty+'</td><td style="text-align:right;font-weight:700">'+fmt((parseFloat(s.price)||0)*(parseFloat(s.qty)||1))+'</td></tr>';}).join('');
  var tableHead='<table style="table-layout:fixed;width:100%"><thead style="background:'+color+'"><tr><th style="color:#fff;padding:7px">Наименование</th><th style="color:#fff;padding:7px;text-align:right">Цена</th><th style="color:#fff;padding:7px;text-align:center">Кол.</th><th style="color:#fff;padding:7px;text-align:right">Сумма</th></tr></thead><tbody>';
  var tableEnd='</tbody></table>';
  var hasEquipment = equipment.length > 0;
  var hasWorks = services.length > 0;
  var sectionLabel = function(title,top){return '<div class="quote-section-label" style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:'+color+';margin:'+(top?'10px':'12px')+' 0 6px">'+title+'</div>';};
  var sections = '';
  if(hasEquipment) sections += sectionLabel('Оборудование',true)+tableHead+eqRows+tableEnd;
  if(hasWorks) sections += (hasEquipment?sectionLabel('Работы',false):'')+tableHead+workRows+tableEnd;
  if(!hasEquipment && !hasWorks) sections = '<div class="empty-state" style="padding:20px"><p>Позиции не добавлены</p></div>';
  var h='<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid '+color+';margin-bottom:14px">'+
    '<div>'+(logoDataURL?'<img src="'+logoDataURL+'" style="max-height:52px;max-width:150px;object-fit:contain;display:block;margin-bottom:4px">':'')+
    (settings.company?'<div style="font-size:15px;font-weight:800;color:#111">'+esc(settings.company)+'</div>':'')+
    '<div style="font-size:11px;color:#666">'+[settings.phone,settings.email].filter(Boolean).join(' · ')+'</div>'+
    ([settings.city,settings.inn?'ИНН '+settings.inn:''].filter(Boolean).length?'<div style="font-size:10px;color:#999">'+[settings.city,settings.inn?'ИНН '+settings.inn:''].filter(Boolean).join(' · ')+'</div>':'')+
    '</div><div style="text-align:right"><div style="font-size:16px;font-weight:900;color:'+color+';line-height:1.2">КОММЕРЧЕСКОЕ<br/>ПРЕДЛОЖЕНИЕ</div><div style="font-size:10px;color:#888;margin-top:4px">№ '+num+' от '+today+'</div></div></div>'+
    '<div style="background:#f8fafc;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;max-width:100%;overflow:hidden;overflow-wrap:anywhere;word-break:break-word">'+
    '<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:700;margin-bottom:4px">Клиент</div>'+
    '<b>ФИО:</b> '+esc(c.name)+' &nbsp; <b>Тел:</b> '+esc(c.phone)+
    (c.email?' &nbsp; <b>Email:</b> '+esc(c.email):'')+
    (c.addr?'<br><b>Адрес:</b> '+esc(c.addr):'')+
    '</div>'+
    sections+
    '<div style="text-align:right"><div style="display:inline-block;min-width:210px">'+
    (t.equipmentSubtotal>0?'<div style="display:flex;justify-content:space-between;font-size:12px;color:#666;padding:3px 0"><span>Оборудование:</span><span>'+fmt(t.equipmentSubtotal)+'</span></div>':'')+
    (t.worksSubtotal>0 && t.equipmentSubtotal>0?'<div style="display:flex;justify-content:space-between;font-size:12px;color:#666;padding:3px 0"><span>Работы:</span><span>'+fmt(t.worksSubtotal)+'</span></div>':'')+
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:#666;padding:3px 0"><span>Итого:</span><span>'+fmt(t.subtotal)+'</span></div>'+
    (t.discount>0?'<div style="display:flex;justify-content:space-between;font-size:12px;color:#c00;padding:3px 0"><span>Скидка:</span><span style="white-space:nowrap">−'+fmt(t.discount)+'</span></div>':'')+
    (t.prepay>0?'<div style="display:flex;justify-content:space-between;font-size:12px;color:#059669;padding:3px 0"><span>Предоплата:</span><span style="white-space:nowrap">−'+fmt(t.prepay)+'</span></div>':'')+
    '<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;color:'+color+';border-top:2px solid '+color+';padding-top:6px;margin-top:4px"><span>К ОПЛАТЕ:</span><span style="white-space:nowrap">'+fmt(t.grand)+'</span></div></div></div>'+
    (c.notes?'<div data-wrap-fix="1" style="background:#fffbf0;border-left:3px solid #f0a020;padding:8px 12px;margin-top:10px;font-size:11px;overflow-wrap:anywhere;word-break:break-word;white-space:normal;max-width:100%;overflow:hidden"><b>Примечание:</b> '+esc(c.notes)+'</div>':'')+
    (settings.warranty?'<div data-wrap-fix="1" style="background:#f0f8ff;border-left:3px solid '+color+';padding:8px 12px;margin-top:10px;font-size:11px;color:#445;overflow-wrap:anywhere;word-break:break-word;white-space:normal">'+esc(settings.warranty)+'</div>':'')+
    (quotePhotos.length?'<div style="margin-top:14px;padding-top:10px;border-top:2px solid '+color+'"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:'+color+';margin-bottom:8px">Фото оборудования</div><div style="display:grid;grid-template-columns:repeat('+Math.min(quotePhotos.length,3)+',1fr);gap:6px">'+quotePhotos.map(function(p){return'<img src="'+p.dataURL+'" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid #ddd">';}).join('')+'</div></div>':'')+
    '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#aaa">'+
    '<div>'+[settings.requisites,settings.inn?'ИНН '+settings.inn:'',settings.city].filter(Boolean).join(' · ')+'</div>'+
    '<div>'+esc(settings.signature||'')+'</div></div>';
  document.getElementById('pdfPreview').innerHTML=h;
}

// PDF
function printPDF(){
  var c=getClientData(),t=getTotals();
  var today=new Date().toLocaleDateString('ru-RU'),num=generateQuoteNumber(),color=settings.color||'#0066ff';
  var sRows=services.map(function(s,i){
    return'<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'+
    '<td style="text-align:center;color:#888">'+(i+1)+'</td><td>'+esc(s.name)+'</td>'+ 
    '<td style="text-align:right">'+fmt(s.price)+'</td><td style="text-align:center">'+s.qty+'</td>'+ 
    '<td style="text-align:right;font-weight:700;color:'+color+'">'+fmt((parseFloat(s.price)||0)*(parseFloat(s.qty)||1))+'</td></tr>';
  }).join('');
  var eqRows=equipment.map(function(s,i){
    return'<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'+
    '<td style="text-align:center;color:#888">'+(i+1)+'</td><td>'+esc(s.name)+'</td>'+ 
    '<td style="text-align:right">'+fmt(s.price)+'</td><td style="text-align:center">'+s.qty+'</td>'+ 
    '<td style="text-align:right;font-weight:700;color:'+color+'">'+fmt((parseFloat(s.price)||0)*(parseFloat(s.qty)||1))+'</td></tr>';
  }).join('');
  var pdfTableHead='<table><thead><tr><th>#</th><th>Наименование</th><th>Цена</th><th>Кол.</th><th>Сумма</th></tr></thead><tbody>';
  var pdfTableEnd='</tbody></table>';
  var hasPdfEquipment = equipment.length > 0;
  var hasPdfWorks = services.length > 0;
  var pdfSections = '';
  if(hasPdfEquipment) pdfSections += '<div class="sec-title">Оборудование</div>'+pdfTableHead+eqRows+pdfTableEnd;
  if(hasPdfWorks) pdfSections += (hasPdfEquipment?'<div class="sec-title">Работы</div>':'')+pdfTableHead+sRows+pdfTableEnd;
  if(!hasPdfEquipment && !hasPdfWorks) pdfSections = '<div style="padding:14px;border:1px solid #eee;border-radius:8px;color:#777">Позиции не добавлены</div>';
  var logoH=logoDataURL?'<img src="'+logoDataURL+'" style="max-height:50px;max-width:140px;object-fit:contain;display:block;margin-bottom:4px">':'';
  var masterH='';
  if(settings.company)masterH+='<div style="font-size:15px;font-weight:800;color:#111;margin-bottom:2px;word-break:normal;overflow-wrap:normal;white-space:normal;hyphens:none;word-break:keep-all;max-width:100%;overflow:hidden">'+esc(settings.company)+'</div>';
  var ct=[settings.phone,settings.email].filter(Boolean).join(' · ');if(ct)masterH+='<div style="font-size:11px;color:#555;word-break:normal;overflow-wrap:normal;white-space:normal;hyphens:none;word-break:keep-all;max-width:100%;overflow:hidden">'+ct+'</div>';
  var dt=[settings.city,settings.inn?'ИНН '+settings.inn:''].filter(Boolean).join(' · ');if(dt)masterH+='<div style="font-size:10px;color:#888;word-break:normal;overflow-wrap:normal;white-space:normal;hyphens:none;word-break:keep-all;max-width:100%;overflow:hidden">'+dt+'</div>';
  var discH=t.discount>0?'<tr><td style="color:#888">Скидка:</td><td style="text-align:right;white-space:nowrap;color:#c00">−'+fmt(t.discount)+'</td></tr>':'';
  var prepayH=t.prepay>0?'<tr><td style="color:#059669">Предоплата:</td><td style="text-align:right;white-space:nowrap;color:#059669">−'+fmt(t.prepay)+'</td></tr>':'';
  var photosH='';
  if(quotePhotos.length){photosH='<div style="margin-top:18px;padding-top:12px;border-top:2px solid '+color+'"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:'+color+';margin-bottom:8px">Фото оборудования</div><div style="display:grid;grid-template-columns:repeat('+Math.min(quotePhotos.length,3)+',1fr);gap:6px">'+quotePhotos.map(function(p){return'<img src="'+p.dataURL+'" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid #ddd">';}).join('')+'</div></div>';}
  var footer=[settings.requisites,settings.inn?'ИНН '+settings.inn:'',settings.city].filter(Boolean).join(' · ');
  var html='<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no"><title>КП № '+num+'</title>'+
    '<style>'+
    '*{box-sizing:border-box;margin:0;padding:0}'+
    'html,body{width:100%;max-width:100%;overflow-x:hidden;background:#fff}'+
    'body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;color:#222;padding:14px;word-break:break-word;overflow-wrap:anywhere}'+
    'body *{max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-break:break-word}'+
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:3px solid '+color+';margin-bottom:14px;overflow:hidden}'+'.hdr>div:first-child{min-width:0;max-width:58%;overflow:hidden;word-break:normal;overflow-wrap:normal;white-space:normal}'+'.hdr>div:last-child{flex:0 0 170px;max-width:170px;min-width:150px;text-align:right;word-break:normal;overflow-wrap:normal}'+
    '.hdr>div{min-width:0;word-break:normal;overflow-wrap:normal}'+
    '.kpt{text-align:right;font-size:15px;font-weight:900;color:'+color+';line-height:1.15;white-space:normal;word-break:normal;overflow-wrap:normal;hyphens:none;word-break:keep-all}'+
    '.cb{background:#f8fafc;border-radius:6px;padding:10px 12px;margin-bottom:14px;overflow:hidden}'+
    '.sec-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:'+color+';margin:10px 0 6px}'+
    '.cg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 12px;font-size:10.5px}'+
    '.cg>div{min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:break-word}'+
    'table{width:100%;max-width:100%;border-collapse:collapse;margin-bottom:10px;table-layout:fixed;overflow:hidden}'+
    'thead tr{background:'+color+'}thead th{padding:7px 5px;color:#fff;font-size:9px;text-align:left;white-space:normal;overflow:hidden;vertical-align:middle;line-height:1.15}'+
    'thead th:nth-child(1){width:22px;text-align:center}'+
    'thead th:nth-child(2){width:auto}'+
    'thead th:nth-child(3){text-align:right;width:54px}'+
    'thead th:nth-child(4){text-align:center;width:34px;vertical-align:middle;white-space:nowrap;word-break:normal;overflow-wrap:normal}'+
    'thead th:nth-child(5){text-align:right;width:78px}'+
    'tbody td{padding:6px 5px;border-bottom:1px solid #eee;font-size:10.5px;white-space:normal;overflow:hidden;text-overflow:clip}'+
    'tbody td:nth-child(1){text-align:center;color:#888}'+
    'tbody td:nth-child(2){word-break:break-word;overflow-wrap:anywhere}'+
    'tbody td:nth-child(3),tbody td:nth-child(5){text-align:right;font-size:10px;word-break:break-word;overflow-wrap:anywhere}'+
    'tbody td:nth-child(4){text-align:center;font-size:10px}'+
    '.tot{display:flex;justify-content:flex-end;margin-bottom:12px;width:100%;overflow:hidden}.tot table{width:100%;max-width:240px;min-width:0;table-layout:fixed}'+
    '.tot td{padding:4px 0;font-size:11px;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.tot td:last-child{text-align:right;padding-left:10px}'+
    '.grand td{font-size:14px;font-weight:900;color:'+color+';border-top:2px solid '+color+';padding-top:8px}'+
    'a{color:inherit;text-decoration:none}'+
    '.ftr{margin-top:18px;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;gap:10px;font-size:9px;color:#aaa;overflow:hidden}.ftr>div{min-width:0}'+
    '.pbtn{display:block;width:100%;padding:14px;margin-bottom:14px;background:'+color+';color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}'+
    '@media(max-width:520px){body{padding:10px;font-size:10.5px}.hdr{gap:8px}.hdr>div:first-child{max-width:55%}.hdr>div:last-child{flex:0 0 148px;max-width:148px;min-width:148px}.kpt{font-size:12px;word-break:normal;overflow-wrap:normal;hyphens:none;word-break:keep-all}.cg{grid-template-columns:minmax(0,1fr);font-size:10px}thead th{font-size:8.5px;padding:6px 3px}tbody td{font-size:9.5px;padding:5px 3px}thead th:nth-child(3){width:48px}thead th:nth-child(4){width:32px}thead th:nth-child(5){width:66px}tbody td:nth-child(3),tbody td:nth-child(5){font-size:9px}.tot table{max-width:210px}.grand td{font-size:13px}}'+
    '@media print{.pbtn{display:none}@page{margin:12mm 14mm}body{padding:0;overflow:visible}}'+
    '</style></head><body>'+
    '<button class="pbtn" onclick="window.print()">💾 Сохранить как PDF</button>'+
    '<div class="hdr"><div>'+logoH+masterH+'</div>'+
    '<div><div class="kpt">КОММЕРЧЕСКОЕ<br/>ПРЕДЛОЖЕНИЕ</div><div style="font-size:10px;color:#888;text-align:right;margin-top:4px">№ '+num+' от '+today+'</div></div></div>'+
    '<div class="cb"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:700;margin-bottom:6px">Клиент</div>'+
    '<div class="cg"><div><b>ФИО:</b> '+esc(c.name)+'</div><div><b>Тел:</b> '+esc(c.phone)+'</div>'+
    (c.email?'<div><b>Email:</b> '+esc(c.email)+'</div>':'<div></div>')+
    (c.city?'<div><b>Город:</b> '+esc(c.city)+'</div>':'<div></div>')+
    (c.addr?'<div style="grid-column:1/-1"><b>Адрес:</b> '+esc(c.addr)+'</div>':'')+
    '</div></div>'+
    pdfSections+
    '<div class="tot"><table>'+
    (t.equipmentSubtotal>0?'<tr><td style="color:#888">Оборудование:</td><td>'+fmt(t.equipmentSubtotal)+'</td></tr>':'')+
    (t.worksSubtotal>0 && t.equipmentSubtotal>0?'<tr><td style="color:#888">Работы:</td><td>'+fmt(t.worksSubtotal)+'</td></tr>':'')+
    '<tr><td style="color:#888">Итого:</td><td>'+fmt(t.subtotal)+'</td></tr>'+discH+prepayH+'<tr class="grand"><td>К ОПЛАТЕ:</td><td>'+fmt(t.grand)+'</td></tr></table></div>'+
    (c.notes?'<div style="background:#fffbf0;border-left:3px solid #f0a020;padding:8px 12px;border-radius:3px;margin-top:10px;font-size:11px;overflow-wrap:anywhere;word-break:break-word;white-space:normal;max-width:100%;overflow:hidden"><b>Примечание:</b> '+esc(c.notes)+'</div>':'')+
    (settings.warranty?'<div style="background:#f0f8ff;border-left:3px solid '+color+';padding:8px 12px;border-radius:3px;margin-top:10px;font-size:11px;color:#445;overflow-wrap:anywhere;word-break:break-word;white-space:normal">'+esc(settings.warranty)+'</div>':'')+
    photosH+
    '<div class="ftr"><div>'+footer+'</div><div>'+esc(settings.signature||'')+'</div></div>'+
    '</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();}
  else toast('Разрешите всплывающие окна','error');
}

// HISTORY
async function saveToHistory(){
  if(!validateClient()){nextStep(1);return;}
  if(!currentKeyData.is_admin&&historyData.length>=MAX_KP){
    toast('Память заполнена ('+MAX_KP+' КП). Удалите хотя бы одно.','error');
    showPage('history',null);return;
  }
  var c=getClientData(),t=getTotals(),num=generateQuoteNumber();
  var entry={num:num,date:new Date().toLocaleDateString('ru-RU'),clientName:c.name,clientPhone:c.phone,total:t.grand,servicesCount:services.length,services:JSON.parse(JSON.stringify(services)),equipment:JSON.parse(JSON.stringify(equipment)),client:Object.assign({},c),discount:{val:parseFloat(document.getElementById('discountVal').value)||0,type:document.getElementById('discountType').value}};
  var args=Object.assign(rpcAuthParams(),{p_client_name:c.name,p_client_phone:c.phone,p_total:t.grand,p_data:entry});
  var res=await sb.rpc('kp_save_quote',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка сохранения'),'error');return;}
  entry.id=res.data.id;historyData.unshift(entry);updateHistoryBadge();toast('КП сохранено ✓','success');
}

function renderHistory(){
  var list=document.getElementById('historyList');
  if(!historyData.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">📂</div><p>История пуста</p></div>';return;}
  var used=historyData.length,pct=Math.round(used/MAX_KP*100);
  var bc=used>=MAX_KP?'var(--danger)':used>=MAX_KP*0.8?'var(--warn)':'var(--success)';
  var counter=!currentKeyData.is_admin?'<div style="margin-bottom:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 16px">'+
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:8px"><span>КП в памяти</span><span style="font-weight:700;color:'+bc+'">'+used+' / '+MAX_KP+'</span></div>'+
    '<div style="background:var(--border);border-radius:4px;height:5px"><div style="width:'+pct+'%;height:5px;border-radius:4px;background:'+bc+'"></div></div>'+
    (used>=MAX_KP?'<div style="margin-top:8px;font-size:12px;color:var(--danger)">⚠ Удалите хотя бы одно КП</div>':'')+
    '</div>':'';
  list.innerHTML=counter+historyData.map(function(h){
    return'<div class="history-item">'+
    '<div class="history-info"><div class="history-name">'+esc(h.clientName)+'</div>'+
    '<div class="history-meta"><span>№ '+h.num+'</span><span>'+h.date+'</span><span>'+esc(h.clientPhone)+'</span><span>'+h.servicesCount+' услуг</span></div></div>'+
    '<div class="history-amount">'+fmt(h.total)+'</div>'+
    '<div class="history-actions"><button class="btn btn-ghost btn-sm" onclick="loadFromHistory('+h.id+')">✏️</button>'+
    '<button class="btn btn-danger btn-sm" onclick="deleteFromHistory('+h.id+')">✕</button></div></div>';
  }).join('');
}

function loadFromHistory(id){
  var h=historyData.find(function(x){return x.id===id;});if(!h)return;
  document.getElementById('c-name').value=h.client.name||'';
  document.getElementById('c-phone').value=h.client.phone||'';
  document.getElementById('c-email').value=h.client.email||'';
  document.getElementById('c-city').value=h.client.city||'';
  document.getElementById('c-addr').value=h.client.addr||'';
  document.getElementById('c-notes').value=h.client.notes||'';
  services=JSON.parse(JSON.stringify(h.services||[]));
  equipment=JSON.parse(JSON.stringify(h.equipment||[]));
  if(h.discount){document.getElementById('discountVal').value=h.discount.val||'';document.getElementById('discountType').value=h.discount.type||'percent';}
  showPage('new',null);
  jumpStep(2);renderEquipment();renderServices();toast('КП загружено ✓','success');
}

async function deleteFromHistory(id){
  if(!confirm('Удалить КП?'))return;
  var args=Object.assign(rpcAuthParams(),{p_quote_id:id});
  var res=await sb.rpc('kp_delete_quote',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка удаления'),'error');return;}
  historyData=historyData.filter(function(x){return x.id!==id;});
  updateHistoryBadge();renderHistory();
}

function updateHistoryBadge(){
  var el=document.getElementById('histBadge');
  el.textContent=historyData.length;
  el.style.background=(!currentKeyData.is_admin&&historyData.length>=MAX_KP)?'var(--danger)':'var(--accent)';
}

function resetForm(){
  if(!confirm('Начать новое КП?'))return;
  ['c-name','c-phone','c-email','c-city','c-addr','c-notes'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('discountVal').value='';
  if(document.getElementById('prepayVal'))document.getElementById('prepayVal').value='';
  services=[];equipment=[];quotePhotos=[];renderPhotos();jumpStep(1);renderEquipment();renderServices();
}

// ═══════════════ ADMIN ═══════════════
async function loadAdminData(){
  var res=await sb.rpc('kp_admin_data',rpcAuthParams());
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка загрузки'),'error');return;}
  var keys=res.data.keys||[];
  document.getElementById('statTotal').textContent=keys.filter(function(k){return!k.is_admin;}).length;
  document.getElementById('statActive').textContent=keys.filter(function(k){return k.is_active&&!k.is_admin&&daysLeft(k.expires_at)>0;}).length;
  document.getElementById('statBlocked').textContent=keys.filter(function(k){return(!k.is_active||daysLeft(k.expires_at)===0)&&!k.is_admin;}).length;
  document.getElementById('keysBody').innerHTML=keys.map(function(k){
    var dl=daysLeft(k.expires_at);
    var st;
    if(k.is_admin)st='<span class="status-badge status-admin">👑 Админ</span>';
    else if(!k.is_active)st='<span class="status-badge status-blocked">✕ Заблокирован</span>';
    else if(dl===0)st='<span class="status-badge status-blocked">⏰ Истёк</span>';
    else if(dl<=3)st='<span class="status-badge" style="background:rgba(245,158,11,.12);color:var(--warn)">⚠ '+dl+' дн.</span>';
    else st='<span class="status-badge status-active">✓ '+dl+' дн.</span>';
    var dev=k.device_id?'<span style="font-size:11px;color:var(--text3)">Привязан</span>':'<span style="font-size:11px;color:var(--success)">Свободен</span>';
    var lu=k.last_used?new Date(k.last_used).toLocaleDateString('ru-RU'):'—';
    var act='';
    if(!k.is_admin){
      act+='<input type="number" min="1" placeholder="Дней" id="d_'+k.id+'" style="width:65px;padding:4px 6px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)"> ';
      act+='<button class="btn btn-primary btn-sm" onclick="addDays('+k.id+')">+Дней</button> ';
      if(k.is_active)act+='<button class="btn btn-danger btn-sm" onclick="blockKey('+k.id+')">Блок</button> ';
      else act+='<button class="btn btn-success btn-sm" onclick="unblockKey('+k.id+')">Разблок</button> ';
      if(k.device_id)act+='<button class="btn btn-warn btn-sm" onclick="resetDevice('+k.id+')">Сброс</button> ';
      act+='<button class="btn btn-ghost btn-sm" onclick="deleteKey('+k.id+')">Удалить</button>';
    } else act+='<button class="btn btn-warn btn-sm" onclick="resetDevice('+k.id+')">Сброс устройства</button>';
    return'<tr>'+ 
      '<td><code style="font-size:12px;font-weight:700;color:var(--accent)">'+esc(k.key)+'</code></td>'+ 
      '<td>'+esc(k.master_name||'—')+'</td>'+ 
      '<td>'+st+'</td><td>'+dev+'</td>'+ 
      '<td style="color:var(--text2);font-size:12px">'+lu+'</td>'+ 
      '<td><div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">'+act+'</div></td></tr>';
  }).join('');
}

async function addDays(id){
  var inp=document.getElementById('d_'+id);
  var days=parseInt(inp.value);
  if(!days||days<1){toast('Введите количество дней','error');return;}
  var args=Object.assign(rpcAuthParams(),{p_target_id:id,p_days:days});
  var res=await sb.rpc('kp_admin_add_days',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка'),'error');return;}
  inp.value='';toast('+'+days+' дн. ✓','success');loadAdminData();
}

async function addKey(){
  var key=document.getElementById('newKey').value.trim().toUpperCase();
  var name=document.getElementById('newName').value.trim();
  if(!key){toast('Введите ключ','error');return;}
  var args=Object.assign(rpcAuthParams(),{p_new_key:key,p_master_name:name||'Мастер'});
  var res=await sb.rpc('kp_admin_add_key',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка: ключ уже существует?'),'error');return;}
  document.getElementById('newKey').value='';
  document.getElementById('newName').value='';
  toast('Ключ добавлен ✓','success');
  loadAdminData();
}

function genKey(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var part=function(len){var s='';for(var i=0;i<len;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;};
  document.getElementById('newKey').value='KLIM-'+part(4)+'-'+part(6);
}

async function blockKey(id){
  if(!confirm('Заблокировать ключ?'))return;
  var args=Object.assign(rpcAuthParams(),{p_target_id:id,p_is_active:false});
  var res=await sb.rpc('kp_admin_set_active',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка'),'error');return;}
  toast('Заблокирован','success');loadAdminData();
}

async function unblockKey(id){
  var args=Object.assign(rpcAuthParams(),{p_target_id:id,p_is_active:true});
  var res=await sb.rpc('kp_admin_set_active',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка'),'error');return;}
  toast('Разблокирован','success');loadAdminData();
}

async function resetDevice(id){
  if(!confirm('Сбросить привязку устройства? Мастер сможет войти с нового устройства.'))return;
  var args=Object.assign(rpcAuthParams(),{p_target_id:id});
  var res=await sb.rpc('kp_admin_reset_device',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка'),'error');return;}
  toast('Устройство сброшено ✓','success');loadAdminData();
}

async function deleteKey(id){
  if(!confirm('Удалить ключ навсегда?'))return;
  var args=Object.assign(rpcAuthParams(),{p_target_id:id});
  var res=await sb.rpc('kp_admin_delete_key',args);
  if(res.error||rpcFailed(res)){toast(rpcMsg(res,'Ошибка'),'error');return;}
  toast('Ключ удалён','success');loadAdminData();
}

// UTILS
function getClientData(){return{name:document.getElementById('c-name').value.trim(),phone:document.getElementById('c-phone').value.trim(),email:document.getElementById('c-email').value.trim(),city:document.getElementById('c-city').value.trim(),addr:document.getElementById('c-addr').value.trim(),notes:document.getElementById('c-notes').value.trim()};}
function getTotals(){var worksSub=services.reduce(function(s,x){return s+(parseFloat(x.price)||0)*(parseFloat(x.qty)||1);},0);var equipmentSub=equipment.reduce(function(s,x){return s+(parseFloat(x.price)||0)*(parseFloat(x.qty)||1);},0);var sub=worksSub+equipmentSub;var dv=parseFloat(document.getElementById('discountVal').value)||0;var dt=document.getElementById('discountType').value;var disc=dv>0?(dt==='percent'?sub*dv/100:dv):0;var prepay=parseFloat(document.getElementById('prepayVal')?document.getElementById('prepayVal').value:0)||0;return{worksSubtotal:worksSub,equipmentSubtotal:equipmentSub,subtotal:sub,discount:disc,prepay:prepay,grand:Math.max(0,sub-disc-prepay)};}
function fmt(n){return Number(n).toLocaleString('ru-RU')+' ₽';}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function generateQuoteNumber(){var d=new Date();return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes());}
function pad(n){return String(n).padStart(2,'0');}
var toastTimer;
function toast(msg,type){var el=document.getElementById('toast');el.textContent=msg;el.className='show '+(type||'success');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('show');},3000);}
