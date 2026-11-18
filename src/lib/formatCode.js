/** Prettier (standalone build, loaded on demand) for HTML / CSS / JS; JSON uses the built-in serializer. */
export async function formatCode(code, lang) {
  if (lang === 'json') return JSON.stringify(JSON.parse(code), null, 2)
  const [prettier, html, postcss, babel, estree] = await Promise.all([
    import('prettier/standalone'), import('prettier/plugins/html'), import('prettier/plugins/postcss'), import('prettier/plugins/babel'), import('prettier/plugins/estree'),
  ])
  const parser = { html: 'html', css: 'css', js: 'babel' }[lang] || 'babel'
  const out = await prettier.format(code, { parser, plugins: [html, postcss, babel, estree], tabWidth: 2, printWidth: 100, singleQuote: true, semi: false, htmlWhitespaceSensitivity: 'ignore' })
  return out.replace(/\n+$/, '\n')
}
