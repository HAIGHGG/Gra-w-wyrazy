import { useLocation } from 'react-router-dom';
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-muted-foreground/45">404</h1>
            <div className="h-0.5 w-16 bg-border mx-auto"></div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground">
              Nie znaleziono strony
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Strona <span className="font-medium text-foreground">"{pageName}"</span> nie istnieje w tej aplikacji.
            </p>
          </div>

          <div className="pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Wróć do gry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
