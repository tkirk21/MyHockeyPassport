// components/LoadingPuck.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";

type LoadingPuckProps = {
  style?: ViewStyle;
  size?: number;
};

export default function LoadingPuck({ style, size = 240 }: LoadingPuckProps) {
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
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.overlay, style]}>
      <Animated.Image
        source={require("@/assets/images/loading_puck.png")}
        style={{
          width: size,
          height: size,
          transform: [{ rotateY: spin }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: "center", alignItems: "center", backgroundColor: "transparent", },
});