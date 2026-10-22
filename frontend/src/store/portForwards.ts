import { create } from 'zustand'
import type { PortForwardInfo } from '@/lib/api'

type State = {
  list: PortForwardInfo[]
  setList: (list: PortForwardInfo[]) => void
}

export const usePortForwards = create<State>((set) => ({
  list: [],
  setList: (list) => set({ list }),
}))
