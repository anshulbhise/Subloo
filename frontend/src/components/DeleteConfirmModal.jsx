function DeleteConfirmModal({ isOpen, onClose, onConfirm, subscription, loading = false }) {
  if (!isOpen || !subscription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E8EEEB] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 text-xl font-bold">
            !
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#172B2A]">
              Delete Subscription
            </h3>
            <p className="text-xs text-[#82918B]">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="text-sm text-[#718079] leading-relaxed mb-6">
          Are you sure you want to remove{" "}
          <strong className="text-[#172B2A]">
            {subscription.name || subscription.custom_name}
          </strong>{" "}
          from your subscriptions? All historical usage logs for this subscription will be permanently removed.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[#E8EEEB] px-5 py-2.5 text-sm font-semibold text-[#718079] hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60 shadow-sm"
          >
            {loading ? "Deleting..." : "Delete Subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
