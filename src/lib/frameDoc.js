import { escapeHtml } from './id'

/**
 * Builds a full HTML document for a sandboxed iframe.
 * - loads selected packages (css/js)
 * - reports its height to the parent so the iframe auto-resizes
 */
export function buildFrameDoc({ frameId, html = '', css = '', js = '', packages = [], baseCss = '', bodyClass = '', copyButtons = false, padding = 0 }) {
  const cssLinks = packages.filter((p) => p.type === 'css').map((p) => `<link rel="stylesheet" href="${escapeHtml(p.url)}">`).join('\n')
  const jsLinks = packages.filter((p) => p.type === 'js').map((p) => `<script src="${escapeHtml(p.url)}"></script>`).join('\n')
  const inits = packages.filter((p) => p.init).map((p) => `try{${p.init}}catch(e){}`).join('\n')
  const safeJs = js.replace(/<\/script/gi, '<\\/script')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&family=Noto+Sans+Oriya:wght@400;600&display=swap" rel="stylesheet">
${cssLinks}
<style>
html,body{margin:0;background:transparent}
body{font-family:Inter,'Noto Sans Oriya',system-ui,sans-serif;color:#0f172a;line-height:1.6;padding:${Number(padding) || 0}px;overflow:hidden}
img{max-width:100%;height:auto}
.rk-copy{position:absolute;top:8px;right:8px;font:600 12px Inter,sans-serif;background:#1e293b;color:#fff;border:0;border-radius:6px;padding:4px 9px;cursor:pointer;opacity:.85}
pre{position:relative}
${baseCss}
</style>
<style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head><body class="${escapeHtml(bodyClass)}">
${html}
${jsLinks}
<script>
(function(){
  var id=${JSON.stringify(frameId)};
  function send(){var h=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight));parent.postMessage({rkFrame:id,height:h},'*')}
  window.addEventListener('load',function(){send();setTimeout(send,300);setTimeout(send,1200)});
  if(window.ResizeObserver){new ResizeObserver(send).observe(document.body)}
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a&&!a.target&&/^https?:/.test(a.getAttribute('href'))){a.target='_blank';a.rel='noopener'}});
  ${copyButtons ? `document.querySelectorAll('pre').forEach(function(pre){var b=document.createElement('button');b.className='rk-copy';b.textContent='Copy';b.onclick=function(){var t=pre.innerText.replace(/Copy$/,'');var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');b.textContent='Copied'}catch(e){b.textContent='Select & copy'}ta.remove();setTimeout(function(){b.textContent='Copy'},1500)};pre.appendChild(b)});` : ''}
  window.onerror=function(m){parent.postMessage({rkFrame:id,error:String(m)},'*')};
})();
</script>
<script>${inits}</script>
<script>try{
${safeJs}
}catch(e){parent.postMessage({rkFrame:${JSON.stringify(frameId)},error:String(e&&e.message||e)},'*')}</script>
</body></html>`
}
