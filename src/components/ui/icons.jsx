import {
  LuBookOpen, LuBrain, LuCalculator, LuClipboardList, LuDumbbell, LuFlaskConical, LuGlobe, LuGraduationCap,
  LuHeartPulse, LuLanguages, LuLayers, LuLeaf, LuLightbulb, LuMusic, LuPalette, LuTrophy, LuUsers,
} from 'react-icons/lu'
import { FaPersonRunning } from 'react-icons/fa6'

export const ICONS = {
  layers: LuLayers, book: LuBookOpen, graduation: LuGraduationCap, runner: FaPersonRunning, heart: LuHeartPulse,
  dumbbell: LuDumbbell, people: LuUsers, trophy: LuTrophy, brain: LuBrain, flask: LuFlaskConical, globe: LuGlobe,
  calculator: LuCalculator, palette: LuPalette, music: LuMusic, language: LuLanguages, leaf: LuLeaf,
  lightbulb: LuLightbulb, clipboard: LuClipboardList,
}
export const IconOf = ({ name, ...p }) => { const C = ICONS[name] || LuLayers; return <C {...p} /> }
