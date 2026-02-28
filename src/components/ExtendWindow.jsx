import React from "react";

export default function ChannelDrawer({
  open,
  onClose,
  channels,
  activeChannelId,
  onSelectChannel,
}) {
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
        border-l border-zinc-800 bg-zinc-950 transition-transform duration-200
        ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-base font-semibol">Talkgroups</h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 hover:bg-zinc-800 text-white"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-zinc-400 mb-3">
            Select a channel to join/switch.
          </p>

          <div className="space-y-2">
            {channels.map((c) => {
              const active = c.id === activeChannelId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChannel(c.id)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition
                    ${
                      active
                        ? "border-blue-400 bg-blue-500/15"
                        : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-zinc-400">
                        {c.members} members
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "border-blue-400 text-blue-200"
                          : "border-zinc-700 text-zinc-300"
                      }`}
                    >
                      {active ? "Active" : "Join"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}