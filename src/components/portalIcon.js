import { LuBookOpen, LuGraduationCap, LuLanguages, LuSchool } from 'react-icons/lu'
import { FaPersonRunning } from 'react-icons/fa6'

/** Pick an icon + colour for a portal based on its name / category */
export function portalVisual(p) {
  const n = (p.name || '').toLowerCase()
  if (n.includes('physical') || n.includes('sport')) return { Icon: FaPersonRunning, tone: 'teal' }
  if (n.includes('odia') || n.includes('language') || n.includes('english')) return { Icon: LuLanguages, tone: 'pink' }
  if (p.category === 'recruitment') return { Icon: LuGraduationCap, tone: 'purple' }
  if (p.category === 'pedagogy') return { Icon: LuSchool, tone: 'amber' }
  return { Icon: LuBookOpen, tone: 'blue' }
}
