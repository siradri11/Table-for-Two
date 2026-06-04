import { Outlet } from 'react-router-dom'
import { TabBar } from './TabBar'
import { PwaInstallBanner } from './PwaInstallBanner'
import './Layout.css'

export function Layout({ title, headerRight }) {
  return (
    <div className="layout">
      <header className="layout__header">
        <h1 className="layout__title">{title}</h1>
        {headerRight}
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
      <TabBar />
      <PwaInstallBanner />
    </div>
  )
}
