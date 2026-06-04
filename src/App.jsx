import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { HouseholdProvider } from './context/HouseholdContext'
import { useHousehold } from './hooks/useHousehold'
import { AuthScreen } from './features/auth/AuthScreen'
import { HouseholdSetup } from './features/auth/HouseholdSetup'
import { Layout } from './components/Layout'
import { PantryPage } from './features/pantry/PantryPage'
import { PantryItemForm } from './features/pantry/PantryItemForm'
import { TagManager } from './features/pantry/TagManager'
import { RecipesPage } from './features/recipes/RecipesPage'
import { RecipeDetail } from './features/recipes/RecipeDetail'
import { RecipeForm } from './features/recipes/RecipeForm'
import { CookingFlow } from './features/recipes/CookingFlow'
import { PlanPage } from './features/plan/PlanPage'
import { ChatPage } from './features/chat/ChatPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { CartPage } from './features/cart/CartPage'
import { Button } from './components/Button'

function AppRoutes() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const { household, loading: hhLoading } = useHousehold()

  if (authLoading || hhLoading) {
    return <div className="loading-screen">Loading…</div>
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />
  }

  if (!household) {
    return (
      <div className="onboarding">
        <header className="onboarding__header">
          <h1>Table for Two</h1>
          <Button variant="ghost" onClick={signOut}>Sign out</Button>
        </header>
        <HouseholdSetup />
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout title="Table for Two" headerRight={<Button variant="ghost" onClick={signOut}>Sign out</Button>} />}>
        <Route index element={<Navigate to="/pantry" replace />} />
        <Route path="pantry" element={<PantryPage />} />
        <Route path="pantry/new" element={<PantryItemForm />} />
        <Route path="pantry/:id/edit" element={<PantryItemForm />} />
        <Route path="pantry/tags" element={<TagManager />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/new" element={<RecipeForm />} />
        <Route path="recipes/:id" element={<RecipeDetail />} />
        <Route path="recipes/:id/edit" element={<RecipeForm />} />
        <Route path="recipes/:id/cook" element={<CookingFlow />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="cart" element={<CartPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <HouseholdProvider user={user}>
        <AppRoutes />
      </HouseholdProvider>
    </BrowserRouter>
  )
}
