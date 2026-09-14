# `@legendapp/list` patches

### [@legendapp+list+3.3.10+001+scroll-view-component.patch](@legendapp+list+3.3.10+001+scroll-view-component.patch)

- Reason:

    `KeyboardAwareLegendList` uses `KeyboardChatScrollView`, which supports replacing its underlying Reanimated scroll view through `ScrollViewComponent`. However, `KeyboardAwareLegendList` omits that prop from its public type and does not forward it explicitly. Exposing and forwarding the prop allows consumers to customize the underlying scroll view without replacing the keyboard-aware scroll renderer.

    On iOS, the native scroll event already reports the keyboard-adjusted `contentInset` and `contentOffset`. Forwarding the asynchronous `onContentInsetChange` callback as a second inset source can leave LegendList virtualizing against stale values during interactive dismissal, so the patch keeps that callback on Android only.

- Upstream PR/issue: -
- E/App issue: -
- PR introducing patch: -
