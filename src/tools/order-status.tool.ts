import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { OrdersClient } from './orders.client';

const NOT_FOUND = {
  found: false,
  message: 'Nie znaleziono zamowienia dla tego numeru telefonu.',
};

const normalize = (p: string) => p.replace(/[^0-9]/g, '');

export function createOrderStatusTool(description: string, orders: OrdersClient) {
  return tool(
    async ({ order_id }, config) => {
      // Numer telefonu pochodzi z systemu, nie od modelu
      const phone = config?.configurable?.phone as string | undefined;
      if (!phone) return JSON.stringify(NOT_FOUND);

      try {
        const order = await orders.find(order_id);

        // Weryfikacja wlasnosci w kodzie, niezalezna od decyzji modelu.
        // Ta sama odpowiedz dla "brak" i "cudze", zeby nie zdradzac istnienia zamowienia.
        if (!order || normalize(order.phone) !== normalize(phone)) {
          return JSON.stringify(NOT_FOUND);
        }

        // Zwracamy tylko pola potrzebne do odpowiedzi
        return JSON.stringify({
          found: true,
          status: order.status,
          eta: order.eta,
          carrier: order.carrier,
        });
      } catch {
        return JSON.stringify({ found: false, message: 'Chwilowy problem z systemem zamowien.' });
      }
    },
    {
      name: 'order_status',
      description, // z bundla (secret manager)
      schema: z.object({
        order_id: z.string().regex(/^[A-Za-z0-9-]{1,20}$/),
      }),
    },
  );
}
