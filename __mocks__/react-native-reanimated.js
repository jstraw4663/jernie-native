// Minimal Reanimated mock for Jest — avoids native worklet initialization
const React = require('react');
const { View } = require('react-native');

const NOOP = () => {};
const ID = (v) => v;

module.exports = {
  __esModule: true,
  default: {
    View,
    ScrollView: require('react-native').ScrollView,
    FlatList: require('react-native').FlatList,
    Image: require('react-native').Image,
    Text: require('react-native').Text,
    createAnimatedComponent: (component) => component,
  },
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (fn) => ({}),
  useAnimatedScrollHandler: () => NOOP,
  useAnimatedRef: () => React.createRef(),
  withSpring: ID,
  withTiming: ID,
  withRepeat: ID,
  withSequence: (...args) => args[0],
  withDelay: (_delay, anim) => anim,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  scrollTo: NOOP,
  Easing: {
    linear: ID,
    ease: ID,
    quad: ID,
    cubic: ID,
    bezier: () => ID,
    in: ID,
    out: ID,
    inOut: ID,
  },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate: (value, _input, output) => output[0],
  interpolateColor: (_value, _input, output) => output[0],
  createAnimatedComponent: (component) => component,
};
