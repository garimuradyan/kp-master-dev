/* Документы: договор + акт. Подключается после app.js и documentTemplates.js. */
(function(){
  var lastDocContext = null;

  window.openDocumentsModal = function(){
    if(typeof validateClient === 'function' && !validateClient()) return;
    if(!window.services || !services.length){toast('Добавьте хотя бы одну работу для документов','error');return;}
    lastDocContext = buildDocumentContextFromCurrentQuote();
    var modal = document.getElementById('documentsModal');
    if(modal) modal.style.display = 'flex';
  };

  window.closeDocumentsModal = function(){
    var modal = document.getElementById('documentsModal');
    if(modal) modal.style.display = 'none';
  };

  window.printSelectedDocuments = function(){
    var contract = document.getElementById('docContractCheck') && document.getElementById('docContractCheck').checked;
    var act = document.getElementById('docActCheck') && document.getElementById('docActCheck').checked;
    if(!contract && !act){toast('Выберите договор или акт','error');return;}
    var ctx = lastDocContext || buildDocumentContextFromCurrentQuote();
    printDocumentsByTypes(ctx,{contract:contract,act:act});
    closeDocumentsModal();
  };

  window.buildDocumentContextFromCurrentQuote = function(){
    var c = typeof getClientData === 'function' ? getClientData() : {};
    var t = typeof getTotals === 'function' ? getTotals() : {subtotal:0,discount:0,prepay:0,grand:0};
    return {
      client: c,
      master: Object.assign({address:(window.settings && (settings.address || settings.city)) || ''}, window.settings || {}),
      services: JSON.parse(JSON.stringify(window.services || [])),
      totals: Object.assign({}, t),
      today: new Date().toLocaleDateString('ru-RU'),
      num: typeof generateQuoteNumber === 'function' ? generateQuoteNumber() : String(Date.now()),
      color: (window.settings && settings.color) || '#0066ff',
      esc: typeof esc === 'function' ? esc : function(s){return String(s||'');},
      fmt: typeof fmt === 'function' ? fmt : function(n){return n+' ₽';}
    };
  };

  window.printDocumentsByTypes = function(ctx, types){
    var parts = [];
    if(types.contract && window.KP_DOCUMENT_TEMPLATES && KP_DOCUMENT_TEMPLATES.contract) parts.push(KP_DOCUMENT_TEMPLATES.contract(ctx));
    if(types.act && window.KP_DOCUMENT_TEMPLATES && KP_DOCUMENT_TEMPLATES.act) parts.push(KP_DOCUMENT_TEMPLATES.act(ctx));
    if(!parts.length){toast('Нет шаблонов документов','error');return;}
    var html = buildDocumentPrintHtml(ctx, parts.join(''));
    var w = window.open('','_blank');
    if(w){w.document.write(html);w.document.close();}
    else toast('Разрешите всплывающие окна','error');
  };

  function buildDocumentPrintHtml(ctx, body){
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Документы № '+ctx.num+'</title>'+docStyles(ctx.color)+'</head><body><button class="pbtn" onclick="window.print()">💾 Сохранить как PDF</button>'+body+'</body></html>';
  }

  function docStyles(color){
    return '<style>'+ 
      '*{box-sizing:border-box}html,body{margin:0;background:#f3f4f6;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}'+
      'body{padding:18px;font-size:12px;line-height:1.36}.pbtn{display:block;width:100%;max-width:820px;margin:0 auto 16px;padding:14px;border:0;border-radius:10px;background:'+color+';color:#fff;font-size:15px;font-weight:800;cursor:pointer}'+
      '.doc-page{width:100%;max-width:820px;margin:0 auto 18px;background:#fff;padding:34px 40px;border-radius:12px;box-shadow:0 8px 30px rgba(15,23,42,.12);page-break-after:always;overflow:hidden}'+
      '.doc-page:last-child{page-break-after:auto}.doc-topline{display:flex;justify-content:space-between;gap:16px;font-size:11px;color:#555;margin-bottom:8px}.doc-title{text-align:center;text-transform:none;letter-spacing:.1px;font-weight:900;font-size:17px;line-height:1.22;margin-bottom:14px}.doc-meta{text-align:center;color:#666;margin-bottom:14px}'+
      'h2{font-size:12.5px;margin:13px 0 6px;color:#111;text-align:center}p{margin:7px 0;overflow-wrap:anywhere}.doc-contract-body{white-space:pre-line;margin-top:8px;overflow-wrap:anywhere}.doc-contract-body::first-line{font-weight:900}table{width:100%;border-collapse:collapse;margin:10px 0 12px;table-layout:fixed}th{background:'+color+';color:#fff;font-size:10px;text-align:left;padding:6px 6px}td{border-bottom:1px solid #e5e7eb;padding:6px;font-size:10.5px;vertical-align:top;overflow-wrap:anywhere}th:nth-child(1),td:nth-child(1){width:30px;text-align:center}th:nth-child(3),td:nth-child(3),th:nth-child(5),td:nth-child(5){width:86px;text-align:right}th:nth-child(4),td:nth-child(4){width:46px;text-align:center}'+
      '.doc-total{display:flex;justify-content:flex-end;gap:18px;align-items:center;margin:8px 0 12px;font-size:13px}.doc-total b{font-size:15px;color:'+color+'}.doc-sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:16px}.doc-sign-grid>div{overflow-wrap:anywhere}.doc-sign-title{margin-top:12px;font-weight:700}.doc-sign-placeholder{margin-top:12px;color:#111}.doc-signature-img{display:block;max-width:170px;max-height:58px;object-fit:contain;margin-top:4px}.compact br{line-height:1.25}'+
      '@media(max-width:640px){body{padding:10px}.doc-page{padding:22px 16px;border-radius:8px}.doc-title{font-size:15px}th,td{font-size:9.5px;padding:5px 4px}th:nth-child(3),td:nth-child(3),th:nth-child(5),td:nth-child(5){width:68px}.doc-sign-grid{grid-template-columns:1fr;gap:14px}.doc-topline{flex-direction:column;gap:2px}}'+
      '@media print{body{background:#fff;padding:0}.pbtn{display:none}.doc-page{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0;page-break-after:always}.doc-page:last-child{page-break-after:auto}@page{size:A4;margin:12mm 12mm}}'+
      '</style>';
  }

  window.addEventListener('DOMContentLoaded',function(){
    var modal = document.getElementById('documentsModal');
    if(modal) modal.addEventListener('click',function(e){if(e.target===modal)closeDocumentsModal();});
  });
})();
