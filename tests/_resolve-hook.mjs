// Lets plain Node import the app's extension-less ES modules ("./id" → "./id.js") for the unit tests.
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) return next(`${specifier}.js`, context)
    throw e
  }
}
