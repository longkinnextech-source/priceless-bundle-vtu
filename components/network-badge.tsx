import { NETWORK_BRAND, NETWORK_LABEL, type Network } from "@/lib/money";

export function NetworkBadge({ network, size = "md" }: { network: Network; size?: "sm" | "md" }) {
  const brand = NETWORK_BRAND[network];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold tracking-tight ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"
      }`}
      style={{ backgroundColor: brand.bg, color: brand.text }}
    >
      {NETWORK_LABEL[network]}
    </span>
  );
}
