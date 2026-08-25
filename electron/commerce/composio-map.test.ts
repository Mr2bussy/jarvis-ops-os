// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { parseOrdersFromComposioResult, parseProductsFromComposioResult } from './composio-map';

describe('commerce composio parsers', () => {
  it('parses Shopify-like products', () => {
    const raw = {
      products: [
        {
          id: 1,
          title: 'Widget',
          variants: [{ sku: 'W-1', price: '19.99', inventory_quantity: 12 }],
        },
      ],
    };
    const rows = parseProductsFromComposioResult(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sku).toBe('W-1');
    expect(rows[0]?.price).toBeCloseTo(19.99);
    expect(rows[0]?.stock).toBe(12);
  });

  it('parses Shopify-like orders', () => {
    const raw = {
      orders: [
        {
          name: '#1001',
          customer: { email: 'buyer@example.com' },
          total_price: '42.50',
          financial_status: 'paid',
          fulfillment_status: 'fulfilled',
        },
      ],
    };
    const rows = parseOrdersFromComposioResult(raw);
    expect(rows[0]?.id).toBe('#1001');
    expect(rows[0]?.status).toBe('fulfilled');
    expect(rows[0]?.total).toBeCloseTo(42.5);
  });
});
