import { PROFILE_LIMITS, SPECIALIZATION_SUGGESTIONS } from '../lib/profile'

/** Shared teacher fields (Settings page + "Complete your profile" modal). `full` adds the optional extras. */
export default function TeacherProfileFields({ values, errors = {}, onChange, full = false, idPrefix = 'tp', requireSpecialization = true, showName = true }) {
  const f = (k) => ({ id: `${idPrefix}-${k}`, value: values[k] ?? '', onChange: (e) => onChange(k, e.target.value), maxLength: PROFILE_LIMITS[k], 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${idPrefix}-${k}-err` : undefined })
  const Err = ({ k }) => (errors[k] ? <small id={`${idPrefix}-${k}-err`} className="text-danger-soft d-block mt-1" role="alert">{errors[k]}</small> : null)
  return (
    <div className="row g-2">
      {showName && (
      <div className="col-12">
        <label className="ui-label" htmlFor={`${idPrefix}-name`}>Full name <span className="text-danger-soft" aria-hidden="true">*</span></label>
        <input className="ui-input" placeholder="Your full name" autoComplete="name" {...f('name')} />
        <Err k="name" />
      </div>
      )}
      <div className="col-md-6">
        <label className="ui-label" htmlFor={`${idPrefix}-specialization`}>Specialization {requireSpecialization && <span className="text-danger-soft" aria-hidden="true">*</span>}</label>
        <input className="ui-input" list={`${idPrefix}-spec-list`} placeholder="e.g. Mathematics" {...f('specialization')} />
        <datalist id={`${idPrefix}-spec-list`}>{SPECIALIZATION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        <small className="text-muted-soft d-block mt-1">Shown to students on your portals. Type your own or pick a suggestion.</small>
        <Err k="specialization" />
      </div>
      <div className="col-md-6">
        <label className="ui-label" htmlFor={`${idPrefix}-qualification`}>Qualification <small className="text-muted-soft">(optional)</small></label>
        <input className="ui-input" placeholder="e.g. M.Sc., B.Ed." {...f('qualification')} />
        <Err k="qualification" />
      </div>
      {full && (
        <>
          <div className="col-md-4">
            <label className="ui-label" htmlFor={`${idPrefix}-experienceYears`}>Experience (years)</label>
            <input className="ui-input" inputMode="numeric" {...f('experienceYears')} />
            <Err k="experienceYears" />
          </div>
          <div className="col-md-8">
            <label className="ui-label" htmlFor={`${idPrefix}-subjects`}>Subjects taught</label>
            <input className="ui-input" placeholder="Algebra, Geometry, …" {...f('subjects')} />
          </div>
          <div className="col-md-6">
            <label className="ui-label" htmlFor={`${idPrefix}-languages`}>Languages</label>
            <input className="ui-input" placeholder="English, Odia, Hindi" {...f('languages')} />
          </div>
          <div className="col-md-6">
            <label className="ui-label" htmlFor={`${idPrefix}-website`}>Website / social link</label>
            <input className="ui-input" type="url" inputMode="url" placeholder="https://…" {...f('website')} />
            <Err k="website" />
          </div>
          <div className="col-12">
            <label className="ui-label" htmlFor={`${idPrefix}-availability`}>Availability note</label>
            <input className="ui-input" placeholder="e.g. Usually replies within a day, 6–9 pm" {...f('availability')} />
          </div>
        </>
      )}
    </div>
  )
}
