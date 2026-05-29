module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // NOTE: react-native-reanimated/plugin MUST remain last in this array
      'react-native-reanimated/plugin',
    ],
  };
};
