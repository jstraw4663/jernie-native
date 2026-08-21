const mockAlert = jest.fn();
// Platform is included only because jest-expo's own setup (expo-modules-core, triggered by
// the lazy global.fetch install) requires `react-native` internally and calls Platform.select
// during this file's module graph — collisionPrompt.ts itself imports nothing but Alert.
jest.mock('react-native', () => ({
  Alert: { alert: (...a: unknown[]) => mockAlert(...a) },
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
}));

import { confirmCollision } from '@/src/lib/collisionPrompt';

beforeEach(() => { jest.clearAllMocks(); });

function press(label: string) {
  mockAlert.mockImplementation((_t, _m, btns: { text: string; onPress: () => void }[]) => {
    const btn = btns.find(b => b.text === label);
    if (!btn) throw new Error(`no button labelled "${label}" — got ${btns.map(b => b.text).join(', ')}`);
    btn.onPress();
  });
}

describe('confirmCollision', () => {
  // Nothing to lose — never interrupt.
  it('proceeds without prompting when there is nothing at stake', async () => {
    await expect(confirmCollision({ owned: 0, joined: 0 })).resolves.toBe('migrate');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  describe('with trips the anonymous uid owns', () => {
    it('offers to bring them across', async () => {
      press('Bring it with me');
      await expect(confirmCollision({ owned: 1, joined: 0 })).resolves.toBe('migrate');
    });

    it('offers to abandon them', async () => {
      press('Abandon trip');
      await expect(confirmCollision({ owned: 1, joined: 0 })).resolves.toBe('abandon');
    });

    it('offers to back out entirely', async () => {
      press('Cancel');
      await expect(confirmCollision({ owned: 1, joined: 0 })).resolves.toBe('cancel');
    });

    it('marks only abandoning as destructive', async () => {
      press('Cancel');
      await confirmCollision({ owned: 1, joined: 0 });
      const btns = mockAlert.mock.calls[0][2];
      expect(btns.find((b: { text: string }) => b.text === 'Abandon trip').style).toBe('destructive');
      expect(btns.find((b: { text: string }) => b.text === 'Bring it with me').style).toBeUndefined();
    });

    it('says abandoning cannot be undone', async () => {
      press('Cancel');
      await confirmCollision({ owned: 1, joined: 0 });
      expect(mockAlert.mock.calls[0][1]).toContain("can't be undone");
    });

    it('counts and pluralizes correctly', async () => {
      press('Cancel');
      await confirmCollision({ owned: 3, joined: 0 });
      expect(mockAlert.mock.calls[0][0]).toContain('trips');
      expect(mockAlert.mock.calls[0][1]).toContain('The 3 trips you made on this phone');
    });
  });

  describe('with trips the anonymous uid only joined', () => {
    // These belong to someone else, so there is no copy to offer — folding them into one
    // count would imply they could be saved.
    it('offers no migrate option at all when nothing is owned', async () => {
      press('Cancel');
      await confirmCollision({ owned: 0, joined: 2 });
      const labels = mockAlert.mock.calls[0][2].map((b: { text: string }) => b.text);
      expect(labels).toEqual(['Sign in anyway', 'Cancel']);
    });

    it('resolves abandon when the user goes ahead anyway', async () => {
      press('Sign in anyway');
      await expect(confirmCollision({ owned: 0, joined: 2 })).resolves.toBe('abandon');
    });

    it('says plainly that a joined trip stays behind either way', async () => {
      press('Cancel');
      await confirmCollision({ owned: 1, joined: 1 });
      expect(mockAlert.mock.calls[0][1]).toContain('joined from an invite link');
      expect(mockAlert.mock.calls[0][1]).toContain('either way');
    });
  });
});
