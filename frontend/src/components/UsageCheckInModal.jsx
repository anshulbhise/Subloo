import { useState } from "react";
import api from "../services/api";

function UsageCheckInModal({ isOpen, onClose, onSaved, subscription }) {
  const [usageScore, setUsageScore] = useState(() =>
      subscription?.usage_score !== null && subscription?.usage_score !== undefined
        ? subscription.usage_score
        : 50
    );
  const [feedbackAction, setFeedbackAction] = useState("keep");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !subscription) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.checkInUsage(subscription.id, {
        usage_score: Number(usageScore),
        feedback_action: feedbackAction,
        notes: notes.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save usage check-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4 bg-[var(--bg-surface-secondary)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Usage Check-In
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {subscription.name || subscription.custom_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 text-red-500 border border-red-500/20 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Usage Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                How frequently do you use this?
              </label>
              <span className="text-sm font-bold text-[var(--accent-text)]">
                {usageScore}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={usageScore}
              onChange={(e) => setUsageScore(e.target.value)}
              className="w-full accent-[var(--accent-primary)] cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1.5">
              <span>0% (Rarely)</span>
              <span>50% (Occasionally)</span>
              <span>100% (Daily)</span>
            </div>
          </div>

          {/* Intention Pills */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Current Intention
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "keep", label: "Keep" },
                { id: "downgrade", label: "Downgrade" },
                { id: "cancel", label: "Cancel" },
              ].map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setFeedbackAction(act.id)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${feedbackAction === act.id
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
                    }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Check-In Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Planning to cancel after finishing this project..."
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] outline-none transition"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white px-5 py-2 text-xs font-semibold transition shadow-xs disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Check-In</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsageCheckInModal;
