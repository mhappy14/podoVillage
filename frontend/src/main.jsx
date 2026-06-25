import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import {BrowserRouter as Router} from 'react-router-dom'
import { AuthProvider } from './components/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <Router>
      <React.StrictMode>
         <AuthProvider>
            <App />
         </AuthProvider>
     </React.StrictMode>
  </Router>

)
