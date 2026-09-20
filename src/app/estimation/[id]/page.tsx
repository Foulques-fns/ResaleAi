import type { Metadata } from "next";
import { EstimationView } from "@/components/estimation-view";

export const metadata: Metadata = { title: "Estimation" };

export default async function EstimationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EstimationView id={id} />;
}
