import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "next-themes";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Game from './pages/Game';

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="gra-w-wyrazy:theme"
    >
      <Router>
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </ThemeProvider>
  )
}

export default App
