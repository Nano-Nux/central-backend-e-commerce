import { LinePayProvider } from './line-pay.provider';

describe('LinePayProvider', () => {
  it('rejects hosted sessions until the real LINE Pay integration is implemented', async () => {
    const provider = new LinePayProvider({
      isLinePayEnabled: () => true,
    } as never);

    await expect(
      provider.createHostedSession({
        orderId: '11111111-1111-1111-1111-111111111111',
        paymentId: '22222222-2222-2222-2222-222222222222',
        amount: '100',
        currency: 'THB',
        returnUrl: 'https://store.example.com/checkout/success',
      }),
    ).rejects.toThrow('LINE Pay hosted checkout is not available in this build');
  });
});
