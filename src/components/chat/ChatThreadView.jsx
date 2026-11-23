import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LuImagePlus, LuLoaderCircle, LuSend, LuX } from 'react-icons/lu'
import { checkRate, MAX_IMAGE_URL, MAX_MESSAGE, messageState, stateLabel, validateMessage } from '../../lib/chat'
import { relativeTime, absoluteTime } from '../../lib/notifications'
import { uploadImageFile } from '../../services/mediaService'
import { useToast } from '../Toast'

const safeImage = (u) => (typeof u === 'string' && (/^https:\/\//i.test(u) || /^data:image\/(png|jpe?g|webp);base64,/i.test(u)) ? u : '')

/** Messages + composer shared by the student chat box and the teacher inbox.
 *  Text is rendered by React (escaped, pre-wrap) — never as HTML. */
export default function ChatThreadView({ role, messages, otherReadAt = 0, otherTyping = false, hasMore, onLoadOlder, onSend, onTyping, disabled = false, placeholder = 'Type your message…', loading = false, children }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [image, setImage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const history = useRef([])
  const listRef = useRef(null)
  const stick = useRef(true)
  const fileRef = useRef(null)
  const lastId = messages[messages.length - 1]?.id

  // auto-scroll to the latest message (unless the reader scrolled up to read older ones)
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [lastId, otherTyping])
  const onScroll = () => { const el = listRef.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }
  useEffect(() => { stick.current = true }, [role])

  const pickImage = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploading(true)
    try {
      const url = await uploadImageFile(f, { folder: 'chat', max: 1000, quality: 0.7, maxSizeMB: 6 })
      if (url.length > MAX_IMAGE_URL && url.startsWith('data:')) throw new Error('That screenshot is too large. Crop it and try again.')
      setImage(url)
    } catch (err) { toast(err.message || 'Could not attach the screenshot', 'error') } finally { setUploading(false) }
  }

  const send = async () => {
    if (sending || disabled) return
    const v = validateMessage(text, { hasImage: !!image })
    if (!v.ok) return toast(v.error, 'error')
    const rate = checkRate(history.current)
    if (!rate.ok) return toast(`You are sending messages too fast. Try again in ${Math.ceil(rate.retryInMs / 1000)} s.`, 'error')
    setSending(true)
    try {
      await onSend({ text: v.text, imageUrl: image })
      history.current = rate.recent
      setText(''); setImage(''); stick.current = true
    } catch (err) {
      toast(err.message || 'Message not sent', 'error', { action: { label: 'Retry', onClick: send } })
    } finally { setSending(false) }
  }
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }

  return (
    <div className="chat-view">
      <div className="chat-log" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
        {hasMore && <button type="button" className="chat-older" onClick={onLoadOlder}>Load older messages</button>}
        {loading && !messages.length && <div className="chat-empty"><LuLoaderCircle className="spin" /> Loading…</div>}
        {!loading && !messages.length && children}
        {messages.map((m) => {
          const mine = m.senderRole === role
          const img = safeImage(m.imageUrl)
          return (
            <div key={m.id} className={`chat-msg ${mine ? 'mine' : 'theirs'}`}>
              <div className="chat-bubble">
                {img && <a href={img} target="_blank" rel="noopener noreferrer"><img src={img} alt="Attached screenshot" loading="lazy" decoding="async" /></a>}
                {m.text && <p>{m.text}</p>}
              </div>
              <small className="chat-meta" title={absoluteTime(m.at)}>
                {relativeTime(m.at) || 'now'}{mine && ` · ${stateLabel[messageState(m, otherReadAt)]}`}
              </small>
            </div>
          )
        })}
        {otherTyping && <div className="chat-typing" aria-live="polite"><span /><span /><span /><i className="visually-hidden">typing…</i></div>}
      </div>

      <div className="chat-composer">
        {image && (
          <div className="chat-attach"><img src={safeImage(image)} alt="Screenshot to send" /><button type="button" className="icon-btn" onClick={() => setImage('')} aria-label="Remove screenshot"><LuX /></button></div>
        )}
        <div className="chat-row">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickImage} />
          <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} disabled={disabled || uploading} aria-label="Attach a screenshot" title="Attach a screenshot">
            {uploading ? <LuLoaderCircle className="spin" /> : <LuImagePlus />}
          </button>
          <textarea
            className="chat-input" rows={1} value={text} maxLength={MAX_MESSAGE} placeholder={placeholder} disabled={disabled} aria-label="Message"
            onChange={(e) => { setText(e.target.value); onTyping?.() }} onKeyDown={onKey}
          />
          <button type="button" className="btn ui-btn ui-btn-primary chat-send" onClick={send} disabled={disabled || sending || uploading || (!text.trim() && !image)} aria-label="Send message">
            {sending ? <LuLoaderCircle className="spin" /> : <LuSend />}
          </button>
        </div>
        <small className="chat-count" aria-live="off">{text.length}/{MAX_MESSAGE} · Enter to send, Shift+Enter for a new line</small>
      </div>
    </div>
  )
}
