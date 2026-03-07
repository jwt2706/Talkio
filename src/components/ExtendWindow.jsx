import React from "react";
import { FiSettings } from "react-icons/fi";

export default function ChannelDrawer({
  open,
  onClose,
  channels,
  activeChannelId,
  onSelectChannel,
  onOpenAdmin,
  onLogout,
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[320px] max-w-[90vw]
        transition-transform duration-200
        ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ backgroundColor: "#3E4553" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/30">
          <h2 className="text-base font-semibold text-white">Talkgroups</h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAdmin?.()}
              title="Admin Portal"
              aria-label="Open Admin Portal"
              className="rounded-xl border border-black/30 bg-black/20 px-3 py-2 hover:bg-black/30 text-white"
            >
              <FiSettings className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={onClose}
              className="rounded-xl border border-black/30 bg-black/20 px-3 py-2 hover:bg-black/30 text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4 flex flex-col h-[calc(100%-64px)] relative">
          <p className="text-sm text-white/70 mb-3">
            Select a channel to join/switch.
          </p>

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
                      {/* no user count here */}
                      <p className="text-xs text-white/60">Tap to switch</p>
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
        </div>
        {/* Logout button pinned to bottom */}
        <div className="absolute left-0 bottom-0 w-full p-4 bg-gradient-to-t from-[#3E4553] via-[#3E4553]/90 to-transparent">
          <button
            onClick={() => onLogout?.()}
            className="w-full rounded-xl border border-black/30 bg-[#445876] text-white shadow-md px-4 py-2 transition"
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}