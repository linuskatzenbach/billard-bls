import type { Instrumentation } from "next";

// Fängt jeden Fehler ab, der auf dem Server beim Laden einer Seite oder in
// einer API-Route passiert – mit der echten Fehlermeldung. (Der Browser
// bekommt aus Sicherheitsgründen nur einen nichtssagenden Code wie
// „React error #441“.)
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("./lib/alert");
  const where = context.routeType === "route" ? `API ${request.path}` : `Seite ${request.path}`;
  await reportError(where, err);
};
