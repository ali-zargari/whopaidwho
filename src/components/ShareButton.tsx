"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";
export default function ShareButton() {
  const [status, setStatus] = useState("");
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Link copied");
    } catch {
      setStatus("Copy the URL from your address bar");
    }
  }
  return (
    <div className="share-control">
      <button className="secondary-button" onClick={share}>
        {status === "Link copied" ? <Check size={16} /> : <Link2 size={16} />}
        Share profile
      </button>
      <span role="status">{status}</span>
    </div>
  );
}
