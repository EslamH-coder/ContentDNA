import './globals.css'

export const metadata = {
  title: 'Channel Brain Dashboard',
  description: 'YouTube channel analytics and insights dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

