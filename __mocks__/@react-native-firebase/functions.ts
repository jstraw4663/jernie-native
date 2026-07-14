/// <reference types="@types/jest" />

// Jest manual mock for @react-native-firebase/functions.
// This module is a JSI native module and cannot run in Node.js.
// Activated automatically when jest.mock('@react-native-firebase/functions') is called.

const mockHttpsCallableRun = jest.fn();
const mockHttpsCallable = jest.fn(() => mockHttpsCallableRun);
const mockFunctions = jest.fn(() => ({ httpsCallable: mockHttpsCallable }));

export { mockHttpsCallable, mockHttpsCallableRun };
export default mockFunctions;
