"use client";

import { useEffect } from "react";
import { captureTokenFromUrl } from "@/lib/demoToken";

/** Captures ?t= from the judging URL on every page load (including /admin). */
export function DemoTokenBootstrap() {
  useEffect(() => {
    captureTokenFromUrl();
  }, []);
  return null;
}
