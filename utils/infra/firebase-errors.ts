import { toast } from "sonner"

/**
 * Centralised Firebase error surface. Most Firebase listeners in the codebase
 * were written with `onError` callbacks that only `console.error(...)` — which
 * means when rules reject a read or the network goes down, the UI just silently
 * shows empty state and the user has no idea why nothing loads.
 *
 * Call this from every Firebase `onValue` / `get` / write catch block to
 * surface the error to the user. It de-dupes by message within a short window
 * so a listener retrying 50 times doesn't spam the screen.
 */

const recentMessages = new Map<string, number>()
const DEDUPE_WINDOW_MS = 5_000

function shouldShow(key: string): boolean {
  const now = Date.now()
  const last = recentMessages.get(key) ?? 0
  if (now - last < DEDUPE_WINDOW_MS) return false
  recentMessages.set(key, now)
  // Opportunistic cleanup — keep the map small.
  if (recentMessages.size > 32) {
    for (const [k, t] of recentMessages) {
      if (now - t > DEDUPE_WINDOW_MS) recentMessages.delete(k)
    }
  }
  return true
}

interface FirebaseLikeError {
  code?: string
  message?: string
  name?: string
}

function asFirebaseError(err: unknown): FirebaseLikeError {
  if (typeof err === "object" && err !== null) {
    return err as FirebaseLikeError
  }
  return { message: String(err) }
}

/**
 * Map a Firebase error to a user-friendly message + severity. Returns null if
 * the error is not worth surfacing (e.g., cancelled operations).
 */
export function explainFirebaseError(err: unknown): { title: string; detail?: string; severity: "error" | "warning" } | null {
  const e = asFirebaseError(err)
  const code = e.code ?? ""
  const message = e.message ?? ""

  // Permission denials — usually a rules misconfiguration or an expired auth state.
  if (code === "PERMISSION_DENIED" || message.includes("PERMISSION_DENIED") || message.includes("permission_denied")) {
    return {
      title: "Access denied",
      detail: "Your session may have expired, or you don't have permission for this action.",
      severity: "error",
    }
  }

  // Network / offline — transient, warning not error.
  if (code === "NETWORK_ERROR" || message.includes("network") || message.toLowerCase().includes("offline")) {
    return {
      title: "Network error",
      detail: "Reconnecting…",
      severity: "warning",
    }
  }

  // Unavailable / quota exceeded.
  if (code === "UNAVAILABLE" || message.includes("unavailable")) {
    return {
      title: "Service temporarily unavailable",
      detail: "Please try again in a moment.",
      severity: "warning",
    }
  }

  // Everything else — only surface in dev to avoid noise from expected errors
  // (e.g., the host's periodic getPrivateRole calls that non-hosts silently swallow).
  if (process.env.NODE_ENV !== "production" && (message || code)) {
    return {
      title: "Unexpected error",
      detail: message || code,
      severity: "error",
    }
  }

  return null
}

/**
 * Surface a Firebase error as a toast. Pass an optional `context` string to
 * disambiguate: e.g., "Loading messages", "Sending reaction". The context is
 * used both as the toast title and as the dedupe key, so repeated failures in
 * the same context coalesce into one toast.
 */
export function reportFirebaseError(err: unknown, context?: string): void {
  const explained = explainFirebaseError(err)
  if (!explained) return

  const title = context ? `${context}: ${explained.title}` : explained.title
  const dedupeKey = `${context ?? ""}|${title}`
  if (!shouldShow(dedupeKey)) return

  const toastFn = explained.severity === "error" ? toast.error : toast.warning
  toastFn(title, { description: explained.detail })
}
