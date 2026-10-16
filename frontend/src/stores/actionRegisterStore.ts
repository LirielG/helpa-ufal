import { create } from "zustand";

interface ActionRegisterState {
  isOpen: boolean;
  onSuccessCallback?: () => void;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  setOnSuccessCallback: (onSuccessCallback?: () => void) => void;
}

// The success callback belongs to whichever page is mounted (today only the
// Dashboard, to reload its feed), so opening or closing the modal must not
// touch it.
export const useActionRegisterStore = create<ActionRegisterState>((set) => ({
  isOpen: false,
  onSuccessCallback: undefined,
  openRegisterModal: () => set({ isOpen: true }),
  closeRegisterModal: () => set({ isOpen: false }),
  setOnSuccessCallback: (onSuccessCallback) => set({ onSuccessCallback }),
}));
