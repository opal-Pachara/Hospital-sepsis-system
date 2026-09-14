export default function LoadingSkeleton() {
  return (
    <div className="flex h-screen w-full bg-[#f8fafc] animate-pulse">
      {/* Sidebar Skeleton */}
      <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 border-b border-slate-200 flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
        <div className="flex-1 p-4 flex flex-col gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 border border-slate-200" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header Skeleton */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200" />
            <div className="w-8 h-8 rounded-full bg-slate-200" />
          </div>
        </div>

        {/* Content Area Skeleton */}
        <div className="flex-1 p-6 flex gap-6">
          {/* Middle Column */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="h-32 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-8 w-48 bg-slate-200 rounded" />
            </div>
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
               <div className="h-6 w-32 bg-slate-200 rounded" />
               <div className="h-12 bg-slate-100 rounded-xl mt-4" />
               <div className="h-12 bg-slate-100 rounded-xl" />
               <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
          </div>

          {/* Right Column */}
          <div className="w-[380px] flex flex-col gap-6">
            <div className="h-40 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="h-12 w-12 rounded-full bg-slate-200" />
                <div className="h-8 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="h-6 w-40 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
            
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
