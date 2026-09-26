import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// HashRouter — GitHub Pages отдаёт статику без server-side rewrite,
// поэтому прямые переходы/обновление на /app/dashboard дали бы 404 с BrowserRouter.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
