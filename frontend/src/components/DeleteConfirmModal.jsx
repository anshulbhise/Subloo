function DeleteConfirmModal({ isOpen, onClose, onConfirm, subscription, loading = false }) {
  if (!isOpen || !subscription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 text-xl font-bold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Delete Subscription
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
          Are you sure you want to remove{" "}
          <strong className="text-[var(--text-primary)]">
            {subscription.name || subscription.custom_name}
          </strong>{" "}
          from your subscriptions? All historical usage logs and renewal reminders for this service will be permanently deleted.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-xs font-semibold text-white transition disabled:opacity-60 shadow-xs"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Subscription</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
