import { Notice } from "@/components/page-shell";

export default function NotFound() {
  return (
    <Notice
      kicker="404"
      title="Institution not found"
      body="Institutions are re-clustered weekly, so some slugs change."
      action={{ href: "/institutions", label: "← All institutions" }}
    />
  );
}
