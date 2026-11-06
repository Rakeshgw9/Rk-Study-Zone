import { LuArrowUp, LuBookOpen, LuLogIn, LuUserPlus, LuUsers } from 'react-icons/lu'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN')

export default function StatCards({ stats }) {
  const cards = [
    { key: 'totalStudents', label: 'Total Students', icon: LuUsers, tone: 'purple' },
    { key: 'newEnrollments', label: 'New Enrollments', icon: LuUserPlus, tone: 'green', trend: 'This Month' },
    { key: 'studentLogins', label: 'Student Logins', icon: LuLogIn, tone: 'blue', trend: 'Today' },
    { key: 'activePortals', label: 'Active Portals', icon: LuBookOpen, tone: 'amber' },
  ]
  return (
    <div className="row g-2 g-md-3 mb-3 mb-md-4">
      {cards.map(({ key, label, icon: Icon, tone, trend }) => (
        <div className="col-6 col-xl-3" key={key}>
          <div className={`stat-card stat-${tone}`}>
            <span className="stat-icon"><Icon /></span>
            <div className="min-w-0">
              <div className="stat-label">{label}</div>
              <div className="d-flex align-items-baseline flex-wrap gap-2">
                <span className="stat-value">{fmt(stats[key])}</span>
                {trend && stats[key] > 0 && <span className="stat-trend"><LuArrowUp /> {trend}</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
