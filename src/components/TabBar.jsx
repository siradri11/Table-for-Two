import { NavLink } from 'react-router-dom'
import './TabBar.css'

const tabs = [
  { to: '/pantry', label: 'Pantry', icon: '🥬' },
  { to: '/recipes', label: 'Recipes', icon: '📖' },
  { to: '/plan', label: 'Plan', icon: '📅' },
  { to: '/chat', label: 'Chat', icon: '✨' },
  { to: '/profile', label: 'Profile', icon: '👤' },
  { to: '/cart', label: 'Cart', icon: '🛒' },
]

export function TabBar() {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `tab-bar__item ${isActive ? 'tab-bar__item--active' : ''}`}
        >
          <span className="tab-bar__icon">{tab.icon}</span>
          <span className="tab-bar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
