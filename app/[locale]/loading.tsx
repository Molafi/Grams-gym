export default function Loading() {
  return (
    <div className="mx-auto max-w-[1320px] space-y-6 px-5 pb-24 pt-40 sm:px-8 lg:px-12" aria-busy="true">
      <div className="skeleton h-14 w-2/3" />
      <div className="skeleton h-6 w-1/2" />
      <div className="grid gap-5 pt-8 md:grid-cols-3">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
