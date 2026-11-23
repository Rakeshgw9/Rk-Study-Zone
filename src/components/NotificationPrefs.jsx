import { useNotifications } from '../context/NotificationsContext'
import { useToast } from './Toast'

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
      <legend className="h6 fw-semibold">Notification preferences</legend>
      {rows.map(([key, label, hint]) => (
        <label className="nt-pref" key={key} htmlFor={`np-${key}`}>
          <span><b>{label}</b><small>{hint}</small></span>
          <input id={`np-${key}`} type="checkbox" role="switch" className="form-check-input" checked={!!prefs[key]} onChange={(e) => change(key, e.target.checked)} />
        </label>
      ))}
      <small className="text-muted-soft">Notifications are shown inside the app for 60 days. Email and browser push are not available yet.</small>
    </fieldset>
  )
}
