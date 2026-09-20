import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Vector Trader - Automated MetaTrader Execution Frontend',
  description: 'Modern automated MetaTrader execution frontend with real-time bridge status, risk parameters, live trade tracking, and Gemini AI trade overseer.',
  openGraph: {
    title: 'Vector Trader - Automated MetaTrader Execution Frontend',
    description: 'Modern automated MetaTrader execution frontend with real-time bridge status, risk parameters, live trade tracking, and Gemini AI trade overseer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vector Trader - Automated MetaTrader Execution Frontend',
    description: 'Modern automated MetaTrader execution frontend with real-time bridge status, risk parameters, live trade tracking, and Gemini AI trade overseer.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0f1d] text-slate-100 min-h-screen antialiased selection:bg-cyan-500/30 selection:text-cyan-200" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
