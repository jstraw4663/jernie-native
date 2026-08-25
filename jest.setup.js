// jest-expo installs `fetch` (and its siblings) as *lazy* globals: the first property read
// pulls in `expo/src/winter/fetch`, which requires `expo-modules-core`, whose JS logger cannot
// resolve its native module under Node and falls back to `console.warn`.
//
// That warning is harmless — but if the first read happens in an async continuation *after* a
// test file has finished, Jest reports "Cannot log after tests are done" and exits 1 with every
// single test passing. It surfaced only in multi-suite runs, which is why no suite failed alone.
//
// Reading it once here forces the require during setup, where a console write is legal.
void globalThis.fetch;
