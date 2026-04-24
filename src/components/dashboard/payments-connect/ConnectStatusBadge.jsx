// src/components/dashboard/payments-connect/ConnectStatusBadge.jsx
// Small pill for "Not connected" / "Setup incomplete" / "Connected" shown in
// the dashboard card and payments page header.
export default function ConnectStatusBadge({ profile }) {
  const id = profile?.stripe_connect_account_id;
  const charges = !!profile?.stripe_connect_charges_enabled;
  const payouts = !!profile?.stripe_connect_payouts_enabled;
  const submitted = !!profile?.stripe_connect_details_submitted;

  if (!id) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-token-sm px-2 py-0.5 text-xs font-semibold bg-ink-tertiary/10 text-ink-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-tertiary" />
        Not connected
      </span>
    );
  }
  if (charges && payouts && submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-token-sm px-2 py-0.5 text-xs font-semibold bg-[#e8f5ec] text-[#0a8f3d]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0a8f3d]" />
        Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-token-sm px-2 py-0.5 text-xs font-semibold bg-[#fff7e6] text-[#b37400]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#b37400]" />
      Setup incomplete
    </span>
  );
}
