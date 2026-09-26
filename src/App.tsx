import { Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/pages/LandingPage'
import { AuthPage } from '@/pages/AuthPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { FunnelPage } from '@/pages/FunnelPage'
import { ManagersPage } from '@/pages/ManagersPage'
import { DealsPage } from '@/pages/DealsPage'
import { ForecastPage } from '@/pages/ForecastPage'
import { SettingsPage } from '@/pages/SettingsPage'

function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="funnel" element={<FunnelPage />} />
          <Route path="managers" element={<ManagersPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  )
}

export default App
