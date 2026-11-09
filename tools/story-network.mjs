// The VPS has no IPv6 route. Node 20's automatic family selection can abandon
// a slow IPv4 handshake for an unreachable IPv6 address, while curl succeeds.
// Apply this before any photo, OpenAI or Telegram fetch in these CLI processes.
import dns from "node:dns";
import net from "node:net";

dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily?.(false);
