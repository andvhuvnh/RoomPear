jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = ({ children, ...props }) => React.createElement(View, props, children);
  return {
    __esModule: true,
    default: { setAccessToken: jest.fn() },
    MapView: Mock,
    Camera: Mock,
    PointAnnotation: Mock,
    ShapeSource: Mock,
    FillLayer: () => null,
    LineLayer: () => null,
  };
});
