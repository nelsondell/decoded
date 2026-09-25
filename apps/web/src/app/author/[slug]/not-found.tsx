import { Notice } from "@/components/page-shell";

export default function NotFound() {
  return (
    <Notice
      kicker="404"
      title="Author not found"
      body="Authors are re-clustered weekly, so some slugs change."
      action={{ href: "/authors", label: "← All authors" }}
    />
  );
}
