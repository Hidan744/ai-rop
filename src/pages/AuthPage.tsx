import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrandMark } from '@/components/icons/BrandMark'

export function AuthPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2 mb-8">
        <BrandMark className="size-5 text-brand-400" />
        <span className="text-sm font-semibold text-ink-50">AI РОП</span>
      </div>

      <Card className="w-full max-w-sm p-6">
        <p className="text-sm text-ink-400">
          Аккаунты и облачная синхронизация появятся в следующей версии. Сейчас AI РОП работает локально —
          все данные хранятся в этом браузере, без регистрации.
        </p>
      </Card>

      <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/app/dashboard')}>
        Продолжить без входа
      </Button>
    </div>
  )
}
