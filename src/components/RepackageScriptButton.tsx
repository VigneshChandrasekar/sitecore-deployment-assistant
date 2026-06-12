'use client'

import { useState } from 'react'
import { Terminal } from 'lucide-react'
import type { ParsedPackage } from '@/lib/types'
import RepackageModal from './RepackageModal'

interface Props {
  pkg: ParsedPackage
}

export default function RepackageScriptButton({ pkg }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-red-600 text-white border-red-600 hover:bg-white hover:text-red-600 hover:border-red-600 transition-colors"
      >
        <Terminal className="h-3.5 w-3.5" />
        Retake Package
      </button>

      {modalOpen && (
        <RepackageModal
          pkg={pkg}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
