// Minimal Reanimated mock for Jest — avoids native worklet initialization
const React = require('react');
const { View } = require('react-native');

const NOOP = () => {};
const ID = (v) => v;

// Layout-animation builders are chainable statics (`FadeInDown.duration(300).delay(40)`),
// and the chain runs at module scope — before any render — so an absent one throws on
// import rather than on mount. Each returns itself so any chain of any length resolves.
function layoutAnimation() {
  const builder = {};
  const self = () => builder;
  for (const method of [
    'duration', 'delay', 'springify', 'damping', 'stiffness', 'mass', 'overshootClamping',
    'restDisplacementThreshold', 'restSpeedThreshold', 'easing', 'randomDelay',
    'withInitialValues', 'withCallback', 'reduceMotion', 'build', 'getDelay',
    'getDelayFunction', 'getAnimationAndConfig',
  ]) builder[method] = self;
  return builder;
}

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
  // `withSpring`/`withTiming` are identity here, so the derived value settles instantly on
  // its target — which is what a test wants to assert against anyway.
  useDerivedValue: (fn) => ({ value: typeof fn === 'function' ? fn() : fn }),
  useAnimatedProps: () => ({}),
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

  FadeIn: layoutAnimation(),
  FadeInDown: layoutAnimation(),
  FadeInUp: layoutAnimation(),
  FadeInLeft: layoutAnimation(),
  FadeInRight: layoutAnimation(),
  FadeOut: layoutAnimation(),
  FadeOutDown: layoutAnimation(),
  FadeOutUp: layoutAnimation(),
  SlideInDown: layoutAnimation(),
  SlideOutDown: layoutAnimation(),
  Layout: layoutAnimation(),
  LinearTransition: layoutAnimation(),

  interpolate: (value, _input, output) => output[0],
  interpolateColor: (_value, _input, output) => output[0],
  createAnimatedComponent: (component) => component,
};
