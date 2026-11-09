# `react-native-keyboard-controller` patches

### [react-native-keyboard-controller+1.23.0+001+fix-insets-in-landscape.patch](react-native-keyboard-controller+1.23.0+001+fix-insets-in-landscape.patch)

- Reason:
  
    ```
    Android: In EdgeToEdgeReactViewGroup.setupWindowInsets(), the library unconditionally applies navBarInsets.left and navBarInsets.right as margins on the content view, even though the bottom margin is already conditional on navigationBarTranslucent. In landscape mode on Android, the navigation bar moves to the side of the screen, and these unconditional margins shrink the content area by the nav bar width. This causes useSafeAreaFrame() to report a reduced windowWidth and useSafeAreaInsets() to return 0 for left/right insets, since the SafeAreaProvider view no longer overlaps with the nav bar area. The patch makes left/right margins respect the same shouldApplyZeroPaddingBottom condition used for the bottom margin.

    ```
  
- Upstream PR/issue: 🛑
- E/App issue: https://github.com/Expensify/App/issues/87307
- PR introducing patch: https://github.com/Expensify/App/pull/87376

### [react-native-keyboard-controller+1.23.0+002+apply-initial-keyboard-state-on-ui-thread.patch](react-native-keyboard-controller+1.23.0+002+apply-initial-keyboard-state-on-ui-thread.patch)

- Reason:
  
    ```
    KeyboardAvoidingView sets its starting keyboard state from the JS thread when it mounts. Reanimated applies those writes on the UI thread later, once the JS thread is free. When a screen opens with a focused input, such as a chat with a draft, the keyboard can open before that happens. The late writes then reset the view to "keyboard closed, height 0", so it never adds the bottom padding and the composer stays behind the keyboard. The patch applies the starting state on the UI thread and skips it once a keyboard event has arrived. It is the change from the upstream PR below.
    ```
  
- Upstream PR/issue: https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1685
- E/App issue: https://github.com/Expensify/App/pull/100733#issuecomment-6411009930
- PR introducing patch: https://github.com/Expensify/App/pull/106003

### [react-native-keyboard-controller+1.23.0+003+stabilize-ios-interactive-keyboard-state.patch](react-native-keyboard-controller+1.23.0+003+stabilize-ios-interactive-keyboard-state.patch)

- Reason: Rejects non-finite and negative keyboard layout-guide positions while preserving the upstream fractional-height rounding. Applies final keyboard events to Animated and Reanimated values so a cancelled dismissal returns the composer to its final position.
- Upstream PR/issue: https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1563
- E/App issue: https://github.com/Expensify/App/issues/54270
- PR introducing patch: https://github.com/margelo/Expensify/pull/38

### [react-native-keyboard-controller+1.23.0+004+namespace-ios-ui-utils.patch](react-native-keyboard-controller+1.23.0+004+namespace-ios-ui-utils.patch)

- Reason: Prefixes the Objective-C helper name so the keyboard controller can link alongside HybridApp's existing UIUtils class. Swift callers keep the same API.
- Upstream PR/issue: https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1686
- E/App issue: https://github.com/Expensify/App/issues/54270
- PR introducing patch: https://github.com/margelo/Expensify/pull/38
