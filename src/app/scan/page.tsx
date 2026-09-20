import type { Metadata } from "next";
import { ScanFlow } from "@/components/scan-flow";

export const metadata: Metadata = { title: "Scanner un objet" };

export default function ScanPage() {
  return <ScanFlow />;
}
