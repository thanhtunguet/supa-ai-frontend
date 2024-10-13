
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Chat from './Chat.tsx'
import './main.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chat />
  </StrictMode>,
)
