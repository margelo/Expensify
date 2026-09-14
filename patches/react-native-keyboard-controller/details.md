# `react-native-keyboard-controller` patches

### [react-native-keyboard-controller+1.22.5+001+fix-insets-in-landscape.patch](react-native-keyboard-controller+1.22.5+001+fix-insets-in-landscape.patch)

- Reason:
  
    In EdgeToEdgeReactViewGroup.setupWindowInsets(), the library unconditionally applies navBarInsets.left and navBarInsets.right as margins on the content view, even though the bottom margin is already conditional on navigationBarTranslucent. In landscape mode on Android, the navigation bar moves to the side of the screen, and these unconditional margins shrink the content area by the nav bar width. This causes useSafeAreaFrame() to report a reduced windowWidth and useSafeAreaInsets() to return 0 for left/right insets, since the SafeAreaProvider view no longer overlaps with the nav bar area. The patch makes left/right margins respect the same shouldApplyZeroPaddingBottom condition used for the bottom margin.

    During a cancelled interactive keyboard dismissal on iOS, the final keyboard event is not copied into the provider's Animated or Reanimated height values. The last interactive height can therefore remain latched and translate `KeyboardStickyView` below its clipped parent until the keyboard is closed or reopened. The patch also rejects non-finite and negative layout-guide positions before they reach JavaScript, restoring the final open or closed state while leaving UIKit in control of the physical keyboard gesture.
  
- Upstream PR/issue: https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1563
- E/App issue: https://github.com/Expensify/App/issues/87307
- PR introducing patch: https://github.com/Expensify/App/pull/87376
