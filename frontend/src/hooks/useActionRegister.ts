import { useActionRegisterStore } from "../stores/actionRegisterStore";

export function useActionRegister() {
  const isOpen = useActionRegisterStore((state) => state.isOpen);
  const onSuccessCallback = useActionRegisterStore(
    (state) => state.onSuccessCallback,
  );
  const openRegisterModal = useActionRegisterStore(
    (state) => state.openRegisterModal,
  );
  const closeRegisterModal = useActionRegisterStore(
    (state) => state.closeRegisterModal,
  );

  return {
    isOpen,
    onSuccessCallback,
    openRegisterModal,
    closeRegisterModal,
  };
}
