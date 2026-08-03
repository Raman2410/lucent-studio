import { Link } from "react-router-dom";
import { Aperture } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * NotFound — catch-all for any route that doesn't match, so
 * mistyped or dead links get a real page instead of a blank
 * space under the header/footer.
 */
export default function NotFound() {
  return (
    <div className="container-page py-24 max-w-lg mx-auto text-center">
      <Aperture className="h-8 w-8 text-signature mx-auto mb-6" strokeWidth={1.5} />
      <p className="meta-caption mb-2">404</p>
      <h1 className="font-display text-3xl text-ink mb-4">Page not found</h1>
      <p className="text-mist text-[15px] leading-relaxed mb-8">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Button variant="signature" size="lg" asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
