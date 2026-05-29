module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(!isTest);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // NOTE: react-native-reanimated/plugin MUST remain last in this array
      // Excluded in test environment — requires native worklets module unavailable in Node
      ...(isTest ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
