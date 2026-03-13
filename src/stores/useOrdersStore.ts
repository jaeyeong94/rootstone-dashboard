import { create } from "zustand";

export interface OpenOrder {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  price: string;
  qty: string;
  cumExecQty: string;
  orderStatus: string;
  createdTime: string;
}

interface OrdersState {
  orders: OpenOrder[];
  connected: boolean;
  setOrders: (orders: OpenOrder[]) => void;
  upsertOrder: (order: OpenOrder) => void;
  removeOrder: (orderId: string) => void;
  setConnected: (v: boolean) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  connected: false,
  setOrders: (orders) => set({ orders }),
  upsertOrder: (order) =>
    set((state) => {
      const idx = state.orders.findIndex((o) => o.orderId === order.orderId);
      if (idx >= 0) {
        const next = [...state.orders];
        next[idx] = order;
        return { orders: next };
      }
      return { orders: [order, ...state.orders] };
    }),
  removeOrder: (orderId) =>
    set((state) => ({
      orders: state.orders.filter((o) => o.orderId !== orderId),
    })),
  setConnected: (connected) => set({ connected }),
}));
