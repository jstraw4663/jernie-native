/// <reference types="@types/jest" />

// Jest manual mock for @react-native-firebase/firestore.
// This module is a JSI native module and cannot run in Node.js.
// Activated automatically when jest.mock('@react-native-firebase/firestore') is called.

const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet }));
const mockCollectionGet = jest.fn();
const mockCollection = jest.fn(() => ({ doc: mockDoc, get: mockCollectionGet }));
const mockFirestore = jest.fn(() => ({ collection: mockCollection }));

export { mockCollection, mockDoc, mockGet, mockCollectionGet };
export default mockFirestore;
