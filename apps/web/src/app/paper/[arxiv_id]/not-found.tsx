import { Notice } from "@/components/page-shell";

export default function NotFound() {
  return (
    <Notice
      kicker="404"
      title="Paper not found"
      body="This arXiv ID isn’t in our index yet."
      action={{ href: "/", label: "← Back to feed" }}
    />
  );
}
