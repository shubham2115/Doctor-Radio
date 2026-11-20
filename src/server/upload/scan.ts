import net from "node:net";
import type { FileScanStatus } from "@prisma/client";

/**
 * Malware scanning through ClamAV's clamd INSTREAM protocol (CLAMAV_HOST / CLAMAV_PORT).
 * Without a configured scanner files stay PENDING; publication is blocked for PENDING files unless
 * ALLOW_UNSCANNED=true (development only).
 */
export const scannerConfigured = () => Boolean(process.env.CLAMAV_HOST);

export function scanBuffer(data: Buffer): Promise<FileScanStatus> {
  if (!scannerConfigured()) return Promise.resolve("PENDING");
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: process.env.CLAMAV_HOST!, port: Number(process.env.CLAMAV_PORT ?? 3310) });
    let reply = "";
    socket.setTimeout(30_000, () => {
      socket.destroy();
      resolve("PENDING");
    });
    socket.on("error", () => resolve("PENDING"));
    socket.on("data", (d) => (reply += d.toString()));
    socket.on("close", () => resolve(reply.includes("FOUND") ? "INFECTED" : reply.includes("OK") ? "CLEAN" : "PENDING"));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let i = 0; i < data.length; i += 64 * 1024) {
        const chunk = data.subarray(i, i + 64 * 1024);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        socket.write(len);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
    });
  });
}
