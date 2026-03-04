import React, { useMemo, useState } from "react";

export default function ChannelDrawer({
  open,
  onClose,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel, // NEW: function(newChannel) => void
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");

  const canCreate = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const exists = (channels || []).some(
      (c) => c.name?.toLowerCase() === trimmed.toLowerCase()
    );
    return !exists;
  }, [name, channels]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const newChannel = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: trimmed,
      members: 1,
    };

    onCreateChannel?.(newChannel);
    setName("");
    setShowAdd(false);
  };

  const closeAdd = () => {
    setName("");
    setShowAdd(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[320px] max-w-[90vw]
        transition-transform duration-200
        ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ backgroundColor: "#3E4553" }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/30">
          <h2 className="text-base font-semibold text-white">Talkgroups</h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-black/30 bg-black/20 px-3 py-2 hover:bg-black/30 text-white"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col h-[calc(100%-64px)]">
          <p className="text-sm text-white/70 mb-3">
            Select a channel to join/switch.
          </p>

          {/* Channel list */}
          <div className="space-y-2 flex-1 overflow-auto">
            {(channels || []).map((c) => {
              const active = c.id === activeChannelId;

              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChannel(c.id)}
                  className="w-full text-left rounded-2xl px-4 py-3 transition"
                  style={{ backgroundColor: "#445876" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-white/60">{c.members} members</p>
                    </div>

                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "border-white text-white"
                          : "border-black/40 text-white/80"
                      }`}
                    >
                      {active ? "Active" : "Join"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Add Channel Button */}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 w-full rounded-2xl px-4 py-3 text-white text-sm flex items-center justify-center gap-2 transition hover:opacity-95"
            style={{ backgroundColor: "#445876" }}
          >
            <span className="text-lg leading-none">+</span>
            <span>Add Channel</span>
          </button>
        </div>
      </aside>

      {/* Add Channel Modal */}
      <div
        className={`fixed inset-0 z-[60] flex items-center justify-center px-4 transition-opacity ${
          showAdd ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={closeAdd}
        />

        <div className="relative w-full max-w-sm rounded-xl border border-black/30 bg-[#E5E5E5] shadow-lg p-4">
          <h3 className="text-base font-semibold text-black mb-2">
            Add Channel
          </h3>

          <label className="text-sm text-black/80">Channel name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Team 1"
            className="mt-1 w-full rounded-md border border-black/30 bg-white px-3 py-2 text-black outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) handleCreate();
              if (e.key === "Escape") closeAdd();
            }}
            autoFocus
          />

          {/* validation */}
          {!canCreate && name.trim() !== "" && (
            <p className="mt-2 text-xs text-red-600">
              This channel name already exists.
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={closeAdd}
              className="rounded-md border border-black/30 bg-white px-3 py-2 text-sm text-black hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || !canCreate}
              className={`rounded-md px-3 py-2 text-sm text-white ${
                !name.trim() || !canCreate
                  ? "bg-black/30 cursor-not-allowed"
                  : "bg-[#3E4553] hover:opacity-95"
              }`}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </>
  );
}