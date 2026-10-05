"use client";

import { copyText } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { IconCopy } from "@/components/icons";

export default function CopyLinkButton() {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={async () => toast.show((await copyText(window.location.href)) ? "Link copied to clipboard" : "Couldn't copy the link")}
      >
        <IconCopy width={16} height={16} /> Copy link
      </button>
      {toast.node}
    </>
  );
}
