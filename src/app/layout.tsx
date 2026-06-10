import type { Metadata } from 'next'
import './globals.css'
import AppNav from '@/components/AppNav'

export const metadata: Metadata = {
  title: 'Sitecore Deployment Assistant',
  description: 'Pre-deployment risk analysis and environment snapshot tool for Sitecore',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <AppNav />
        <div className="flex-1 flex overflow-hidden min-h-0">
          {children}
        </div>
      </body>
    </html>
  )
}
