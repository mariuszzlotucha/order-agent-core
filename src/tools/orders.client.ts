import { Injectable } from '@nestjs/common';

export interface OrderInfo {
  orderId: string;
  phone: string;
  status: string;
  eta: string | null;
  carrier: string | null;
}

// Abstrakcja, zeby runner ewaluacji mogl podstawic mock_orders
export abstract class OrdersClient {
  abstract find(orderId: string): Promise<OrderInfo | null>;
}

// Zaklada endpoint GET {ORDERS_API_URL}/orders/:id -> OrderInfo (dopasuj do swojego API).
// Konto/token tylko do odczytu.
@Injectable()
export class HttpOrdersClient extends OrdersClient {
  async find(orderId: string): Promise<OrderInfo | null> {
    const res = await fetch(`${process.env.ORDERS_API_URL}/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${process.env.ORDERS_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Orders API status ${res.status}`);
    return (await res.json()) as OrderInfo;
  }
}
