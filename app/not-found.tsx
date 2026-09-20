import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f1d] text-slate-100 p-4">
      <div className="p-4 rounded-xl bg-[#111827] border border-[#1f2937] max-w-md w-full text-center space-y-4 shadow-xl">
        <h2 className="text-xl font-bold text-white tracking-wide">404 - Terminal View Not Found</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          The requested path does not exist in Vector Trader. Please navigate back to the main execution dashboard.
        </p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
