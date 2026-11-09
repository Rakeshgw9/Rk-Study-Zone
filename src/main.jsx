import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/theme.css'
// import './styles/cms.css'
import App from './App.jsx'
<link
  rel="stylesheet"
  href="http://127.0.0.1:5500/style_protal.css"
/>

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
