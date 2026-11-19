import { useState } from "react";
import api from "../services/api";

function UsageCheckInModal({ isOpen, onClose, onSaved, subscription }) {
  if (!isOpen || !subscription) return null;

  const [usageScore, setUsageScore] = useState(
    subscription.usage_score !== null && subscription.usage_score !== undefined
      ? subscription.usage_score
      : 50
  );
  const [feedbackAction, setFeedbackAction] = useState("keep");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E8EEEB] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8EEEB] px-6 py-4 bg-[#FAFBFB]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F5F0] text-[#087F65] font-bold">
              ◈
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172B2A]">
                Usage Check-In
              </h3>
              <p className="text-xs text-[#82918B]">
                {subscription.name || subscription.custom_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#718079]">
                How frequently do you use this?
              </label>
              <span className="text-sm font-bold text-[#087F65]">
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
              className="w-full accent-[#087F65] cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-[#82918B] mt-1">
              <span>0% (Never)</span>
              <span>50% (Occasionally)</span>
              <span>100% (Daily)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-2">
              Your Current Intention
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "keep", label: "Keep It", desc: "Essential service" },
                { id: "downgrade", label: "Downgrade", desc: "Overpaying for tier" },
                { id: "cancel", label: "Cancel", desc: "No longer needed" },
                { id: "not_useful", label: "Not Useful", desc: "Evaluating value" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setFeedbackAction(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    feedbackAction === opt.id
                      ? "border-[#087F65] bg-[#E8F5F0] text-[#087F65]"
                      : "border-[#E8EEEB] bg-white text-[#718079] hover:bg-gray-50"
                  }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-[#82918B]">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#718079] mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Switched to free tier"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[#E8EEEB] px-3.5 py-2 text-sm text-[#172B2A] focus:border-[#087F65] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8EEEB]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[#E8EEEB] px-4 py-2 text-sm font-semibold text-[#718079] hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#087F65] px-5 py-2 text-sm font-semibold text-white hover:bg-[#066A55] transition disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Check-In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UsageCheckInModal;
