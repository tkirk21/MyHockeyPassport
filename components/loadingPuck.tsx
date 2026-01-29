// components/LoadingPuck.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useColorScheme } from '@/hooks/useColorScheme';

type LoadingPuckProps = {
  size?: number;
};

export default function LoadingPuck({ size = 240 }: LoadingPuckProps) {
  const colorScheme = useColorScheme();
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const puckSource = colorScheme === 'dark'
    ? require("@/assets/images/loading_puck_dark.png")
    : require("@/assets/images/loading_puck.png");

  const backgroundColor = colorScheme === 'dark' ? '#0D2C42' : '#FFFFFF';

  return (
    <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor }]}>
      <Animated.Image
        source={puckSource}
        style={{ width: size, height: size, transform: [{ rotateY: spin }] }}
        resizeMode="contain"
      />
    </View>
  );
}