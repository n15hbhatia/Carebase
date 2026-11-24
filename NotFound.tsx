import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import { EmptyState, Card } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default function NotFoundPage({ what = "page" }: { what?: string }) {
  return (
    <Card>
      <EmptyState icon={SearchX} title={`This ${what} could not be found`} description="It may have been deleted, or the link is out of date." action={<Button asChild variant="outline"><Link to="/">Back to overview</Link></Button>} />
    </Card>
  );
}
