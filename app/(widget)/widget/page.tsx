import { Suspense } from 'react'
import WidgetChat from '@/components/widget/WidgetChat'

export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetChat />
    </Suspense>
  )
}
