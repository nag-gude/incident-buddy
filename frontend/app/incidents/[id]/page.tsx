import { notFound } from "next/navigation";
import { IncidentLiveDashboard } from "@/components/IncidentLiveDashboard";
import { ApiError, apiGet } from "@/lib/api";
import type { IncidentDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: { id: string } }) {
  try {
    const data = await apiGet<IncidentDetail>(`/api/incidents/${params.id}`);
    return <IncidentLiveDashboard initial={data} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
