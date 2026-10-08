import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// In dev the socket lives on the API server (localhost:3001). In production,
// set NEXT_PUBLIC_SOCKET_URL to your public origin and let nginx route
// /socket.io to the API container.
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:3001" : undefined);

/** Get the shared socket, connecting lazily with the current access token. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!SOCKET_URL) return null;

  const token = localStorage.getItem("accessToken");
  if (!token) {
    socket?.disconnect();
    socket = null;
    return null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
    // Re-authenticate if the token is swapped (refresh) while connected
    socket.on("connect_error", () => {
      const current = localStorage.getItem("accessToken");
      if (current && current !== token) socket?.auth && ((socket.auth as any).token = current);
    });
  }
  return socket;
}

/** Drop the connection (used on logout). */
export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
