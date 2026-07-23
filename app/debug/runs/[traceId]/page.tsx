import { notFound } from "next/navigation";
import { TraceDebugger } from "@/components/TraceDebugger";

export default async function DebugRunPage({
  params
}: {
  params: Promise<{ traceId: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { traceId } = await params;
  return <TraceDebugger traceId={traceId} />;
}
