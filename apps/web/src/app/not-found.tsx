import { Notice } from "@/components/page-shell";

export default function NotFound() {
  return (
    <Notice
      kicker="404"
      title="Nothing printed here"
      body="This page doesn’t exist, or it moved when the index was rebuilt."
      action={{ href: "/", label: "← Today’s offprints" }}
    />
  );
}
