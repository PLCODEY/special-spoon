import { eventBus } from "@/lib/eventBus";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client already disconnected
        }
      };

      // Send initial ping so client knows it's connected
      send({ type: "connected" });

      const onDraftUpdate = (payload: unknown) => {
        send({ type: "draft_update", payload });
      };

      eventBus.on("draft_update", onDraftUpdate);

      // Keep-alive ping every 25s to prevent proxies from closing the connection
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 25000);

      cleanup = () => {
        eventBus.off("draft_update", onDraftUpdate);
        clearInterval(keepAlive);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering (Railway uses nginx)
    },
  });
}
