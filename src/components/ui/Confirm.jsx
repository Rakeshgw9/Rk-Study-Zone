import { createContext, useCallback, useContext, useState } from 'react'
import { LuTriangleAlert } from 'react-icons/lu'
import Modal from '../Modal'

const Ctx = createContext(async () => false)

/** const confirm = useConfirm(); if (await confirm({title, message, danger:true})) ... */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), [])
  const close = (v) => { state?.resolve(v); setState(null) }
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal show={!!state} onClose={() => close(false)} className="ui-modal ui-confirm" labelledBy="confirm-title">
        {state && (
          <div className="p-4">
            <div className="d-flex gap-3 align-items-start">
              <span className={`confirm-icon ${state.danger ? 'danger' : ''}`}><LuTriangleAlert /></span>
              <div>
                <h2 id="confirm-title" className="h5 fw-bold mb-1">{state.title || 'Are you sure?'}</h2>
                <p className="mb-0 text-soft">{state.message}</p>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button className="btn ui-btn ui-btn-secondary" onClick={() => close(false)}>{state.cancelText || 'Cancel'}</button>
              <button className={`btn ui-btn ${state.danger ? 'ui-btn-danger' : 'ui-btn-primary'}`} onClick={() => close(true)} autoFocus>{state.confirmText || 'Confirm'}</button>
            </div>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  )
}
// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => useContext(Ctx)
