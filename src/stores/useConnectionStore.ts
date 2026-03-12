import { create } from "zustand";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface ConnectionState {
  status: ConnectionStatus;
  lastMessageAt: Date | null;
  reconnectCount: number;
  setStatus: (status: ConnectionStatus) => void;
  setLastMessage: () => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  lastMessageAt: null,
  reconnectCount: 0,

  setStatus: (status) => set({ status }),

  setLastMessage: () => set({ lastMessageAt: new Date() }),

  incrementReconnect: () =>
    set((state) => ({ reconnectCount: state.reconnectCount + 1 })),

  resetReconnect: () => set({ reconnectCount: 0 }),
}));
