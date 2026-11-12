
import { escapeHtml } from './id'
import { bridgeScript } from './editBridge'

/**
 * Builds a full HTML document for a sandboxed iframe.
 * - Loads selected packages (CSS/JS)
 * - Reports content height to the parent
 * - Allows scrolling inside the iframe when content is long
 */
export function buildFrameDoc({
  frameId,
  html = '',
  css = '',
  js = '',
  packages = [],
  baseCss = '',
  bodyClass = '',
  copyButtons = false,
  padding = 0,
  editMode = null,
  imageTools = false
}) {
  const cssLinks = packages
    .filter((p) => p.type === 'css')
    .map((p) => `<link rel="stylesheet" href="${escapeHtml(p.url)}">`)
    .join('\n')

  const jsLinks = packages
    .filter((p) => p.type === 'js')
    .map((p) => `<script src="${escapeHtml(p.url)}"></script>`)
    .join('\n')

  const inits = packages
    .filter((p) => p.init)
    .map((p) => `try{${p.init}}catch(e){}`)
    .join('\n')

  const safeJs = js.replace(/<\/script/gi, '<\\/script')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<link rel="preconnect" href="https://fonts.googleapis.com">

<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&family=Noto+Sans+Oriya:wght@400;600&display=swap"
  rel="stylesheet"
>

${cssLinks}

<style>
/* IFRAME DOCUMENT SCROLLING */
html {
  width: 100%;
  min-height: 100%;
  margin: 0;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  scrollbar-width: thin;
}

body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  box-sizing: border-box;

  font-family: Inter, 'Noto Sans Oriya', system-ui, sans-serif;
  color: #0f172a;
  line-height: 1.6;

  padding: ${Number(padding) || 0}px;

  overflow-x: hidden !important;
  overflow-y: visible !important;
}

* {
  box-sizing: border-box;
}

img {
  max-width: 100%;
  height: auto;
}

.rk-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  font: 600 12px Inter, sans-serif;
  background: #1e293b;
  color: #fff;
  border: 0;
  border-radius: 6px;
  padding: 4px 9px;
  cursor: pointer;
  opacity: .85;
}

pre {
  position: relative;
}

${baseCss}
</style>

<style>
${css.replace(/<\/style/gi, '<\\/style')}
</style>

</head>

<body class="${escapeHtml(bodyClass)}">

${html}

${jsLinks}

<script>
(function () {
  var id = ${JSON.stringify(frameId)};

  /* Report content height to parent */
  function send() {
    var h = Math.ceil(
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      )
    );

    parent.postMessage({
      rkFrame: id,
      height: h
    }, '*');
  }

  window.addEventListener('load', function () {
    send();
    setTimeout(send, 300);
    setTimeout(send, 1200);
  });

  if (window.ResizeObserver) {
    new ResizeObserver(send).observe(document.body);
  }

  window.addEventListener('resize', send);

  /* External links */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');

    if (
      a &&
      !a.target &&
      /^https?:/.test(a.getAttribute('href'))
    ) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });

  ${
    copyButtons
      ? `
  document.querySelectorAll('pre').forEach(function (pre) {
    var b = document.createElement('button');

    b.className = 'rk-copy';
    b.textContent = 'Copy';

    b.onclick = function () {
      var t = pre.innerText.replace(/Copy$/, '');
      var ta = document.createElement('textarea');

      ta.value = t;
      document.body.appendChild(ta);
      ta.select();

      try {
        document.execCommand('copy');
        b.textContent = 'Copied';
      } catch (e) {
        b.textContent = 'Select & copy';
      }

      ta.remove();

      setTimeout(function () {
        b.textContent = 'Copy';
      }, 1500);
    };

    pre.appendChild(b);
  });
  `
      : ''
  }

  /* Error reporting */
  window.onerror = function (m, src, line) {
    parent.postMessage({
      rkFrame: id,
      error: String(m) + (
        line ? ' (line ' + Math.max(1, line - 1) + ')' : ''
      )
    }, '*');

    return false;
  };

  window.addEventListener('unhandledrejection', function (e) {
    parent.postMessage({
      rkFrame: id,
      error: 'Unhandled promise rejection: ' +
        String(e.reason && e.reason.message || e.reason)
    }, '*');
  });

  /* Console reporting */
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
    var o = console[k];

    console[k] = function () {
      try {
        var t = [].map.call(arguments, function (a) {
          try {
            return typeof a === 'object' && a !== null
              ? JSON.stringify(a)
              : String(a);
          } catch (e) {
            return String(a);
          }
        }).join(' ');

        parent.postMessage({
          rkFrame: id,
          console: {
            level: k,
            text: t.slice(0, 2000)
          }
        }, '*');
      } catch (e) {}

      return o.apply(console, arguments);
    };
  });

})();
</script>

<script>
${bridgeScript(frameId, { editMode, imageTools })}
</script>

<script>
${inits}
</script>

<script>
try {
${safeJs}
} catch (e) {
  parent.postMessage({
    rkFrame: ${JSON.stringify(frameId)},
    error: String(e && e.message || e)
  }, '*');
}
</script>

</body>
</html>`
}
