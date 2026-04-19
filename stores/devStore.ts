import { create } from 'zustand';

type DevState = {
  impersonatedMemberId: string | null;
  setImpersonatedMemberId: (id: string | null) => void;
};

export const useDevStore = create<DevState>((set) => ({
  impersonatedMemberId: null,
  setImpersonatedMemberId: (id) => set({ impersonatedMemberId: id }),
}));
