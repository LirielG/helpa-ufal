import { create } from "zustand";

interface ActionRegisterState {
  isOpen: boolean;
  onSuccessCallback?: () => void;
  openRegisterModal: (onSuccessCallback?: () => void) => void;
  closeRegisterModal: () => void;
}

export const useActionRegisterStore = create<ActionRegisterState>((set) => ({
  isOpen: false,
  onSuccessCallback: undefined,
  openRegisterModal: (onSuccessCallback) =>
    set({ isOpen: true, onSuccessCallback }),
  closeRegisterModal: () =>
    set({ isOpen: false, onSuccessCallback: undefined }),
}));