export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-bronze" />
        <p className="mt-4 text-xs uppercase tracking-[1px] text-text-muted">
          Loading
        </p>
      </div>
    </div>
  );
}
