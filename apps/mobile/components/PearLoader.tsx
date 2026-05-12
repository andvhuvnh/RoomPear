import { useLayoutEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
};

export default function PearLoader({ size = 90 }: Props) {
  const translateY = useRef(new Animated.Value(-14)).current;
  const scale = useRef(new Animated.Value(1.1)).current;

  useLayoutEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateY, { toValue: -28, duration: 260, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.18, duration: 260, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 7, stiffness: 280, mass: 0.8 }),
          Animated.timing(scale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
        ]),
        Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.delay(80),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, []);

  return (
    <View style={styles.wrap}>
      <Animated.Image
        source={require('../assets/roompear-logo-transparent-2-removebg-preview.png')}
        style={[styles.img, { width: size, height: size, transform: [{ translateY }, { scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  img: {},
});
