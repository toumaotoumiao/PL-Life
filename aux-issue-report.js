/* Stage133: offline, no external dependencies or storage of sensitive details. */
(function (global) {
  'use strict';
  const VERSION = '8.1.12.319';
  const SCHEMA = 26;
  const TYPES = new Set(['TypeError','ReferenceError','SyntaxError','QuotaExceededError','AbortError','NotFoundError','DataError','InvalidStateError','SecurityError','UnknownError','Error']);
  function safeType(err) {
    const raw = String(err && err.name || 'Error');
    return TYPES.has(raw) ? raw : 'Error';
  }
  function report({level='warning',code='AUX-UNKNOWN',area='辅助工具',action='执行操作',phase='操作中',state='操作结果待核对',next='请检查现有档案和本机备份后重试',error=null}={}) {
    // code / area / action / phase / state / next must be developer-controlled constants.
    const id=String(code).replace(/[^A-Z0-9_-]/g,'').slice(0,50)||'AUX-UNKNOWN';
    return [
      'PL收集梦想生活 · 错误报告',
      '问题编号：'+id,
      '严重程度：'+(['info','warning','critical'].includes(level)?level:'warning'),
      '发生位置：'+area,
      '执行操作：'+action,
      '执行阶段：'+phase,
      '当前状态：'+state,
      '建议处理：'+next,
      '错误类型：'+safeType(error),
      '程序版本：v'+VERSION,
      '数据结构：schema'+SCHEMA,
      '报告时间：'+new Date().toISOString(),
      '隐私说明：不包含档案正文、文件名、浏览器路径、异常消息、堆栈或上传文件内容。'
    ].join('\n');
  }
  function download(text){
    if(!text)return false;
    const blob=new Blob(['\ufeff',text],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    try {a.href=url;a.download='PL-Life_匿名错误报告_'+new Date().toISOString().slice(0,10)+'.txt';document.body.appendChild(a);a.click();return true;}
    finally {a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  async function copy(text){
    if(!text)return false;
    try {await navigator.clipboard.writeText(text);return true;}catch(_){}
    const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;
    try{ok=document.execCommand('copy');}catch(_){}finally{ta.remove();}
    return ok;
  }
  // Share the same visible/accessible disabled reason with every auxiliary tool.
  // Restore the caller's original description and title when the control is enabled.
  function setDisabled(control,disabled,reason=''){
    if(!control)return;
    if(!Object.prototype.hasOwnProperty.call(control.dataset,'auxOriginalTitle')){
      control.dataset.auxOriginalTitle=control.getAttribute('title')||'';
      control.dataset.auxOriginalDescription=control.getAttribute('aria-describedby')||'';
      control.dataset.auxOriginalAriaLabel=control.getAttribute('aria-label')||'';
    }
    const off=!!disabled;
    control.disabled=off;
    if(off&&reason){
      control.title=reason;
      control.setAttribute('data-disabled-reason',reason);
      control.setAttribute('aria-label',(control.dataset.auxOriginalAriaLabel||control.textContent||'操作').trim()+'（不可用：'+reason+'）');
    }else{
      const original=control.dataset.auxOriginalTitle;
      if(original)control.setAttribute('title',original);else control.removeAttribute('title');
      control.removeAttribute('data-disabled-reason');
      // Restore exactly the original accessible name, without suffix accumulation.
      if(control.dataset.auxOriginalAriaLabel)
        control.setAttribute('aria-label',control.dataset.auxOriginalAriaLabel);
      else control.removeAttribute('aria-label');
    }
  }
  global.PlAuxIssueReport=Object.freeze({report,copy,download,safeType,setDisabled});
})(window);
