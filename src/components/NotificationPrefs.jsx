import { LuBellOff, LuMessageSquare, LuUserPlus, LuClipboardCheck, LuRefreshCw } from 'react-icons/lu'
import { useNotifications } from '../context/NotificationsContext'
import { useToast } from './Toast'

const ICONS = { muteContent: LuRefreshCw, muteChat: LuMessageSquare, muteEnrol: LuUserPlus, examSubmit: LuClipboardCheck }

/** Mute switches (+ teacher options). Email / push are intentionally not offered in this release. */
export default function NotificationPrefs({ staff = false }) {
  const { prefs, setPrefs } = useNotifications()
  const toast = useToast()
  const rows = [
    ['muteContent', 'Mute content updates', 'Hide “teacher updated a chapter” notices.', false],
    ['muteChat', 'Mute chat messages', 'Hide notices about doubts and replies.', false],
    ...(staff ? [['muteEnrol', 'Mute new-enrolment notices', 'Hide “a student joined your portal”.', false], ['examSubmit', 'Notify me when a student submits an exam', 'Off by default.', true]] : []),
  ]
  const change = async (key, value) => {
    try { await setPrefs({ [key]: value }) } catch (e) { toast(e.message || 'Could not save the preference', 'error') }
  }
  return (
    <fieldset className="nt-prefs">
      <legend className="nt-prefs-title"><LuBellOff aria-hidden="true" /> Notification preferences</legend>
      <div className="nt-pref-list">
        {rows.map(([key, label, hint]) => {
          const Icon = ICONS[key] || LuBellOff
          const on = !!prefs[key]
          return (
            <label className={`nt-pref${on ? ' is-on' : ''}`} key={key} htmlFor={`np-${key}`}>
              <span className="nt-pref-ico" aria-hidden="true"><Icon /></span>
              <span className="nt-pref-text"><b>{label}</b><small>{hint}</small></span>
              <input id={`np-${key}`} type="checkbox" role="switch" className="nt-sw-input" checked={on} onChange={(e) => change(key, e.target.checked)} />
              <span className="nt-sw" aria-hidden="true" />
            </label>
          )
        })}
      </div>
      <small className="nt-pref-foot">Notifications are shown inside the app for 60 days. Email and browser push are not available yet.</small>
    </fieldset>
  )
}
