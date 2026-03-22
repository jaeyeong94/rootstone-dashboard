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
  setOrders: (orders: OpenOrder[]) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
}));
