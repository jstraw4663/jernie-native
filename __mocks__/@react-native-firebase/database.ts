/// <reference types="@types/jest" />

// Jest manual mock for @react-native-firebase/database.
// This module is a JSI native module and cannot run in Node.js.
// Activated automatically when jest.mock('@react-native-firebase/database') is called.

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockOff = jest.fn();
const mockOnce = jest.fn();
const mockOn = jest.fn();
const mockRef = jest.fn(() => ({ once: mockOnce, on: mockOn, off: mockOff, set: mockSet, update: mockUpdate }));
const mockDatabase = jest.fn(() => ({ ref: mockRef }));

export { mockRef, mockOnce, mockOn, mockOff, mockSet, mockUpdate };
export default mockDatabase;
