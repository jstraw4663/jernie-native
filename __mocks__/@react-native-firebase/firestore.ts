/// <reference types="@types/jest" />

// Jest manual mock for @react-native-firebase/firestore.
// This module is a JSI native module and cannot run in Node.js.
// Activated automatically when jest.mock('@react-native-firebase/firestore') is called.

const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet }));
const mockCollectionGet = jest.fn();
const mockWhereGet = jest.fn();
const mockWhere = jest.fn(() => ({ get: mockWhereGet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc, get: mockCollectionGet, where: mockWhere }));
const mockFirestore = jest.fn(() => ({ collection: mockCollection }));

// Named export mirroring the real module's modular `documentId()` helper — the
// namespaced `firestore.FieldPath.documentId()` is NOT implemented in the installed
// @react-native-firebase/firestore version (see src/lib/firestoreBatchGet.ts for details),
// so production code imports this named export instead.
const documentId = jest.fn(() => '__name__');

export { mockCollection, mockDoc, mockGet, mockCollectionGet, mockWhere, mockWhereGet, documentId };
export default mockFirestore;
