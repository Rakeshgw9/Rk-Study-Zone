/* Runs JSON parse + pretty-print off the main thread so a multi-MB paste never freezes the UI. */
self.onmessage = (e) => {
  const { id, text, indent = 2 } = e.data || {}
  try {
    self.postMessage({ id, ok: true, text: JSON.stringify(JSON.parse(text), null, indent) })
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) })
  }
}
