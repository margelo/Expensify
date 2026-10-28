# `react-native-keyboard-controller` patches

### [react-native-keyboard-controller+1.22.9+001+fix-insets-in-landscape.patch](react-native-keyboard-controller+1.22.9+001+fix-insets-in-landscape.patch)

- Android: Makes left and right navigation-bar margins respect `navigationBarTranslucent`, matching the bottom margin. This preserves the full safe-area frame in landscape.
- iOS: Rejects non-finite and negative keyboard layout-guide positions while retaining upstream's fractional-height rounding. Copies final keyboard events into Animated and Reanimated values so cancelling an interactive dismissal restores the final composer position.
- Upstream issue: https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1563 tracks the separate initial tracking lag. The final-event correction does not resolve that lag.
- E/App issues: https://github.com/Expensify/App/issues/87307 and https://github.com/Expensify/App/issues/54270
- Original Android patch: https://github.com/Expensify/App/pull/87376
