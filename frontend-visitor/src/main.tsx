import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/tokens.css'
import './index.css'
import './styles/visitor-theme-pages.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
