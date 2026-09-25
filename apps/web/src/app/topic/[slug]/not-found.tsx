import { Notice } from "@/components/page-shell";

export default function NotFound() {
  return (
    <Notice
      kicker="404"
      title="Topic not found"
      body="Topics are re-clustered weekly, so some slugs change."
      action={{ href: "/topics", label: "← All topics" }}
    />
  );
}
