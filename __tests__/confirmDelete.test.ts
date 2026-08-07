import { Alert } from 'react-native';
import { confirmDelete } from '@/src/utils/confirmDelete';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => { (Alert.alert as jest.Mock).mockClear(); });

it('presents a cancel button and a destructive confirm button', () => {
  confirmDelete({ title: 'Remove stop?', message: 'This deletes its bookings.', onConfirm: jest.fn() });

  const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(title).toBe('Remove stop?');
  expect(message).toBe('This deletes its bookings.');
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toMatchObject({ text: 'Cancel', style: 'cancel' });
  expect(buttons[1]).toMatchObject({ text: 'Remove', style: 'destructive' });
});

it('runs onConfirm only when the destructive button is pressed', () => {
  const onConfirm = jest.fn();
  confirmDelete({ title: 't', message: 'm', onConfirm });

  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  expect(onConfirm).not.toHaveBeenCalled();   // not called just by presenting

  buttons[0].onPress?.();                      // Cancel
  expect(onConfirm).not.toHaveBeenCalled();

  buttons[1].onPress();                        // Remove
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it('uses a custom confirm label when given', () => {
  confirmDelete({ title: 't', message: 'm', confirmLabel: 'Delete trip', onConfirm: jest.fn() });
  expect((Alert.alert as jest.Mock).mock.calls[0][2][1].text).toBe('Delete trip');
});
