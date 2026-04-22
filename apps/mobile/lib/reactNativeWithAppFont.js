const React = require('react');
const { withAppFontFamily } = require('./typography');

/** Real package — resolved only via Metro alias `react-native-internal` (see metro.config.js). */
const RN = require('react-native-internal');

const OriginalText = RN.Text;
const OriginalTextInput = RN.TextInput;

const TextWithAppFont = React.forwardRef(function TextWithAppFont(props, ref) {
  return React.createElement(OriginalText, {
    ...props,
    ref,
    style: withAppFontFamily(props.style),
  });
});
TextWithAppFont.displayName = 'Text';

const TextInputWithAppFont = React.forwardRef(function TextInputWithAppFont(props, ref) {
  return React.createElement(OriginalTextInput, {
    ...props,
    ref,
    style: withAppFontFamily(props.style),
  });
});
TextInputWithAppFont.displayName = 'TextInput';

// Do not use Object.assign on `react-native` — it eagerly runs getters and can touch native
// modules before the bridge is ready. Forward everything through the real module except Text/TextInput.
module.exports = new Proxy(RN, {
  get(target, prop, receiver) {
    if (prop === 'Text') return TextWithAppFont;
    if (prop === 'TextInput') return TextInputWithAppFont;
    return Reflect.get(target, prop, receiver);
  },
});
