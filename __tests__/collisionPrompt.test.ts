const mockAlert = jest.fn();
// Platform is included only because jest-expo's own setup (expo-modules-core, triggered by
// the lazy global.fetch install) requires `react-native` internally and calls Platform.select
// during this file's module graph — collisionPrompt.ts itself imports nothing but Alert.
jest.mock('react-native', () => ({
  Alert: { alert: (...a: unknown[]) => mockAlert(...a) },
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
}));

import { confirmAdoptExistingAccount } from '@/src/lib/collisionPrompt';

beforeEach(() => { jest.clearAllMocks(); });

describe('confirmAdoptExistingAccount', () => {
  // Nothing to lose — never interrupt.
  it('resolves true without prompting when no trips are owned', async () => {
    await expect(confirmAdoptExistingAccount(0)).resolves.toBe(true);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('resolves true when the user confirms', async () => {
    mockAlert.mockImplementation((_t, _m, btns) => btns[1].onPress());
    await expect(confirmAdoptExistingAccount(2)).resolves.toBe(true);
  });

  it('resolves false when the user cancels', async () => {
    mockAlert.mockImplementation((_t, _m, btns) => btns[0].onPress());
    await expect(confirmAdoptExistingAccount(2)).resolves.toBe(false);
  });

  it('counts trips correctly in the message', async () => {
    mockAlert.mockImplementation((_t, _m, btns) => btns[0].onPress());
    await confirmAdoptExistingAccount(1);
    expect(mockAlert.mock.calls[0][1]).toContain('1 trip behind');
  });
});
