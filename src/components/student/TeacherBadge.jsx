import { LuUser } from 'react-icons/lu'

/** Teacher name + photo + specialization, read from the portal's denormalised owner* fields. */
export default function TeacherBadge({ portal, size = 28, showQualification = false }) {
  const name = portal?.ownerName || 'Teacher'
  return (
    <span className="teacher-badge">
      <span className="tb-photo" style={{ width: size, height: size }}>
        {portal?.ownerPhoto ? <img src={portal.ownerPhoto} alt="" loading="lazy" decoding="async" width={size} height={size} /> : <LuUser aria-hidden="true" />}
      </span>
      <span className="tb-text">
        <b>{name}</b>
        {portal?.ownerSpecialization && <small>{portal.ownerSpecialization}</small>}
        {showQualification && portal?.ownerQualification && <small>{portal.ownerQualification}</small>}
      </span>
    </span>
  )
}
